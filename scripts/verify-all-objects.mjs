// Verificação read-only ampla dos objetos das migrações pendentes.
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

const tables = ["saved_destinations", "favorite_partners", "partner_leads"];
const functions = [
  "fn_map_activity_type_to_category",
  "fn_build_activity_post_text",
  "fn_notify_activity_completed",
  "live_activity_type",
  "finish_user_activity",
  "fetch_activity_ranking",
  "recalc_review_aggregates",
  "trg_recalc_review_aggregates",
  "create_partner_lead",
  "trg_notify_partner_review",
  "fetch_partner_leads",
  "count_my_partner_favorites",
  "fn_dispatch_push_notification",
  "fn_send_native_push",
];
const views = ["public_user_locations_live", "user_level_stats"];
const triggers = ["trg_recalc_review_aggregates", "trg_notify_partner_review"];
const columns = [
  ["user_activities", "elevation_gain"],
  ["user_activities", "video_url"],
];

const out = {};

for (const t of tables) {
  const r = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS ok",
    [`public.${t}`],
  );
  out[`table:${t}`] = r.rows[0].ok;
}
for (const f of functions) {
  const r = await client.query(
    "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname=$1) AS ok",
    [f],
  );
  out[`fn:${f}`] = r.rows[0].ok;
}
for (const v of views) {
  const r = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS ok",
    [`public.${v}`],
  );
  out[`view:${v}`] = r.rows[0].ok;
}
for (const tg of triggers) {
  const r = await client.query(
    "SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=$1) AS ok",
    [tg],
  );
  out[`trigger:${tg}`] = r.rows[0].ok;
}
for (const [tbl, col] of columns) {
  const r = await client.query(
    "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2) AS ok",
    [tbl, col],
  );
  out[`col:${tbl}.${col}`] = r.rows[0].ok;
}

const missing = Object.entries(out).filter(([, ok]) => !ok).map(([k]) => k);
console.log(JSON.stringify(out, null, 2));
console.log(missing.length === 0 ? "\n✓ Todos os objetos presentes." : `\n✗ Faltando: ${missing.join(", ")}`);

await client.end();
