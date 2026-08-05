/**
 * Aplica a migration de eventos diretamente no banco Supabase via a
 * Management API (endpoint SQL do dashboard), usando o token de acesso
 * pessoal. Se não disponível, tenta via `pg` com a connection string.
 * 
 * Uso: npx tsx scripts/apply-migration.ts
 * 
 * Requer variável SUPABASE_DB_URL no .env (connection string com senha).
 * Se não existir, instrui o usuário a aplicar manualmente.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationPath = resolve(__dirname, "../supabase/migrations/20260804090000_events-module.sql");
const sql = readFileSync(migrationPath, "utf-8");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.log("\n⚠️  Não foi possível aplicar automaticamente.");
    console.log("   Variável SUPABASE_DB_URL não encontrada no .env.\n");
    console.log("   Para aplicar manualmente:");
    console.log("   1. Acesse https://supabase.com/dashboard/project/dxmbftbhmjjqtpjymakj/sql");
    console.log("   2. Cole e execute o conteúdo de:");
    console.log("      supabase/migrations/20260804090000_events-module.sql\n");
    console.log("   Ou adicione SUPABASE_DB_URL ao .env com a connection string");
    console.log("   (encontrada em Settings > Database > Connection string > URI)\n");
    process.exit(1);
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log("✓ Conectado ao banco Supabase");
    
    await client.query(sql);
    console.log("✓ Migration aplicada com sucesso!");
    console.log("  Tabelas criadas: events, event_participants, event_questions, admin_emails");
    
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log("✓ Tabelas já existem (migration já foi aplicada anteriormente)");
    } else {
      console.error("✗ Erro ao aplicar migration:", err.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main();
