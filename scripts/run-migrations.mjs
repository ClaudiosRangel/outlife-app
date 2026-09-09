// Executa supabase/migrations-pendentes.sql contra o banco de PRODUÇÃO.
// Lê SUPABASE_DB_URL do .env (connection string do Postgres, com senha
// URL-encodada). Todo o SQL é idempotente (IF NOT EXISTS / CREATE OR REPLACE),
// então rodar mais de uma vez é seguro.
//
// Uso: node scripts/run-migrations.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(name) {
  const raw = readFileSync(".env", "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) return null;
  return line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim();
}

const connectionString = readEnv("SUPABASE_DB_URL");
if (!connectionString) {
  console.error("Falta SUPABASE_DB_URL no .env");
  process.exit(2);
}

const sql = readFileSync("supabase/migrations-pendentes.sql", "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }, // Supabase exige SSL; a cadeia nem sempre é reconhecida
});

try {
  console.log("Conectando ao banco de produção...");
  await client.connect();
  console.log("Conectado. Executando migrations-pendentes.sql...");
  await client.query(sql);
  console.log("✓ Migrações aplicadas com sucesso.");
} catch (err) {
  console.error("✗ Erro ao aplicar migrações:");
  console.error(err.message);
  if (err.position) console.error("Posição no SQL:", err.position);
  process.exitCode = 1;
} finally {
  await client.end();
}
