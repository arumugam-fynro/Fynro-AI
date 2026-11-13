// Builds every icon from design/logo-source.png (the Fynro mark on a white page).
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const SRC = 'design/logo-source.png';
const BOX = { left: 77, top: 95, width: 443, height: 442 }; // squircle bounds inside the source image
mkdirSync('public/icons', { recursive: true });

const side = Math.min(BOX.width, BOX.height);
const crop = () => sharp(SRC).extract({ ...BOX, width: side, height: side });
const squircle = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s * 0.225}" fill="#fff"/></svg>`);

// Transparent-cornered mark (removes the white page behind the rounded corners)
const mark = async (s) =>
  sharp(await crop().resize(s, s).png().toBuffer()).composite([{ input: squircle(s), blend: 'dest-in' }]).png({ compressionLevel: 9 }).toBuffer();

// Full-bleed square for maskable icons / iOS (OS applies its own mask): crop inside the corners and fill.
const bleed = async (s) => {
  const inset = Math.round(side * 0.1);
  return sharp(SRC).extract({ left: BOX.left + inset, top: BOX.top + inset, width: side - inset * 2, height: side - inset * 2 }).resize(s, s).png({ compressionLevel: 9 }).toBuffer();
};

const files = {
  'public/icons/icon-192.png': await mark(192),
  'public/icons/icon-512.png': await mark(512),
  'public/icons/logo.png': await mark(128),
  'public/icons/icon-maskable-512.png': await bleed(512),
  'public/icons/apple-touch-icon.png': await bleed(180),
  'public/icons/favicon-32.png': await mark(32),
};
for (const [p, b] of Object.entries(files)) { writeFileSync(p, b); console.log('wrote', p); }

// favicon.ico (PNG-in-ICO, 48px) for browsers that request /favicon.ico directly
const png = await mark(48);
const hdr = Buffer.alloc(22);
hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4);
hdr[6] = 48; hdr[7] = 48; hdr.writeUInt16LE(1, 10); hdr.writeUInt16LE(32, 12);
hdr.writeUInt32LE(png.length, 14); hdr.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([hdr, png]));
console.log('wrote public/favicon.ico');
