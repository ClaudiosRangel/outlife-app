// Aplica UM arquivo de migração específico contra produção.
// Uso: node scripts/run-one-migration.mjs supabase/migrations/<arquivo>.sql
import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(name) {
  const raw = readFileSync(".env", "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim() : null;
}

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/run-one-migration.mjs <caminho.sql>");
  process.exit(2);
}

const sql = readFileSync(file, "utf8");
const client = new pg.Client({
  connectionString: readEnv("SUPABASE_DB_URL"),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Aplicando ${file}...`);
  await client.query(sql);
  console.log("✓ Aplicado com sucesso.");
} catch (err) {
  console.error("✗ Erro:", err.message);
  if (err.position) console.error("Posição:", err.position);
  process.exitCode = 1;
} finally {
  await client.end();
}
