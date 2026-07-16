import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Teste de exemplo (task 13.3 do spec outlife-production-plan).
 *
 * Valida que public/manifest.json (PWA_Manifest, Requirement 7.1) contém
 * name, ícones em pelo menos dois tamanhos e cor de tema.
 */

const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf-8'));

describe('public/manifest.json (PWA_Manifest)', () => {
  it('tem um name não vazio', () => {
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  it('tem pelo menos dois ícones com sizes distintos', () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    const sizes = new Set(manifest.icons.map((icon: { sizes: string }) => icon.sizes));
    expect(sizes.size).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      expect(typeof icon.src).toBe('string');
      expect(icon.src.length).toBeGreaterThan(0);
    }
  });

  it('define theme_color', () => {
    expect(typeof manifest.theme_color).toBe('string');
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });
});
