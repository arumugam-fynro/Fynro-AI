import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });
const svg = (size, pad) => {
  const r = Math.round(size * 0.22);
  const box = Math.round(size * (1 - pad * 2));
  const x = Math.round((size - box) / 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="#050506"/>
<rect x="${x}" y="${x}" width="${box}" height="${box}" rx="${r}" fill="#f4f4f5"/>
<text x="${size / 2}" y="${size / 2 + box * 0.19}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="${box * 0.56}" fill="#0a0a0b">F</text>
</svg>`);
};
const out = [
  ['icon-192.png', 192, 0.14], ['icon-512.png', 512, 0.14],
  ['icon-maskable-512.png', 512, 0.24], ['apple-touch-icon.png', 180, 0.14],
];
for (const [name, size, pad] of out) {
  await sharp(svg(size, pad)).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
  console.log('wrote', name);
}
