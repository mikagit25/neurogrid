#!/usr/bin/env bash
# Generate PNG/WebP/GIF and a mockup MP4 video from placeholder SVG assets
# Requirements: rsvg-convert (librsvg), ffmpeg, python3 (gTTS optional), imagemagick (optional)

set -euo pipefail

OUT_DIR="product-hunt/assets/exports"
SVG_DIR="product-hunt/assets"
mkdir -p "$OUT_DIR"

# Sizes
LOGO_SIZES=(2048 1024 512)
HERO_SIZES=(1920x1080 1200x675)
SCREENSHOT_SIZE="1920x1080"
COVER_SIZE="1200x900"

echo "Exporting logos..."
for s in "${LOGO_SIZES[@]}"; do
  if [ -f "$SVG_DIR/logo-placeholder.svg" ]; then
    echo " - logo ${s}x${s}"
    rsvg-convert -w $s -h $s "$SVG_DIR/logo-placeholder.svg" -o "$OUT_DIR/logo-${s}.png"
    cwebp -q 90 "$OUT_DIR/logo-${s}.png" -o "$OUT_DIR/logo-${s}.webp" || true
  fi
done

echo "Exporting hero images..."
for size in "${HERO_SIZES[@]}"; do
  IFS='x' read -r w h <<< "$size"
  echo " - hero ${w}x${h}"
  rsvg-convert -w $w -h $h "$SVG_DIR/hero-placeholder.svg" -o "$OUT_DIR/hero-${w}x${h}.png"
  cwebp -q 90 "$OUT_DIR/hero-${w}x${h}.png" -o "$OUT_DIR/hero-${w}x${h}.webp" || true
done

echo "Exporting screenshots..."
for f in "$SVG_DIR"/screenshot*-placeholder.svg; do
  [ -e "$f" ] || continue
  base=$(basename "$f" .svg)
  echo " - $base -> ${SCREENSHOT_SIZE}"
  rsvg-convert -w 1920 -h 1080 "$f" -o "$OUT_DIR/${base}.png"
  cwebp -q 90 "$OUT_DIR/${base}.png" -o "$OUT_DIR/${base}.webp" || true
done

# Create a GIF demonstrating a simple flow (screenshots -> gif)
GIF_OUT="$OUT_DIR/demo-flow.gif"
TMP_SEQ="$OUT_DIR/seq"
mkdir -p "$TMP_SEQ"
i=0
for img in "$OUT_DIR"/screenshot*-placeholder.png; do
  if [ -f "$img" ]; then
    convert "$img" -resize 1280x720 "$TMP_SEQ/$(printf '%03d' $i).png"
    i=$((i+1))
  fi
done

if [ $i -gt 0 ]; then
  echo "Generating GIF $GIF_OUT"
  ffmpeg -y -framerate 1 -i "$TMP_SEQ/%03d.png" -vf "scale=1280:720:flags=lanczos,palettegen=reserve_transparent=1" -loop 0 "$GIF_OUT" || true
fi

# Generate mockup MP4 using hero + screenshots and optional TTS audio
VIDEO_OUT="$OUT_DIR/mockup.mp4"
AUDIO_OUT="$OUT_DIR/voice_en.mp3"
TMP_VIDEO_SEQ="$OUT_DIR/video_seq"
mkdir -p "$TMP_VIDEO_SEQ"

# Create slides: hero, screenshot1, screenshot2, screenshot3
idx=0
if [ -f "$OUT_DIR/hero-1920x1080.png" ]; then
  cp "$OUT_DIR/hero-1920x1080.png" "$TMP_VIDEO_SEQ/$(printf '%03d' $idx).png"; idx=$((idx+1))
fi
for s in "$OUT_DIR"/screenshot*-placeholder.png; do
  [ -f "$s" ] || continue
  cp "$s" "$TMP_VIDEO_SEQ/$(printf '%03d' $idx).png"; idx=$((idx+1))
done

# Create a simple narration using gTTS if available
if command -v python3 >/dev/null 2>&1; then
  if python3 - <<'PY' 2>/dev/null
try:
    from gtts import gTTS
    tts = gTTS('Try NeuroGrid — decentralized GPU inference. Try the demo at neurogrid.network. Early adopters get 1000 free tasks and a lifetime 15 percent discount.', lang='en')
    tts.save('''$AUDIO_OUT''')
    print('OK')
except Exception as e:
    pass
PY
  then
    echo "Generated TTS audio -> $AUDIO_OUT"
  fi
fi

# Build video from images (3s per slide) and add audio if present
DURATION_PER_SLIDE=3
FILTER_COMPLEX=""
inputs=()
cnt=0
for img in "$TMP_VIDEO_SEQ"/*.png; do
  inputs+=( -loop 1 -t $DURATION_PER_SLIDE -i "$img" )
  cnt=$((cnt+1))
done

if [ $cnt -gt 0 ]; then
  echo "Generating video $VIDEO_OUT"
  ffmpeg -y "${inputs[@]}" -filter_complex "[0:v]scale=1280:720,format=yuv420p[v0];" -map "[v0]" -t $((cnt*DURATION_PER_SLIDE)) "$VIDEO_OUT" || true
  if [ -f "$AUDIO_OUT" ]; then
    ffmpeg -y -i "$VIDEO_OUT" -i "$AUDIO_OUT" -c:v copy -c:a aac -shortest "$OUT_DIR/temp_with_audio.mp4"
    mv "$OUT_DIR/temp_with_audio.mp4" "$VIDEO_OUT"
  fi
fi

# Cleanup
rm -rf "$TMP_SEQ" "$TMP_VIDEO_SEQ"

echo "Assets exported to $OUT_DIR"