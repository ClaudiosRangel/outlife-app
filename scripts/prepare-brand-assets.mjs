// Prepara os assets de marca a partir da arte oficial (LogoOutvitar.jpeg na
// raiz do projeto):
//   1. src/assets/logo-outvitar.png  -> usado pelo BrandLogo (hero/telas)
//   2. assets/logo.png (1024x1024)    -> fonte p/ @capacitor/assets (ícone app)
//   3. assets/logo-dark.png           -> idem (mesma arte)
//
// Uso: node scripts/prepare-brand-assets.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "LogoOutvitar.jpeg");

if (!existsSync(source)) {
  console.error("Arte oficial não encontrada:", source);
  process.exit(1);
}

// 1) Asset do BrandLogo (usado no app). Mantém proporção, altura grande.
const brandOut = join(root, "src", "assets", "logo-outvitar.png");
await sharp(source).resize({ height: 512, withoutEnlargement: false }).png().toFile(brandOut);
console.log("OK ->", brandOut);

// 2/3) Fonte para @capacitor/assets: precisa de assets/logo.png 1024x1024.
// Fundo branco (a arte tem fundo branco), quadrado, para o gerador recortar
// nos formatos de ícone (Android adaptive/legacy, splash, etc.).
const assetsDir = join(root, "assets");
mkdirSync(assetsDir, { recursive: true });

const square = join(assetsDir, "logo.png");
await sharp(source)
  .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(square);
console.log("OK ->", square);

// Versão "dark" (o gerador aceita logo-dark opcional). Usamos a mesma arte
// sobre o verde da marca para o modo escuro do ícone/splash.
const dark = join(assetsDir, "logo-dark.png");
await sharp(source)
  .resize(1024, 1024, { fit: "contain", background: { r: 31, g: 61, b: 43, alpha: 1 } })
  .png()
  .toFile(dark);
console.log("OK ->", dark);

console.log("Pronto. Rode: npx @capacitor/assets generate --android");
