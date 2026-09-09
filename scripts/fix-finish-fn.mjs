// Corrige a ambiguidade PGRST203 de finish_user_activity: dropa a versão
// antiga de 9 argumentos (sem _video_url), deixando só a de 10 argumentos
// que o frontend chama. Idempotente (DROP ... IF EXISTS com assinatura exata).
import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(name) {
  const raw = readFileSync(".env", "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim() : null;
}

const client = new pg.Client({
  connectionString: readEnv("SUPABASE_DB_URL"),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const listSql =
  "SELECT oid::regprocedure AS sig, pronargs FROM pg_proc WHERE proname = 'finish_user_activity' ORDER BY pronargs";

const before = await client.query(listSql);
console.log("Antes:", JSON.stringify(before.rows));

// Dropa explicitamente a versão de 9 argumentos (sem _video_url).
const dropOldSql =
  "DROP FUNCTION IF EXISTS public.finish_user_activity(uuid, jsonb, numeric, integer, text, text, text, text, numeric)";
await client.query(dropOldSql);

const after = await client.query(listSql);
console.log("Depois:", JSON.stringify(after.rows));

await client.end();
console.log("✓ Concluído.");
