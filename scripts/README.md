# Icon Generation Scripts

## Add "Billu" Text to PWA Icons

The `add-text-to-icons.js` script overlays "Billu" text on all PWA icons using the Dagger Square brand font.

### Usage

```bash
npm run icons:add-text
```

This will:
- Add "Billu" text to all icon sizes (72px to 512px)
- Add text to maskable icons (with safe zone padding)
- Backup original icons to `public/icons/backup/` before modifying
- Use white text with shadow for readability
- Scale font size proportionally for each icon size

### Restore Original Icons

If you need to restore the original icons without text:

```bash
npm run icons:restore
```

### Icon Sizes Processed

**Standard Icons:**
- 72×72, 96×96, 128×128, 144×144, 152×152
- 180×180 (iOS), 192×192, 384×384, 512×512

**Maskable Icons** (with safe zone):
- 192×192, 512×512

### Font Used

The script uses **Dagger Square** (NatBolt brand font) in bold, loaded from:
`public/fonts/daggersquare.ttf`

### Text Styling

- **Color:** White (#FFFFFF)
- **Position:** Bottom center of icon
- **Shadow:** Black shadow with blur for readability
- **Font Size:** Scales from 14px (72px icon) to 96px (512px icon)

### Technical Details

The script uses the `canvas` package to:
1. Load the original PNG icon
2. Draw it on a canvas
3. Add text overlay with the Dagger Square font
4. Save as PNG with the same filename

### Backup Safety

Original icons are automatically backed up to `public/icons/backup/` on the first run. The script will not overwrite existing backups, ensuring you can always restore the originals.
