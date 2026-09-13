import pg from "pg";
import fs from "node:fs";
function readEnv() {
  const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith("SUPABASE_DB_URL="));
  return line.slice("SUPABASE_DB_URL=".length).trim().replace(/^["']|["']$/g, "");
}
const c = new pg.Client({ connectionString: readEnv(), ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("NOTIFY pgrst, 'reload schema'");
console.log("Schema cache do PostgREST recarregado (NOTIFY pgrst).");
await c.end();
