import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Teste de exemplo (task 5.2 do spec migracao-supabase-proprio-lovable).
 *
 * Verifica que supabase/config.toml referencia exclusivamente o Project_ID
 * do New_Supabase_Project, sem nenhum caractere remanescente do Project_ID
 * do Legacy_Supabase_Project (Requirement 3.6).
 *
 * Este teste FALHA propositalmente até que a task 5.1 (atualizar
 * supabase/config.toml com o Project_ID do New_Supabase_Project) seja
 * concluída, pois hoje o arquivo ainda referencia o Legacy_Supabase_Project.
 */

const LEGACY_PROJECT_ID = 'soghvqpnyekmkdqprpka';
const CONFIG_TOML_PATH = resolve(__dirname, '../../supabase/config.toml');

function readConfigToml(): string {
  return readFileSync(CONFIG_TOML_PATH, 'utf-8');
}

function extractProjectId(content: string): string | null {
  const match = content.match(/^project_id\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

describe('supabase/config.toml', () => {
  it('não contém nenhuma ocorrência do Project_ID do Legacy_Supabase_Project', () => {
    const content = readConfigToml();
    expect(content).not.toContain(LEGACY_PROJECT_ID);
  });

  it('contém um project_id não vazio, diferente do Legacy_Supabase_Project', () => {
    const content = readConfigToml();
    const projectId = extractProjectId(content);

    expect(projectId).toBeTruthy();
    expect(projectId).not.toBe(LEGACY_PROJECT_ID);
  });
});
