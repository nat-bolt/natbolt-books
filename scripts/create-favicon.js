#!/usr/bin/env node
/**
 * Create favicon sizes from logo.png (icon only, no text)
 * Generates 16x16 and 32x32 favicons for browser tabs
 *
 * Why different sizes?
 * - 16×16: Standard browser tabs on regular displays
 * - 32×32: High-DPI displays (Retina, 4K) for sharp rendering
 *
 * Without both sizes, browsers will scale the icon which causes blurriness.
 *
 * Usage: node scripts/create-favicon.js
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FAVICON_SIZES = [16, 32];

async function createFavicon(inputPath, size) {
  console.log(`Creating ${size}×${size} favicon...`);

  const image = await loadImage(inputPath);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Use high-quality smoothing for small icons
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, size, size);

  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(__dirname, `../public/icons/favicon-${size}.png`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Created favicon-${size}.png`);
}

async function main() {
  const iconsDir = path.join(__dirname, '../public/icons');
  const logoPath = path.join(iconsDir, 'logo.png');

  if (!fs.existsSync(logoPath)) {
    console.error('❌ Error: logo.png not found in public/icons/');
    console.error('💡 Tip: logo.png should be the icon WITHOUT "Billu" text');
    process.exit(1);
  }

  console.log('\n🎨 Creating favicon sizes from logo.png (icon only, no text)...\n');

  for (const size of FAVICON_SIZES) {
    await createFavicon(logoPath, size);
  }

  console.log('\n✅ Done! Favicons created for browser tabs');
  console.log('📱 Browser tabs will show icon only (no text)\n');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
