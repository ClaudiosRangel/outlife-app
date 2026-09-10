// Debug read-only: estrutura da tabela reviews e amostra de dados.
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

const cols = await client.query(
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='reviews' ORDER BY ordinal_position",
);
console.log("Colunas de reviews:");
console.log(cols.rows.map((r) => `  ${r.column_name} (${r.data_type})`).join("\n"));

const count = await client.query("SELECT count(*)::int AS n FROM public.reviews");
console.log(`\nTotal de reviews: ${count.rows[0].n}`);

const sample = await client.query(
  "SELECT id, rating, partner_id, destination_id, author_id, created_at FROM public.reviews ORDER BY created_at DESC LIMIT 10",
);
console.log("\nÚltimas reviews:");
console.log(JSON.stringify(sample.rows, null, 2));

const fks = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'public.reviews'::regclass AND contype = 'f'
`);
console.log("\nForeign keys de reviews:");
console.log(fks.rows.map((r) => `  ${r.conname}: ${r.def}`).join("\n"));

await client.end();
