import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// SVG corporativo: gradiente azul oscuro con iniciales "SI" y un edificio estilizado
function svg(size, maskable = false) {
  const pad = maskable ? size * 0.1 : 0;
  const inner = size - pad * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e3a5f"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="building" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" rx="${maskable ? 0 : size * 0.18}"/>
  <g transform="translate(${pad},${pad})">
    <!-- Edificio -->
    <rect x="${inner * 0.22}" y="${inner * 0.32}" width="${inner * 0.18}" height="${inner * 0.5}" fill="url(#building)" rx="${inner * 0.01}"/>
    <rect x="${inner * 0.41}" y="${inner * 0.22}" width="${inner * 0.18}" height="${inner * 0.6}" fill="url(#building)" rx="${inner * 0.01}"/>
    <rect x="${inner * 0.60}" y="${inner * 0.28}" width="${inner * 0.18}" height="${inner * 0.54}" fill="url(#building)" rx="${inner * 0.01}"/>
    <!-- Ventanas -->
    <g fill="#fbbf24" opacity="0.85">
      ${[0.36, 0.44, 0.52, 0.60, 0.68, 0.76].map(y =>
        [0.26, 0.32, 0.45, 0.51, 0.64, 0.70].map(x =>
          `<rect x="${inner * x}" y="${inner * y}" width="${inner * 0.03}" height="${inner * 0.04}"/>`
        ).join('')
      ).join('')}
    </g>
    <!-- Iniciales SI -->
    <text x="${inner * 0.5}" y="${inner * 0.95}" font-family="Arial, sans-serif" font-size="${inner * 0.12}" font-weight="bold" fill="#ffffff" text-anchor="middle">SANTA ISABEL</text>
  </g>
</svg>`;
}

async function generate() {
  const sizes = [
    { name: 'icon-192.png', size: 192, maskable: false },
    { name: 'icon-512.png', size: 512, maskable: false },
    { name: 'icon-maskable-512.png', size: 512, maskable: true },
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
    { name: 'favicon-32.png', size: 32, maskable: false },
    { name: 'favicon-16.png', size: 16, maskable: false },
  ];
  for (const { name, size, maskable } of sizes) {
    const svgBuf = Buffer.from(svg(size, maskable));
    await sharp(svgBuf).png().toFile(join(outDir, name));
    console.log(`✓ ${name} (${size}x${size})`);
  }
  // Favicon ICO (use 32px PNG as fallback — most browsers accept PNG-in-ICO)
  await sharp(Buffer.from(svg(32))).png().toFile(join(outDir, '..', 'favicon.ico'));
  console.log('✓ favicon.ico');
}

generate().catch(e => { console.error(e); process.exit(1); });
