#!/bin/bash
# Downloads all 133 pictures from ignispixel.com/pics
# Each image is downloaded from their direct download endpoint

mkdir -p ignispixel-pics

slugs=(
geometric-hearts caged-eyes snowflakes rainbow-geometry rainbow-bubbles
purpletriangles eye-spy canadian-eh blue-dneh orange-dneh
stippling-geometry-green-purple stippling-geometry phoenix shalom purple-leopard
blue-tiger fractal-radiation drawn-cube spray bright-tracery
blue-fractal-butterfly fire-horse colorful-lines bright-lion yin-yang-1
leopard blue-lines fire-hearts running-fire-horse golden-butterfly
world-map map lion flashing-lights rainbow-spiral
square-spiral wedding-doves happy-couple beautiful-fire peaceful-inside
fingers-in-fire zapdos bright-highlights coctails youtube-logo
beautiful-jellyfish fractal-target colored-smoke rectangles fractal-worlds
rainbow-chessboard bright-pulse-2 bright-pulse fish-1 fire-wall
snowflake fractal-waves bright-stained-glass mona-lisa blue-jellyfish
ignis-pixel-logo-text space-bubbles google-logo fish fire-ball
fire-smoke-heart fire-cat water-and-fire eye-of-fire colorful-jelly-triangles
colorful-jelly-squares rainbow-pattern-2 rainbow-pattern colored-jelly-balls cosmic-signal
bmw-logo balloons fractal-wolf rainbow-spiral-up ice-age-squirrel
marilyn-monroe ignis-pixel-logo-head ignis-logo angelina-jolie red-cat
my-favourite-flower red-square-patterns dot-line-dot-line rainbow-square-patterns square-patterns
bulk-jellyfish fire-lines immersion-into-the-universe multi-colored-stones coca-cola-logo
fractal-way jellyfish cosmic-flowers acid-zigzag bright-butterfly
fish-flock fractal-pattern fractal-reflection purple-lightning just-bright-colors
yin-yang flowers-and-birds lightning nestle-logo geometric-wolf
water-lilies strange-mechanism fire-guitarist fire-cards fire-eye
decorated-circles handprint colorful-flowers colorful-brush-strokes gears
fractal-web fractal-flower garden-of-earthly-delights-hieronymus-bosch stingray fractal-diamond
pink-snowflake Ornament orange-flowers fractal-flowers reflected-waves
Fractal-glow galaxy lips
)

total=${#slugs[@]}
echo "Downloading $total images from ignispixel.com..."

for i in "${!slugs[@]}"; do
  slug="${slugs[$i]}"
  num=$((i + 1))
  outfile="ignispixel-pics/${slug}.png"

  if [ -f "$outfile" ]; then
    echo "[$num/$total] SKIP (exists): $slug"
    continue
  fi

  echo -n "[$num/$total] $slug ... "
  curl -sL -o "$outfile" "https://ignispixel.com/pic/download_pic/${slug}"

  if [ -s "$outfile" ]; then
    size=$(wc -c < "$outfile")
    echo "OK (${size} bytes)"
  else
    echo "FAILED"
    rm -f "$outfile"
  fi

  # Small delay to be polite
  sleep 0.3
done

echo ""
echo "Done! Downloaded to ignispixel-pics/"
ls ignispixel-pics/ | wc -l
echo "files total"
