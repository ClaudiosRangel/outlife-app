// Gera um placeholder on-brand da logo OutVitar (montanha + sol + trilha no
// pin), em PNG 1024x1024, a partir de um SVG. É só um PLACEHOLDER para o build
// não quebrar e já ficar apresentável — substitua src/assets/logo-outvitar.png
// pela arte oficial quando ela estiver pronta.
//
// Uso: node scripts/gen-logo-placeholder.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "src", "assets", "logo-outvitar.png");

const GREEN = "#1F3D2B";
const SUN = "#E8821E";

// Símbolo: pin arredondado com montanhas + sol + trilha sinuosa. Fundo
// transparente para funcionar sobre foto (hero) e sobre branco.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <clipPath id="pin">
      <path d="M512 120
               C 700 120 840 260 840 448
               C 840 640 560 900 512 900
               C 464 900 184 640 184 448
               C 184 260 324 120 512 120 Z"/>
    </clipPath>
  </defs>

  <!-- Arco do pin -->
  <path d="M512 120
           C 700 120 840 260 840 448
           C 840 640 560 900 512 900
           C 464 900 184 640 184 448
           C 184 260 324 120 512 120 Z"
        fill="none" stroke="${GREEN}" stroke-width="34"/>

  <g clip-path="url(#pin)">
    <!-- Sol -->
    <circle cx="512" cy="360" r="58" fill="${SUN}"/>
    <!-- Montanhas -->
    <path d="M200 560 L 420 360 L 560 500 L 720 340 L 860 560 Z" fill="${GREEN}"/>
    <!-- Trilha sinuosa em branco -->
    <path d="M500 560 C 470 640 560 700 520 780 C 500 830 540 860 512 900"
          fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log("Logo placeholder gerada em", out);
