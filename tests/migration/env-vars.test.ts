import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Teste de exemplo (task 5.4 do spec migracao-supabase-proprio-lovable).
 *
 * Verifica a presença das seis variáveis de ambiente exigidas pelo
 * Requirement 3.1/3.2, mais SUPABASE_SERVICE_ROLE_KEY (usada por
 * src/integrations/supabase/client.server.ts), tanto em .env.example
 * quanto em .env (quando presente localmente).
 *
 * Não assere sobre os valores reais das variáveis (que são segredos),
 * apenas sobre a presença da chave em cada arquivo.
 */

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_PROJECT_ID',
  'VITE_SUPABASE_PROJECT_ID',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function parseEnvKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

describe('variáveis de ambiente obrigatórias', () => {
  it('.env.example declara todas as variáveis obrigatórias', () => {
    const path = resolve(__dirname, '../../.env.example');
    const content = readFileSync(path, 'utf-8');
    const keys = parseEnvKeys(content);

    for (const envVar of REQUIRED_ENV_VARS) {
      expect(keys.has(envVar), `.env.example deve declarar ${envVar}`).toBe(true);
    }
  });

  it('.env local (quando presente) declara todas as variáveis obrigatórias', () => {
    const path = resolve(__dirname, '../../.env');
    if (!existsSync(path)) {
      // Ambiente sem .env local (ex.: CI); nada a validar aqui.
      return;
    }

    const content = readFileSync(path, 'utf-8');
    const keys = parseEnvKeys(content);

    for (const envVar of REQUIRED_ENV_VARS) {
      expect(keys.has(envVar), `.env deve declarar ${envVar}`).toBe(true);
    }
  });
});
