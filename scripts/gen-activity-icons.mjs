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
  activity: "activity",
};

const SIZE = 128; // px do PNG final
const STROKE = 2; // lucide desenha em viewBox 24 com stroke-width 2

function nodeToSvgElement([tag, attrs]) {
  const a = Object.entries(attrs)
    .filter(([k]) => k !== "key")
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `<${tag} ${a} />`;
}

async function buildIcon(key, lucideName) {
  const mod = await import(`lucide-react/dist/esm/icons/${lucideName}.js`);
  const iconNode = mod.__iconNode;
  const inner = iconNode.map(nodeToSvgElement).join("");
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
