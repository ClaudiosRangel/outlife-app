// Gera os PNGs brancos (com sombra) dos ícones de atividade usados nos
// banners OUTVITAR (Frente E / Req 8), a partir dos próprios dados de path do
// lucide-react — evita divergência com o Icon_Model_Set (activity-icons.ts).
// Rode uma vez: `node scripts/gen-activity-icons.mjs`. Os PNGs vão para
// public/activity-icons/<key>.png (128x128, stroke branco).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Mesmo mapeamento key -> nome do arquivo lucide-react do ICON_MODEL_SET.
const KEY_TO_LUCIDE = {
  run: "zap",
  walk: "footprints",
  trail: "mountain",
  bike: "bike",
  swim: "waves",
  row: "sailboat",
  climb: "mountain-snow",
  flight: "plane",
  surf: "waves",
  skate: "wind",
  activity: "activity",
};

const SIZE = 128; // px do PNG final
const STROKE = 2; // lucide desenha em viewBox 24 com stroke-width 2

// SVG customizado (não-lucide) por key. Mantido em sincronia com o componente
// React correspondente. `flight` = parapente (src/components/icons/Paraglider.tsx).
const CUSTOM_SVG_INNER = {
  // Mantido idêntico ao componente src/components/icons/Paraglider.tsx.
  flight:
    '<path d="M2 8c3-2.5 6.5-4 10-4s7 1.5 10 4" />' +
    '<path d="M8.5 5.2 7 8.5" />' +
    '<path d="M15.5 5.2 17 8.5" />' +
    '<path d="M12 4.2v4.3" />' +
    '<path d="M4.5 7.2 11 15" />' +
    '<path d="M19.5 7.2 13 15" />' +
    '<circle cx="12" cy="18" r="2" />',
};

function nodeToSvgElement([tag, attrs]) {
  const a = Object.entries(attrs)
    .filter(([k]) => k !== "key")
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `<${tag} ${a} />`;
}

async function buildIcon(key, lucideName) {
  let inner;
  if (CUSTOM_SVG_INNER[key]) {
    inner = CUSTOM_SVG_INNER[key];
  } else {
    const mod = await import(`lucide-react/dist/esm/icons/${lucideName}.js`);
    inner = mod.__iconNode.map(nodeToSvgElement).join("");
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}" fill="none" stroke="#ffffff" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

  const outDir = fileURLToPath(new URL("../public/activity-icons/", import.meta.url));
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${key}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log("gerado:", outPath);
}

for (const [key, lucideName] of Object.entries(KEY_TO_LUCIDE)) {
  await buildIcon(key, lucideName);
}
console.log("OK — todos os ícones gerados.");
