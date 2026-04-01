#!/usr/bin/env node
/**
 * Add "Billu" text to PWA icons using the NatBolt brand font (Dagger Square)
 *
 * This script overlays "Billu" text on all PWA icons so the home screen
 * icon shows both the logo and the app name.
 *
 * Usage: node scripts/add-text-to-icons.js
 */

import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register the Dagger Square font (NatBolt brand font)
const fontPath = path.join(__dirname, '../public/fonts/daggersquare.ttf');
registerFont(fontPath, { family: 'Dagger Square', weight: 'bold' });

// Icon sizes to process (all standard PWA icon sizes)
// yOffset is distance from bottom edge - increased for proper spacing
const ICON_SIZES = [
  { size: 72, fontSize: 11, yOffset: 3 },
  { size: 96, fontSize: 14, yOffset: 4 },
  { size: 128, fontSize: 18, yOffset: 5 },
  { size: 144, fontSize: 20, yOffset: 6 },
  { size: 152, fontSize: 22, yOffset: 6 },
  { size: 180, fontSize: 26, yOffset: 7 },
  { size: 192, fontSize: 28, yOffset: 8 },
  { size: 384, fontSize: 54, yOffset: 15 },
  { size: 512, fontSize: 72, yOffset: 20 },
];

// Maskable icons need extra padding (safe zone for different shapes)
const MASKABLE_SIZES = [
  { size: 192, fontSize: 26, yOffset: 8 },
  { size: 512, fontSize: 68, yOffset: 20 },
];

async function addTextToIcon(inputPath, outputPath, size, fontSize, yOffset, isMaskable = false) {
  console.log(`Processing ${path.basename(outputPath)}...`);

  // Load the original icon
  const image = await loadImage(inputPath);

  // Create canvas with same size
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Calculate icon shrink ratio to make room for text
  // Shrink icon to 82% of canvas to leave space at bottom for text
  const iconScale = 0.82;
  const iconSize = size * iconScale;
  const iconX = (size - iconSize) / 2; // Center horizontally
  const iconY = 0; // Align to top

  // Draw the original icon (scaled down)
  ctx.drawImage(image, iconX, iconY, iconSize, iconSize);

  // Configure text style
  ctx.font = `bold ${fontSize}px "Dagger Square"`;
  ctx.fillStyle = '#FFFFFF'; // White text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // Add shadow for better readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // Draw "Billu" text at the bottom center
  const text = 'Billu';
  const x = size / 2;
  const y = size - yOffset;

  ctx.fillText(text, x, y);

  // Save the new icon
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Created ${path.basename(outputPath)}`);
}

async function processAllIcons() {
  const iconsDir = path.join(__dirname, '../public/icons');
  const backupDir = path.join(__dirname, '../public/icons/backup');

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('Created backup directory');
  }

  console.log('\n🎨 Adding "Billu" text to PWA icons...\n');

  // Process standard icons
  for (const { size, fontSize, yOffset } of ICON_SIZES) {
    const filename = `icon-${size}.png`;
    const inputPath = path.join(iconsDir, filename);
    const backupPath = path.join(backupDir, filename);
    const outputPath = path.join(iconsDir, filename);

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Skipping ${filename} (not found)`);
      continue;
    }

    // Backup original if not already backed up
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(inputPath, backupPath);
      console.log(`  Backed up original to backup/${filename}`);
    }

    await addTextToIcon(inputPath, outputPath, size, fontSize, yOffset);
  }

  // Process maskable icons (with safe zone padding)
  for (const { size, fontSize, yOffset } of MASKABLE_SIZES) {
    const filename = `icon-${size}-maskable.png`;
    const inputPath = path.join(iconsDir, filename);
    const backupPath = path.join(backupDir, filename);
    const outputPath = path.join(iconsDir, filename);

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Skipping ${filename} (not found)`);
      continue;
    }

    // Backup original if not already backed up
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(inputPath, backupPath);
      console.log(`  Backed up original to backup/${filename}`);
    }

    await addTextToIcon(inputPath, outputPath, size, fontSize, yOffset, true);
  }

  console.log('\n✅ Done! All icons updated with "Billu" text.');
  console.log('📁 Original icons backed up to public/icons/backup/\n');
}

// Run the script
processAllIcons().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
