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
    const tg = el.tags;
    if (!tg || !tg.name) continue;
    // dedup por tipo+id (way e relation podem colidir de id)
    const extId = `${el.type}/${el.id}`;
    if (seen.has(extId)) continue;
    seen.add(extId);

    // Dificuldade: sac_scale (caminhada) ou mtb:scale; normaliza p/ rótulo.
    const difficulty = tg.sac_scale ?? tg["mtb:scale"] ?? tg.difficulty ?? null;
    // Distância: tag "distance" (às vezes "12 km" / "12"); extrai número em km.
    let distanceKm = null;
    if (tg.distance) {
      const m = String(tg.distance).match(/([\d.,]+)/);
      if (m) distanceKm = Number(m[1].replace(",", "."));
    }
    // Elevação: ascent (ganho) ou ele (altitude do ponto).
    let elevationM = null;
    const elevRaw = tg.ascent ?? tg.ele ?? null;
    if (elevRaw != null) {
      const m = String(elevRaw).match(/([\d.,]+)/);
      if (m) elevationM = Number(m[1].replace(",", "."));
    }
    // Imagem direta na tag OSM (raro, mas quando existe é a melhor).
    const osmImage = tg.image && /^https?:\/\//i.test(tg.image) ? tg.image : null;

    out.push({
      external_id: extId,
      name: tg.name,
      description: tg.description ?? tg["description:pt"] ?? null,
      lat: el.center?.lat ?? el.lat ?? null,
      lng: el.center?.lon ?? el.lon ?? null,
      difficulty,
      distance_km: Number.isFinite(distanceKm) ? distanceKm : null,
      elevation_m: Number.isFinite(elevationM) ? elevationM : null,
      website: tg.website ?? tg["contact:website"] ?? null,
      wikidata_id: tg.wikidata ?? null,
      wikipedia: tg.wikipedia ?? null,
      image_url: osmImage,
    });
  }
  return out;
}

// Resolve a URL de imagem do Wikimedia Commons a partir do nome do arquivo
// (tag P18 do Wikidata). Usa Special:FilePath (redireciona para a imagem).
function commonsImageUrl(fileName, width = 1200) {
  const clean = String(fileName).replace(/ /g, "_");
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(clean)}?width=${width}`;
}

// Enriquece um item com imagem (P18) e descrição a partir do Wikidata, quando
// a trilha OSM tiver a tag `wikidata`. Gratuito, sem chave. Falha silenciosa
// (mantém o item sem imagem). Wikidata/Commons: licenças variadas — atribuição
// © OpenStreetMap mantida; imagens do Commons são de domínio público/CC.
async function enrichFromWikidata(item) {
  if (!item.wikidata_id || item.image_url) return item;
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(item.wikidata_id)}.json`;
    const res = await fetch(url, { headers: { "User-Agent": "OutVitar-trail-importer/1.0" } });
    if (!res.ok) return item;
    const json = await res.json();
    const entity = json.entities?.[item.wikidata_id];
    const claims = entity?.claims ?? {};
    // P18 = image
    const p18 = claims.P18?.[0]?.mainsnak?.datavalue?.value;
    if (p18) item.image_url = commonsImageUrl(p18);
    // Descrição pt/en se ainda não tiver
    if (!item.description) {
      const desc = entity?.descriptions?.pt?.value ?? entity?.descriptions?.["pt-br"]?.value ?? entity?.descriptions?.en?.value;
      if (desc) item.description = desc;
    }
  } catch {
    // silencioso
  }
  return item;
}

async function upsertTrails(client, source, region, items) {
  let inserted = 0;
  let updated = 0;
  for (const it of items) {
    const attribution = source === "osm" ? "© OpenStreetMap contributors" : null;
    const license = source === "osm" ? "ODbL" : null;
    const r = await client.query(
      `INSERT INTO public.imported_trails
         (external_source, external_id, name, description, region, lat, lng, license, attribution,
          image_url, website, difficulty, distance_km, elevation_m, wikidata_id, wikipedia, visible, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false, now())
       ON CONFLICT (external_source, external_id) DO UPDATE SET
         name = EXCLUDED.name,
         description = COALESCE(EXCLUDED.description, public.imported_trails.description),
         region = EXCLUDED.region,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         license = EXCLUDED.license,
         attribution = EXCLUDED.attribution,
         image_url = COALESCE(EXCLUDED.image_url, public.imported_trails.image_url),
         website = COALESCE(EXCLUDED.website, public.imported_trails.website),
         difficulty = COALESCE(EXCLUDED.difficulty, public.imported_trails.difficulty),
         distance_km = COALESCE(EXCLUDED.distance_km, public.imported_trails.distance_km),
         elevation_m = COALESCE(EXCLUDED.elevation_m, public.imported_trails.elevation_m),
         wikidata_id = COALESCE(EXCLUDED.wikidata_id, public.imported_trails.wikidata_id),
         wikipedia = COALESCE(EXCLUDED.wikipedia, public.imported_trails.wikipedia),
         updated_at = now()
       RETURNING (xmax = 0) AS is_insert`,
      [source, it.external_id, it.name, it.description, region, it.lat, it.lng, license, attribution,
       it.image_url ?? null, it.website ?? null, it.difficulty ?? null,
       it.distance_km ?? null, it.elevation_m ?? null, it.wikidata_id ?? null, it.wikipedia ?? null],
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

  console.log(`Buscando trilhas OSM em [${bbox.join(", ")}] — região "${region}"...`);
  const items = await fetchOsmHiking(bbox);
  console.log(`Encontradas ${items.length} trilhas nomeadas.`);
  if (items.length === 0) {
    console.log("Nada a importar.");
    return;
  }

  // Enriquecimento: imagem + descrição via Wikidata (só quem tem tag wikidata).
  const withWikidata = items.filter((i) => i.wikidata_id);
  if (withWikidata.length > 0) {
    console.log(`Enriquecendo ${withWikidata.length} trilhas com imagem/descrição do Wikidata...`);
    for (const it of withWikidata) {
      await enrichFromWikidata(it);
    }
    const comImagem = items.filter((i) => i.image_url).length;
    console.log(`  → ${comImagem} trilhas com imagem.`);
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
