# NeuroGrid Product Hunt Assets - README

This directory contains all the media assets and materials needed for the NeuroGrid Product Hunt launch.

## Directory Structure

```
product-hunt/
├── PRODUCT_HUNT_LAUNCH.md      # Complete launch materials & checklists
├── README_ASSETS.md            # This file - Asset instructions
├── generate_assets.sh          # Asset export script
└── assets/
    ├── logo-placeholder.svg           # Logo (240x240)
    ├── hero-placeholder.svg           # Hero image (1270x760)
    ├── screenshot1-placeholder.svg    # Compute Node Dashboard
    ├── screenshot2-placeholder.svg    # Analytics & Monitoring
    ├── screenshot3-placeholder.svg    # Deployment Interface
    └── exports/                       # Generated exports (created by script)
        ├── logo.png
        ├── logo-1024.png
        ├── hero.png
        ├── hero.webp
        ├── hero.jpg
        ├── screenshot1.png
        ├── screenshot1.webp
        ├── screenshot2.png
        ├── screenshot2.webp
        ├── screenshot3.png
        ├── screenshot3.webp
        ├── demo.gif
        ├── demo-preview.mp4
        ├── social-twitter.png
        ├── social-facebook.png
        └── social-instagram.png
```

## Asset Files

### Placeholder SVG Files

The `assets/` directory contains SVG placeholder files for all required media:

1. **logo-placeholder.svg** - NeuroGrid logo with neural network design
2. **hero-placeholder.svg** - Main product showcase with dashboard and network visualization
3. **screenshot1-placeholder.svg** - Compute node dashboard interface
4. **screenshot2-placeholder.svg** - Analytics and monitoring dashboard
5. **screenshot3-placeholder.svg** - Deployment interface with configuration

These are **placeholder** files with generic designs. For the actual launch, you should:
- Replace with real screenshots from the application
- Update with actual branding and UI designs
- Ensure all text is readable and colors match brand guidelines

## Generating Exports

### Prerequisites

