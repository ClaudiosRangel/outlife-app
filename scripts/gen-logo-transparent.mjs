// Gera uma versão TRANSPARENTE da logo a partir da arte oficial
// (LogoOutvitar.jpeg, fundo branco). Remove o branco → alpha, para a logo
// ficar bonita sobre foto (hero). Salva em src/assets/logo-outvitar.png
// (substitui a versão com fundo).
//
// Uso: node scripts/gen-logo-transparent.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "LogoOutvitar.jpeg");
const out = join(root, "src", "assets", "logo-outvitar.png");

if (!existsSync(source)) {
  console.error("Arte não encontrada:", source);
  process.exit(1);
}

// Estratégia: ler RGB, e para cada pixel quase-branco (todos os canais > 240),
// zerar o alpha (transparente). Mantém o miolo colorido (verde/laranja) intacto.
const img = sharp(source).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const THRESHOLD = 238; // acima disso em R,G,B => considerado fundo branco
for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
    data[i + 3] = 0; // alpha = transparente
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  .resize({ height: 512, withoutEnlargement: false })
  .toFile(out);

console.log("Logo transparente gerada em", out, `(${width}x${height} fonte)`);
