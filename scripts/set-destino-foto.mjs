// Sobe uma foto para o Storage (bucket community-post-images) e grava a URL
// pública em destinations.main_image_url do destino informado (por nome).
// Versionado (operação real). Otimiza com sharp (máx 1600px, webp q80).
//
// Uso: node scripts/set-destino-foto.mjs --file "ze-carlinhos.jpg" --name "Bate volta Cachoeira Ze Carlinhos"

import fs from "node:fs";
import sharp from "sharp";
import pg from "pg";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
function readEnv(name) {
  const raw = fs.readFileSync(".env", "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim() : null;
}

const FILE = arg("file");
const NAME = arg("name");
if (!FILE || !NAME) throw new Error('Uso: --file "foto.jpg" --name "Nome do destino"');

const SUPABASE_URL = readEnv("VITE_SUPABASE_URL");
const SERVICE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const DB_URL = readEnv("SUPABASE_DB_URL");
if (!SUPABASE_URL || !SERVICE_KEY || !DB_URL) throw new Error("Faltam envs (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL)");

const BUCKET = "community-post-images";
const objectPath = `destinos/${FILE.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase()}.webp`;

// 1) Otimiza a imagem
const optimized = await sharp(fs.readFileSync(FILE))
  .rotate()
  .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 80 })
  .toBuffer();
console.log(`Imagem otimizada: ${(optimized.length / 1024).toFixed(1)} KB`);

// 2) Upload via Storage REST (service role; upsert)
const upUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`;
const upRes = await fetch(upUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
    "Content-Type": "image/webp",
    "x-upsert": "true",
  },
  body: optimized,
});
if (!upRes.ok) throw new Error(`Upload falhou (${upRes.status}): ${await upRes.text()}`);
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
console.log("URL pública:", publicUrl);

// 3) Grava main_image_url no destino (por nome)
const c = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  "update public.destinations set main_image_url=$1 where lower(name)=lower($2) returning id",
  [publicUrl, NAME],
);
await c.end();
if (r.rows.length === 0) console.warn("⚠️ Nenhum destino com esse nome — nada atualizado.");
else console.log(`✓ main_image_url atualizado no destino ${r.rows[0].id}`);
