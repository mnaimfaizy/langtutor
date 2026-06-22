// Generates placeholder PWA icons into public/icons. Run: `node scripts/generate-icons.mjs`.
// A minimal white "L" mark on the accent indigo; real artwork is a Phase 8.4 task.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const OUT = "public/icons";
const ACCENT = { r: 0x4f, g: 0x46, b: 0xe5, alpha: 1 };

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#4f46e5"/>
  <rect x="170" y="120" width="46" height="244" rx="14" fill="#ffffff"/>
  <rect x="170" y="318" width="180" height="46" rx="14" fill="#ffffff"/>
</svg>`;

async function render(size, file) {
  try {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`${OUT}/${file}`);
  } catch {
    // Fallback if this sharp build lacks SVG rasterization: solid accent square.
    await sharp({ create: { width: size, height: size, channels: 4, background: ACCENT } })
      .png()
      .toFile(`${OUT}/${file}`);
  }
}

await mkdir(OUT, { recursive: true });
await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(512, "icon-512-maskable.png");
console.log("Wrote icons to", OUT);
