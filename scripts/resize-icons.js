#!/usr/bin/env node
/**
 * Resize icon-Name.png to all required PWA icon sizes
 *
 * This script takes the master icon (icon-Name.png at 512x512) and resizes it
 * to all standard PWA icon sizes while maintaining quality.
 *
 * Usage: node scripts/resize-icons.js
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All required icon sizes for PWA
const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

async function resizeIcon(inputPath, outputPath, size) {
  console.log(`Creating ${size}×${size} icon...`);

  // Load the source image
  const image = await loadImage(inputPath);

  // Create canvas with target size
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the resized image
  ctx.drawImage(image, 0, 0, size, size);

  // Save the resized icon
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Created ${path.basename(outputPath)}`);
}

async function processAllIcons() {
  const iconsDir = path.join(__dirname, '../public/icons');
  const masterIcon = path.join(iconsDir, 'icon-Name.png');

  // Check if master icon exists
  if (!fs.existsSync(masterIcon)) {
    console.error('❌ Error: icon-Name.png not found in public/icons/');
    process.exit(1);
  }

  console.log('\n🎨 Resizing icon-Name.png to all PWA sizes...\n');

  // Process standard icons
  for (const size of SIZES) {
    const outputPath = path.join(iconsDir, `icon-${size}.png`);
    await resizeIcon(masterIcon, outputPath, size);
  }

  // Process maskable icons
  for (const size of MASKABLE_SIZES) {
    const outputPath = path.join(iconsDir, `icon-${size}-maskable.png`);
    await resizeIcon(masterIcon, outputPath, size);
  }

  console.log('\n✅ Done! All icons generated from icon-Name.png');
  console.log('📱 Icons ready for PWA deployment\n');
}

// Run the script
processAllIcons().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
