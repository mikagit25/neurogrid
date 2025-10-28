# Asset generation

This folder contains scripts to export SVG placeholders into PNG/WebP, generate a GIF demo and a mockup MP4 video.

Requirements
- rsvg-convert (librsvg)
- ffmpeg
- imagemagick (convert)
- python3 and gTTS (optional, for generating TTS audio)
- cwebp (optional, for WebP output)

Run

```bash
# from repository root
bash product-hunt/generate_assets.sh
```

Outputs will be in `product-hunt/assets/exports/`.