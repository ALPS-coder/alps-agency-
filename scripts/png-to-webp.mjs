// Konvertiert alle PNGs in public/marquee/ nach WebP (gleiche Optik, deutlich kleiner).
// Nutzung: node scripts/png-to-webp.mjs
import sharp from 'sharp';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirPath = fileURLToPath(new URL('../public/marquee/', import.meta.url));

const files = (await readdir(dirPath)).filter((f) => f.toLowerCase().endsWith('.png'));
let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const src = join(dirPath, file);
  const out = src.replace(/\.png$/i, '.webp');
  const before = (await stat(src)).size;
  await sharp(src).webp({ quality: 82 }).toFile(out);
  const after = (await stat(out)).size;
  await unlink(src); // Original-PNG entfernen — WebP ersetzt es
  totalBefore += before;
  totalAfter += after;
  const pct = Math.round((1 - after / before) * 100);
  console.log(`${file}  ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB  (−${pct}%)`);
}

const pctAll = Math.round((1 - totalAfter / totalBefore) * 100);
console.log(`\nGESAMT: ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB  (−${pctAll}%)`);
