import { describe, expect, it } from 'vitest';
import pg from 'pg';

/**
 * Teste de exemplo (task 2.4 / 3.2 do spec migracao-supabase-proprio-lovable).
 *
 * Conecta no New_Supabase_Project (via connection string em
 * MIGRATION_VERIFY_DB_URL) e confirma a presença de cada tabela, bucket e
 * function esperados pelo Migration_Set, listados na seção "Data Models"
 * do design.md (Requirements 2.2, 2.3, 2.4, 2.6).
 *
 * Este teste é pulado automaticamente quando MIGRATION_VERIFY_DB_URL não
 * está definida (ex.: CI sem acesso ao banco), para não quebrar `npm test`
 * em ambientes sem essa credencial.
 */

const { Client } = pg;

const EXPECTED_TABLES = [
  'profiles',
  'profile_contacts',
  'destinations',
  'services',
  'community_posts',
  'reviews',
  'user_roles',
  'user_activities',
  'user_checklists',
  'user_friends',
];

const EXPECTED_BUCKETS = ['partner-gallery', 'review-photos'];

const EXPECTED_FUNCTIONS = [
  'handle_new_user',
  'has_role',
  'is_admin',
  'is_partner',
  'protect_profile_trust_fields',
  'prevent_post_counter_tampering',
  'award_review_xp',
  'increment_partner_profile_view',
  'increment_partner_contact_click',
  'finish_user_activity',
  'find_similar_destinations',
  'are_friends',
  'sync_destination_geog',
  'update_updated_at_column',
];

const connectionString = process.env.MIGRATION_VERIFY_DB_URL;

describe.skipIf(!connectionString)('schema do New_Supabase_Project após o Migration_Set', () => {
  it('contém todas as tabelas esperadas', async () => {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const res = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const tableNames = res.rows.map((r) => r.table_name);
      for (const table of EXPECTED_TABLES) {
        expect(tableNames, `tabela ${table} deve existir`).toContain(table);
      }
    } finally {
      await client.end();
    }
  });

  it('contém todos os buckets de storage esperados', async () => {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const res = await client.query(`SELECT id FROM storage.buckets`);
      const bucketNames = res.rows.map((r) => r.id);
      for (const bucket of EXPECTED_BUCKETS) {
        expect(bucketNames, `bucket ${bucket} deve existir`).toContain(bucket);
      }
    } finally {
      await client.end();
    }
  });

  it('contém todas as functions/RPCs esperadas', async () => {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const res = await client.query(
        `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public'`
      );
      const functionNames = res.rows.map((r) => r.routine_name);
      for (const fn of EXPECTED_FUNCTIONS) {
        expect(functionNames, `function ${fn} deve existir`).toContain(fn);
      }
    } finally {
      await client.end();
    }
  });
});
