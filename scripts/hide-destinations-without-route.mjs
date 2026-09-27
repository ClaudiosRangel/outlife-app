// Item 3: mantém no Explorar SOMENTE destinos com rota real (route_geojson).
// Em vez de DELETAR (que poderia quebrar FKs de atividades/visitas), marca os
// destinos SEM rota como 'rejected' — eles saem do Explorar (que só mostra
// 'approved') de forma REVERSÍVEL. Idempotente. Versionado (operação real).
//
// Uso: node scripts/hide-destinations-without-route.mjs
import fs from "node:fs";
import pg from "pg";
const env = fs.readFileSync(".env", "utf8");
const connectionString = env.match(/SUPABASE_DB_URL=(.+)/)?.[1]?.trim();
const c = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await c.connect();
const before = await c.query("select count(*)::int as n from public.destinations where status='approved' and route_geojson is null");
const r = await c.query("update public.destinations set status='rejected' where status='approved' and route_geojson is null returning name");
console.log(`Ocultados ${r.rowCount} destinos sem rota (antes aprovados sem rota: ${before.rows[0].n}):`);
r.rows.forEach((x) => console.log("  -", x.name));
const remain = await c.query("select name from public.destinations where status='approved' order by name");
console.log(`\nDestinos APROVADOS restantes no Explorar (${remain.rowCount}):`);
remain.rows.forEach((x) => console.log("  ✓", x.name));
await c.end();
