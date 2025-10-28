#!/bin/bash

##############################################################################
# NeuroGrid Product Hunt Asset Generation Script
# 
# This script exports placeholder SVG files to various formats required for
# Product Hunt and social media platforms.
#
# Requirements:
#   - rsvg-convert (librsvg2-bin package)
#   - imagemagick (convert command)
#   - ffmpeg (for video/GIF generation)
#   - python3 with gTTS (optional, for video narration)
#
# Install on Ubuntu/Debian:
#   sudo apt-get install librsvg2-bin imagemagick ffmpeg
#   pip3 install gtts
#
# Install on macOS:
#   brew install librsvg imagemagick ffmpeg
#   pip3 install gtts
##############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/assets"
EXPORT_DIR="$ASSETS_DIR/exports"

# Create export directory
mkdir -p "$EXPORT_DIR"

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}  NeuroGrid Product Hunt Asset Export Tool${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""

##############################################################################
# Check dependencies
##############################################################################

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}✗ $1 not found${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $1 found${NC}"
        return 0
    fi
}

echo -e "${YELLOW}Checking dependencies...${NC}"
MISSING_DEPS=0

check_command "rsvg-convert" || MISSING_DEPS=1
check_command "convert" || MISSING_DEPS=1
check_command "ffmpeg" || MISSING_DEPS=1

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo -e "${RED}Missing required dependencies. Please install them first.${NC}"
    echo -e "${YELLOW}Ubuntu/Debian:${NC} sudo apt-get install librsvg2-bin imagemagick ffmpeg"
    echo -e "${YELLOW}macOS:${NC} brew install librsvg imagemagick ffmpeg"
    exit 1
fi

echo ""

##############################################################################
# Export Logo (240x240)
##############################################################################

echo -e "${YELLOW}Exporting logo...${NC}"

if [ -f "$ASSETS_DIR/logo-placeholder.svg" ]; then
    # PNG for Product Hunt
    rsvg-convert -w 240 -h 240 "$ASSETS_DIR/logo-placeholder.svg" \
        -o "$EXPORT_DIR/logo.png"
    echo -e "${GREEN}✓ Created logo.png (240x240)${NC}"
    
    # High-res version
    rsvg-convert -w 1024 -h 1024 "$ASSETS_DIR/logo-placeholder.svg" \
        -o "$EXPORT_DIR/logo-1024.png"
    echo -e "${GREEN}✓ Created logo-1024.png (1024x1024)${NC}"
else
    echo -e "${RED}✗ logo-placeholder.svg not found${NC}"
fi

##############################################################################
# Export Hero Image (1270x760)
##############################################################################

echo ""
echo -e "${YELLOW}Exporting hero image...${NC}"

if [ -f "$ASSETS_DIR/hero-placeholder.svg" ]; then
    # PNG for Product Hunt
    rsvg-convert -w 1270 -h 760 "$ASSETS_DIR/hero-placeholder.svg" \
        -o "$EXPORT_DIR/hero.png"
    echo -e "${GREEN}✓ Created hero.png (1270x760)${NC}"
    
    # WebP for web optimization
    convert "$EXPORT_DIR/hero.png" -quality 90 "$EXPORT_DIR/hero.webp"
    echo -e "${GREEN}✓ Created hero.webp (1270x760)${NC}"
    
    # JPEG version
    convert "$EXPORT_DIR/hero.png" -quality 95 "$EXPORT_DIR/hero.jpg"
    echo -e "${GREEN}✓ Created hero.jpg (1270x760)${NC}"
else
    echo -e "${RED}✗ hero-placeholder.svg not found${NC}"
fi

##############################################################################
# Export Screenshot 1 (1270x760)
##############################################################################

echo ""
echo -e "${YELLOW}Exporting screenshot 1 (Compute Node Dashboard)...${NC}"

if [ -f "$ASSETS_DIR/screenshot1-placeholder.svg" ]; then
    rsvg-convert -w 1270 -h 760 "$ASSETS_DIR/screenshot1-placeholder.svg" \
        -o "$EXPORT_DIR/screenshot1.png"
    echo -e "${GREEN}✓ Created screenshot1.png (1270x760)${NC}"
    
    convert "$EXPORT_DIR/screenshot1.png" -quality 90 "$EXPORT_DIR/screenshot1.webp"
    echo -e "${GREEN}✓ Created screenshot1.webp (1270x760)${NC}"
else
    echo -e "${RED}✗ screenshot1-placeholder.svg not found${NC}"
fi

##############################################################################
# Export Screenshot 2 (1270x760)
##############################################################################

echo ""
echo -e "${YELLOW}Exporting screenshot 2 (Analytics & Monitoring)...${NC}"

if [ -f "$ASSETS_DIR/screenshot2-placeholder.svg" ]; then
    rsvg-convert -w 1270 -h 760 "$ASSETS_DIR/screenshot2-placeholder.svg" \
        -o "$EXPORT_DIR/screenshot2.png"
    echo -e "${GREEN}✓ Created screenshot2.png (1270x760)${NC}"
    
    convert "$EXPORT_DIR/screenshot2.png" -quality 90 "$EXPORT_DIR/screenshot2.webp"
    echo -e "${GREEN}✓ Created screenshot2.webp (1270x760)${NC}"
