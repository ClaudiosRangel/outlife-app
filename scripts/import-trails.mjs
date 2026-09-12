// Frente H (Req 1/2) — Importação de trilhas/destinos externos para
// public.imported_trails. Rodado pelo agente/local com SUPABASE_DB_URL no
// .env. NÃO roda no device. Idempotente: upsert por (external_source,
// external_id). Itens nascem visible=false (curadoria pelo admin em
// /admin/trilhas).
//
// Uso:
//   node scripts/import-trails.mjs osm "<regiao>" <south> <west> <north> <east>
//
// Ex. (Serra dos Órgãos, RJ):
//   node scripts/import-trails.mjs osm "Serra dos Orgaos" -22.55 -43.05 -22.35 -42.90
//
// Fonte OSM: Overpass API (route=hiking). Licença ODbL, atribuição
// "© OpenStreetMap contributors" — OBRIGATÓRIA ao exibir no app.
import pg from "pg";
import fs from "node:fs";

function readEnv() {
  const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith("SUPABASE_DB_URL="));
  if (!line) throw new Error("SUPABASE_DB_URL não encontrado no .env");
  return line.slice("SUPABASE_DB_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function overpassRequest(query) {
  let lastErr;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "OutVitar-trail-importer/1.0 (curadoria de trilhas)",
        },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass HTTP ${res.status} (${url})`);
        continue;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Falha em todos os mirrors Overpass");
}

async function fetchOsmHiking(bbox) {
  const [s, w, n, e] = bbox;
  // Trilhas nomeadas: relations route=hiking/foot E ways highway=path/footway
  // com nome (muitas trilhas no Brasil são mapeadas como way nomeado, não
  // relation) — amplia bastante a quantidade de resultados.
  const query = `[out:json][timeout:90];
    (
      relation["route"~"hiking|foot"](${s},${w},${n},${e});
      way["highway"~"path|footway"]["name"](${s},${w},${n},${e});
      way["route"="hiking"]["name"](${s},${w},${n},${e});
    );
    out center tags;`;
  const json = await overpassRequest(query);
  const seen = new Set();
  const out = [];
  for (const el of json.elements ?? []) {
    if (!el.tags || !el.tags.name) continue;
    // dedup por tipo+id (way e relation podem colidir de id)
    const extId = `${el.type}/${el.id}`;
    if (seen.has(extId)) continue;
    seen.add(extId);
    out.push({
      external_id: extId,
      name: el.tags.name,
      description: el.tags.description ?? el.tags["description:pt"] ?? null,
      lat: el.center?.lat ?? el.lat ?? null,
      lng: el.center?.lon ?? el.lon ?? null,
    });
  }
  return out;
}

async function upsertTrails(client, source, region, items) {
  let inserted = 0;
  let updated = 0;
  for (const it of items) {
    const attribution = source === "osm" ? "© OpenStreetMap contributors" : null;
    const license = source === "osm" ? "ODbL" : null;
    const r = await client.query(
      `INSERT INTO public.imported_trails
         (external_source, external_id, name, description, region, lat, lng, license, attribution, visible, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false, now())
       ON CONFLICT (external_source, external_id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         region = EXCLUDED.region,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         license = EXCLUDED.license,
         attribution = EXCLUDED.attribution,
         updated_at = now()
       RETURNING (xmax = 0) AS is_insert`,
      [source, it.external_id, it.name, it.description, region, it.lat, it.lng, license, attribution],
    );
    if (r.rows[0]?.is_insert) inserted++;
    else updated++;
  }
  return { inserted, updated };
}

async function main() {
  const [source, region, s, w, n, e] = process.argv.slice(2);
  if (source !== "osm") {
    console.error('Uso: node scripts/import-trails.mjs osm "<regiao>" <south> <west> <north> <east>');
    process.exit(1);
  }
  const bbox = [s, w, n, e].map(Number);
  if (bbox.some((v) => !Number.isFinite(v))) {
    console.error("Bounding box inválido. Informe 4 números: south west north east.");
    process.exit(1);
  }

  console.log(`Buscando trilhas OSM (route=hiking) em [${bbox.join(", ")}] — região "${region}"...`);
  const items = await fetchOsmHiking(bbox);
  console.log(`Encontradas ${items.length} trilhas nomeadas.`);
  if (items.length === 0) {
    console.log("Nada a importar.");
    return;
  }

  const client = new pg.Client({ connectionString: readEnv(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { inserted, updated } = await upsertTrails(client, source, region, items);
    console.log(`OK — ${inserted} novas, ${updated} atualizadas. Todas visible=false (liberar em /admin/trilhas).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("ERRO na importação:", err.message);
  process.exit(1);
});