Install required dependencies:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install librsvg2-bin imagemagick ffmpeg
pip3 install gtts  # Optional, for future video narration
```

**macOS:**
```bash
brew install librsvg imagemagick ffmpeg
pip3 install gtts  # Optional, for future video narration
```

**Arch Linux:**
```bash
sudo pacman -S librsvg imagemagick ffmpeg
pip3 install gtts  # Optional
```

### Running the Export Script

From the repository root:

```bash
cd product-hunt
./generate_assets.sh
```

Or from anywhere:

```bash
/path/to/neurogrid/product-hunt/generate_assets.sh
```

The script will:
1. Check for required dependencies
2. Export all SVG files to PNG format (Product Hunt requirements)
3. Generate WebP versions for web optimization
4. Create social media variants (Twitter, Facebook, Instagram)
5. Generate an animated GIF from screenshots
6. Create a simple video preview (optional)
7. Output all files to `assets/exports/`

### Generated File Formats

| File | Format | Size | Purpose |
|------|--------|------|---------|
| logo.png | PNG | 240x240 | Product Hunt logo |
| logo-1024.png | PNG | 1024x1024 | High-res logo |
| hero.png | PNG | 1270x760 | Product Hunt hero image |
| hero.webp | WebP | 1270x760 | Web-optimized hero |
| hero.jpg | JPEG | 1270x760 | Alternative format |
| screenshot1.png | PNG | 1270x760 | PH gallery image 1 |
| screenshot1.webp | WebP | 1270x760 | Web-optimized |
| screenshot2.png | PNG | 1270x760 | PH gallery image 2 |
| screenshot2.webp | WebP | 1270x760 | Web-optimized |
| screenshot3.png | PNG | 1270x760 | PH gallery image 3 |
| screenshot3.webp | WebP | 1270x760 | Web-optimized |
| demo.gif | GIF | 1270x760 | Animated demo |
| demo-preview.mp4 | MP4 | 1270x760 | Video preview |
| social-twitter.png | PNG | 1200x628 | Twitter card |
| social-facebook.png | PNG | 1200x630 | Facebook/LinkedIn |
| social-instagram.png | PNG | 1080x1080 | Instagram post |

## Product Hunt Requirements

### Logo
- **Size:** 240x240 pixels (exact)
- **Format:** PNG
- **File:** `exports/logo.png`
- **Notes:** Should have transparent background or solid color

### Hero Image
- **Size:** 1270x760 pixels (recommended)
- **Format:** PNG or JPEG
- **File:** `exports/hero.png`
- **Notes:** Main product showcase, first impression

### Gallery Images
- **Size:** 1270x760 pixels (recommended)
- **Format:** PNG or JPEG
- **Count:** 3-6 images recommended
- **Files:** 
  - `exports/screenshot1.png` - Compute dashboard
  - `exports/screenshot2.png` - Analytics
  - `exports/screenshot3.png` - Deployment
- **Notes:** Show key features and interface

### Video (Optional)
- **Size:** 1270x760 pixels or 16:9 aspect ratio
- **Format:** MP4, MOV, or YouTube link
- **Duration:** 30-60 seconds recommended
- **File:** `exports/demo-preview.mp4` (basic version)
- **Notes:** Create a proper demo video for better engagement

## Customization Guide

### Updating Placeholder SVGs

To customize the placeholder SVGs with actual designs:

1. **Edit SVG files directly** in a text editor or vector graphics tool (Inkscape, Figma, Adobe Illustrator)
2. **Replace with screenshots:**
   - Launch the application
   - Take screenshots at 1270x760 resolution
   - Replace placeholder SVG files with actual PNG screenshots
   - Rename PNG files with `.svg` extension or update script

3. **Use design tools:**
   - Export from Figma/Sketch at 2x resolution (2540x1520)
   - Downscale to 1270x760 in export script
   - Maintains crisp quality on retina displays

### Adding Real Screenshots

For actual product screenshots:

1. Set browser/window to exact size: 1270x760 pixels
2. Use browser dev tools to set viewport
3. Hide scrollbars and unnecessary UI elements
4. Capture screenshots using:
   - macOS: Cmd+Shift+4 (select area)
   - Windows: Snipping Tool or Win+Shift+S
   - Linux: Screenshot tool or `gnome-screenshot`

5. Replace placeholder SVG files with PNG screenshots
6. Update `generate_assets.sh` if needed

### Video Creation Tips

For a professional Product Hunt video:

1. **Script:** Use the script in `PRODUCT_HUNT_LAUNCH.md`
2. **Duration:** 30-60 seconds
3. **Format:** MP4, 16:9 aspect ratio
4. **Content:**
   - Show key features
   - Demonstrate ease of use
   - Highlight unique value proposition
5. **Tools:**
   - Screen recording: OBS Studio, QuickTime, Loom
   - Editing: iMovie, Final Cut, Adobe Premiere
   - Animation: After Effects, Motion

## Committing Exports

After generating exports:

```bash
git add product-hunt/assets/exports/
git commit -m "Add Product Hunt media exports"
git push
```

Then update the PR with the new assets.

## File Size Optimization

If exported files are too large:

### PNG Optimization
```bash
# Install optipng
sudo apt-get install optipng  # Ubuntu/Debian
brew install optipng          # macOS

# Optimize PNGs
optipng -o7 exports/*.png
```

### JPEG Optimization
```bash
# Install jpegoptim
sudo apt-get install jpegoptim  # Ubuntu/Debian
brew install jpegoptim          # macOS

# Optimize JPEGs
jpegoptim --max=85 exports/*.jpg
```

### WebP Conversion
```bash
# Install webp tools
sudo apt-get install webp  # Ubuntu/Debian
brew install webp          # macOS

# Convert to WebP
for f in exports/*.png; do
    cwebp -q 90 "$f" -o "${f%.png}.webp"
done
```

## Troubleshooting

### "rsvg-convert: command not found"
Install librsvg2-bin:
```bash
sudo apt-get install librsvg2-bin
```

### "convert: command not found"
Install ImageMagick:
```bash
sudo apt-get install imagemagick
```

### "ffmpeg: command not found"
Install FFmpeg:
```bash
sudo apt-get install ffmpeg
```

### ImageMagick security policy errors
Edit `/etc/ImageMagick-6/policy.xml` (or similar path) and comment out restrictive policies:
```xml
<!-- <policy domain="path" rights="none" pattern="@*"/> -->
```

### Script permission denied
Make script executable:
```bash
chmod +x generate_assets.sh
```

## Next Steps

1. **Review Exports:** Check all generated files for quality
2. **Create Video:** Produce a professional demo video (optional but recommended)
3. **Update PR:** Add exports to repository and update pull request
4. **Upload to Product Hunt:** Use files in draft submission
5. **Test Display:** Verify all images display correctly in Product Hunt preview

## Support

For issues or questions:
- Check Product Hunt's [media guidelines](https://www.producthunt.com/makers/guidelines)
- Review the main launch document: `PRODUCT_HUNT_LAUNCH.md`
- Create an issue in the repository

---

**Ready to launch!** 🚀

After running `./generate_assets.sh`, all required media files will be in the `assets/exports/` directory and ready for upload to Product Hunt.