else
    echo -e "${RED}✗ screenshot2-placeholder.svg not found${NC}"
fi

##############################################################################
# Export Screenshot 3 (1270x760)
##############################################################################

echo ""
echo -e "${YELLOW}Exporting screenshot 3 (Deployment Interface)...${NC}"

if [ -f "$ASSETS_DIR/screenshot3-placeholder.svg" ]; then
    rsvg-convert -w 1270 -h 760 "$ASSETS_DIR/screenshot3-placeholder.svg" \
        -o "$EXPORT_DIR/screenshot3.png"
    echo -e "${GREEN}✓ Created screenshot3.png (1270x760)${NC}"
    
    convert "$EXPORT_DIR/screenshot3.png" -quality 90 "$EXPORT_DIR/screenshot3.webp"
    echo -e "${GREEN}✓ Created screenshot3.webp (1270x760)${NC}"
else
    echo -e "${RED}✗ screenshot3-placeholder.svg not found${NC}"
fi

##############################################################################
# Generate Animated GIF (optional)
##############################################################################

echo ""
echo -e "${YELLOW}Generating animated GIF from screenshots...${NC}"

if [ -f "$EXPORT_DIR/screenshot1.png" ] && \
   [ -f "$EXPORT_DIR/screenshot2.png" ] && \
   [ -f "$EXPORT_DIR/screenshot3.png" ]; then
    
    convert -delay 200 -loop 0 \
        "$EXPORT_DIR/screenshot1.png" \
        "$EXPORT_DIR/screenshot2.png" \
        "$EXPORT_DIR/screenshot3.png" \
        -resize 1270x760 \
        "$EXPORT_DIR/demo.gif"
    echo -e "${GREEN}✓ Created demo.gif (animated)${NC}"
    
    # Optimize GIF size
    if command -v gifsicle &> /dev/null; then
        gifsicle -O3 "$EXPORT_DIR/demo.gif" -o "$EXPORT_DIR/demo-optimized.gif"
        echo -e "${GREEN}✓ Created demo-optimized.gif${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping GIF generation (missing screenshots)${NC}"
fi

##############################################################################
# Generate Video Preview (optional)
##############################################################################

echo ""
echo -e "${YELLOW}Generating video preview...${NC}"

if [ -f "$EXPORT_DIR/screenshot1.png" ] && \
   [ -f "$EXPORT_DIR/screenshot2.png" ] && \
   [ -f "$EXPORT_DIR/screenshot3.png" ]; then
    
    # Create a simple slideshow video
    ffmpeg -y -framerate 1/3 -i "$EXPORT_DIR/screenshot%d.png" \
        -c:v libx264 -pix_fmt yuv420p -vf "scale=1270:760" \
        -t 9 "$EXPORT_DIR/demo-preview.mp4" 2>/dev/null || \
        echo -e "${YELLOW}⚠ Video generation failed (this is optional)${NC}"
    
    if [ -f "$EXPORT_DIR/demo-preview.mp4" ]; then
        echo -e "${GREEN}✓ Created demo-preview.mp4 (9 seconds)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping video generation (missing screenshots)${NC}"
fi

##############################################################################
# Social Media Variants
##############################################################################

echo ""
echo -e "${YELLOW}Generating social media variants...${NC}"

if [ -f "$EXPORT_DIR/hero.png" ]; then
    # Twitter/X card (1200x628)
    convert "$EXPORT_DIR/hero.png" -resize 1200x628^ -gravity center -extent 1200x628 \
        "$EXPORT_DIR/social-twitter.png"
    echo -e "${GREEN}✓ Created social-twitter.png (1200x628)${NC}"
    
    # Facebook/LinkedIn (1200x630)
    convert "$EXPORT_DIR/hero.png" -resize 1200x630^ -gravity center -extent 1200x630 \
        "$EXPORT_DIR/social-facebook.png"
    echo -e "${GREEN}✓ Created social-facebook.png (1200x630)${NC}"
    
    # Instagram square (1080x1080)
    convert "$EXPORT_DIR/hero.png" -resize 1080x1080^ -gravity center -extent 1080x1080 \
        "$EXPORT_DIR/social-instagram.png"
    echo -e "${GREEN}✓ Created social-instagram.png (1080x1080)${NC}"
fi

##############################################################################
# Summary
##############################################################################

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}✓ Asset export complete!${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo -e "Output directory: ${YELLOW}$EXPORT_DIR${NC}"
echo ""
echo -e "${YELLOW}Generated files:${NC}"
ls -lh "$EXPORT_DIR" | tail -n +2 | awk '{printf "  - %-30s %s\n", $9, $5}'
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review all generated assets"
echo "  2. Upload to Product Hunt draft"
echo "  3. Test images display correctly"
echo "  4. Update PR with exported files"
echo ""
echo -e "${GREEN}Ready for Product Hunt launch! 🚀${NC}"
