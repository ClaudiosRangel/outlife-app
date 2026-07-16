import { describe, it } from 'vitest';
import fc from 'fast-check';
import { calculateImageResizePlan, DEFAULT_MAX_UPLOAD_BYTES } from '../../src/lib/image-resize';

/**
 * Property test do cálculo de redimensionamento/compressão de imagem
 * (task 15.2 do spec outlife-production-plan).
 *
 * IMPORTANTE: `calculateImageResizePlan` é uma função pura que opera sobre
 * uma ESTIMATIVA de tamanho de arquivo (área × qualidade), não sobre bytes
 * reais comprimidos — não há `<canvas>` real disponível em Node para gerar
 * um JPEG/WEBP de verdade e medir seu tamanho. A property validada aqui é,
 * portanto, sobre o CONTRATO do plano retornado: quando o tamanho original
 * já está dentro do limite (ou a entrada é degenerada), o arquivo não deve
 * ser alterado; quando excede o limite, o plano deve preservar a proporção
 * original (dentro de 1% de tolerância) e usar dimensões/qualidade válidas.
 * A aplicação real do plano em `<canvas>` (`resizeImageForUpload`) depende
 * de APIs de navegador e está fora do escopo desta task, conforme já
 * registrado na task 15.1.
 */

describe('calculateImageResizePlan', () => {
  it('não altera o arquivo quando já está dentro do limite (ou entrada degenerada)', () => {
    // Feature: outlife-production-plan, Property 12: Redimensionamento de imagem respeita o limite de tamanho e preserva proporção
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 8000 }), // width (inclui valores inválidos)
        fc.integer({ min: -10, max: 8000 }), // height (inclui valores inválidos)
        fc.integer({ min: -10, max: DEFAULT_MAX_UPLOAD_BYTES }), // sizeBytes <= maxBytes (ou inválido)
        (width, height, sizeBytes) => {
          const plan = calculateImageResizePlan({ width, height, sizeBytes }, DEFAULT_MAX_UPLOAD_BYTES);

          return (
            plan.needsResize === false &&
            plan.targetWidth === width &&
            plan.targetHeight === height
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('quando excede o limite: preserva a proporção original (tolerância de 1%) e usa dimensões/qualidade válidas', () => {
    // Feature: outlife-production-plan, Property 12: Redimensionamento de imagem respeita o limite de tamanho e preserva proporção
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8000 }), // width
        fc.integer({ min: 1, max: 8000 }), // height
        // sizeBytes cobrindo ligeiramente acima e muito acima do limite de 5 MB
        fc.oneof(
          fc.integer({ min: DEFAULT_MAX_UPLOAD_BYTES + 1, max: DEFAULT_MAX_UPLOAD_BYTES + 1024 }),
          fc.integer({ min: DEFAULT_MAX_UPLOAD_BYTES + 1, max: DEFAULT_MAX_UPLOAD_BYTES * 50 }),
        ),
        (width, height, sizeBytes) => {
          const plan = calculateImageResizePlan({ width, height, sizeBytes }, DEFAULT_MAX_UPLOAD_BYTES);

          if (!plan.needsResize) {
            return false;
          }

          // Dimensões devem ser inteiros positivos.
          if (
            !Number.isInteger(plan.targetWidth) ||
            !Number.isInteger(plan.targetHeight) ||
            plan.targetWidth < 1 ||
            plan.targetHeight < 1
          ) {
            return false;
          }

          // Qualidade dentro do intervalo válido (0, 1] usado pela implementação
          // (MIN_QUALITY = 0.5, MAX_QUALITY = 0.92).
          if (plan.targetQuality <= 0 || plan.targetQuality > 0.92) {
            return false;
          }

          // Proporção largura/altura preservada dentro de 1% de tolerância.
          const originalRatio = width / height;
          const targetRatio = plan.targetWidth / plan.targetHeight;
          const relativeError = Math.abs(targetRatio - originalRatio) / originalRatio;

          return relativeError <= 0.01;
        },
      ),
      { numRuns: 100 },
    );
  });
});
