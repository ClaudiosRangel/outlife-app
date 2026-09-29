// Seed GENÉRICO de destino real a partir de um GPX no repo (Bloco 3 / popular
// Explorar). Idempotente por nome+state: se existe, ATUALIZA; senão INSERE
// (approved). Busca elevação via Open-Meteo (grátis) para o elevation_profile.
// Versionado (seed real de produção), diferente dos scripts _tmp-*.
//
// Uso:
//   node scripts/seed-destino-gpx.mjs --file "Arquivo.gpx" \
//     --region "Delfinópolis" --state "MG" --difficulty "Médio" \
//     --category "cachoeira" --type "Cachoeira" --trailType "Ida e volta" \
//     --paid false --price "" --hours "" --pet false --duration ""
//
// Campos não informados usam defaults sensatos. name/description vêm do GPX.

import fs from "node:fs";
import pg from "pg";

// ---- args ----
function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const GPX_FILE = arg("file");
if (!GPX_FILE) throw new Error('Informe --file "Arquivo.gpx"');
const REGION = arg("region", null);
const STATE = arg("state", null);
const DIFFICULTY = arg("difficulty", "Moderada");
const CATEGORY = arg("category", "trilha");
const TYPE = arg("type", null);
const TRAIL_TYPE = arg("trailType", null);
const IS_PAID = arg("paid", "false") === "true";
const PRICE = arg("price", "") || null;
const HOURS = arg("hours", "") || null;
const PET = arg("pet", "false") === "true";
const DURATION = arg("duration", "") || null;

// ---- Parser GPX ----
function parseGpx(xml) {
  const meta = xml.match(/<metadata>([\s\S]*?)<\/metadata>/)?.[1] ?? "";
  const dec = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
  const name = (meta.match(/<name>([\s\S]*?)<\/name>/) ?? xml.match(/<name>([\s\S]*?)<\/name>/))?.[1]?.trim();
  const desc = (meta.match(/<desc>([\s\S]*?)<\/desc>/) ?? xml.match(/<desc>([\s\S]*?)<\/desc>/))?.[1]?.trim();
  const pts = [];
  const re = /<(?:trkpt|rtept)\s+[^>]*?lat="([-\d.eE+]+)"[^>]*?lon="([-\d.eE+]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    let ele = null;
    if (m[3]) { const e = m[3].match(/<ele>([-\d.]+)<\/ele>/); if (e) ele = parseFloat(e[1]); }
    pts.push({ lat, lng, ele });
  }
  return { name: name ? dec(name) : null, description: desc ? dec(desc) : null, points: pts };
}

function haversine(a, b) {
  const R = 6371000, r = (d) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function fetchElevations(points) {
  const out = new Array(points.length).fill(null);
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    const lat = batch.map((p) => p.lat.toFixed(6)).join(",");
    const lng = batch.map((p) => p.lng.toFixed(6)).join(",");
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`elevation ${res.status}`);
      const j = await res.json();
      (j.elevation ?? []).forEach((e, k) => { out[i + k] = Number.isFinite(e) ? e : null; });
    } catch (e) {
      console.warn("Open-Meteo elevation falhou (segue sem perfil):", e.message);
    }
  }
  return out;
}

const env = fs.readFileSync(".env", "utf8");
const connectionString = env.match(/SUPABASE_DB_URL=(.+)/)?.[1]?.trim();
if (!connectionString) throw new Error("SUPABASE_DB_URL ausente no .env");

const xml = fs.readFileSync(GPX_FILE, "utf8");
const { name, description, points } = parseGpx(xml);
if (!name || points.length < 2) throw new Error("GPX inválido");

let dist = 0;
for (let i = 1; i < points.length; i++) dist += haversine(points[i - 1], points[i]);
const distanceKm = +(dist / 1000).toFixed(2);

const eles = await fetchElevations(points);
let cum = 0, gain = 0, profile = null;
if (eles.some((e) => e != null)) {
  profile = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0) { cum += haversine(points[i - 1], points[i]); if (eles[i] != null && eles[i - 1] != null && eles[i] > eles[i - 1]) gain += eles[i] - eles[i - 1]; }
    profile.push({ d: Math.round(cum), e: eles[i] != null ? Math.round(eles[i]) : null });
  }
}

const geojson = { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) };
const start = points[0];

const c = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await c.connect();

const existing = await c.query(
  "select id from public.destinations where lower(name)=lower($1) and coalesce(state,'')=$2 limit 1",
  [name, STATE ?? ""],
);

const fields = {
  name,
  description,
  latitude: start.lat,
  longitude: start.lng,
  start_lat: start.lat,
  start_lng: start.lng,
  region: REGION,
  state: STATE,
  difficulty: DIFFICULTY,
  category: CATEGORY,
  type: TYPE,
  trail_type: TRAIL_TYPE,
  distance: `${distanceKm} km`,
  distance_km: distanceKm,
  duration: DURATION,
  is_paid: IS_PAID,
  price_text: PRICE,
  opening_hours: HOURS,
  pet_friendly: PET,
  status: "approved",
  route_geojson: JSON.stringify(geojson),
  elevation_profile: profile ? JSON.stringify(profile) : null,
  elevation: profile ? `${Math.round(gain)}m` : null,
};

if (existing.rows.length) {
  const id = existing.rows[0].id;
  const cols = Object.keys(fields);
  const sets = cols.map((k, i) => `${k}=$${i + 1}`).join(", ");
  await c.query(`update public.destinations set ${sets} where id=$${cols.length + 1}`, [...cols.map((k) => fields[k]), id]);
  console.log(`"${name}" ATUALIZADO:`, id);
} else {
  const cols = Object.keys(fields);
  const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
  const r = await c.query(`insert into public.destinations (${cols.join(", ")}) values (${ph}) returning id`, cols.map((k) => fields[k]));
  console.log(`"${name}" INSERIDO:`, r.rows[0].id);
}
console.log(`  distância: ${distanceKm} km | pontos: ${points.length} | ganho: ${Math.round(gain)}m | perfil: ${profile ? profile.length : 0}`);

await c.end();
