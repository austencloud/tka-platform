# ASCII Rendering Techniques — Knowledge Base

Reference doc for the ASCII pictograph renderer. Read on demand, not auto-loaded.

## The Two Paradigms

1. **Tone-based**: Map pixel brightness to character density ramp (`. : - = + * # % @`). Treats characters as uniform brightness blocks. Good for photos, bad for geometry.

2. **Structure-based**: Match the *shape* of ink within each character cell to the desired visual. Characters selected by where ink sits, not how much there is. Good for lines, arcs, geometric shapes.

Our renderer uses structure-based thinking.

---

## Shape-Vector Matching (Alex Harri, 2026)

State of the art. Each character fingerprinted as a 6D vector from 6 sampling circles in a 2×3 grid:

```
[TL] [TR]
[ML] [MR]
[BL] [BR]
```

Each circle measures fraction of area overlapping with character ink → value 0.0-1.0. Produces a 6D vector per character.

At runtime: compute same 6D vector for the desired shape in each cell, find nearest character by Euclidean distance.

**Why 6D?** Distinguishes left/right (p vs q), top/bottom (b vs p), diagonal direction (/ vs \), and middle concentration (- vs O).

**Implementation**: Pre-render all 95 printable ASCII chars, compute vectors once. K-d tree for O(log N) lookup.

Source: alexharri.com/blog/ascii-rendering

---

## Bitmask Elimination (ASCII Silhouettify)

For filled shapes: render ideal shape as 9×19 bitmap per cell. For each black pixel in the shape, exclude characters that have white there (via AND on a 95-bit accumulator). Pick survivor with most matching pixels.

Guarantees characters never overflow the intended shape boundary.

Source: meatfighter.com/ascii-silhouettify

---

## Character Sub-Cell Positions

| Char | Ink Position | Use |
|------|-------------|-----|
| `.` | Bottom center | Gentle descent from horizontal |
| `'` | Top right | Gentle ascent toward horizontal |
| `` ` `` | Top left | Same as ' but other side |
| `,` | Bottom left, very low | Bottom-of-circle transitions |
| `_` | Very bottom, full width | Flat bottom, continued horizontal |
| `~` | Middle, wavy | Near-horizontal with undulation |
| `-` | Middle, full width | Pure horizontal |
| `\|` | Full height, center | Pure vertical |
| `/` | Bottom-left to top-right | 45° ascending |
| `\` | Top-left to bottom-right | 45° descending |
| `(` | Vertical curve opening right | Near-vertical curve segments |
| `)` | Vertical curve opening left | Near-vertical curve segments |

## Circle Character Sequences

Classic bottom-of-circle: `" - . , _ _ _ , . - "`
Classic top-of-circle: `' - ~ ~ ~ - '`
Rowan Crawford circle template:
```
       ___
    .-~"   "~-.
   /           \
  /             \
 Y               Y
 |               |
 l               !
  \             /
   \           /
    "-.,___,.-"
```

---

## Tangent Angle → Character (12-Direction System)

Our `getArcChar` function. Aspect-ratio-corrected: visual angle = atan2(dy, dx/2).

| Degrees | Character | Description |
|---------|-----------|-------------|
| ±0-12 | `-` | Pure horizontal |
| +12 to +34 | `.` | Gentle descent |
| +34 to +78 | `\` | Diagonal down |
| +78 to +102 | `\|` | Pure vertical |
| +102 to +146 | `/` | Diagonal up-left |
| +146 to +168 | `.` | Gentle descent (left) |
| ±168-180 | `-` | Pure horizontal |
| -12 to -34 | `'` | Gentle ascent |
| -34 to -78 | `/` | Diagonal up-right |
| -102 to -146 | `\` | Diagonal up-left (ascending) |
| -146 to -168 | `'` | Gentle ascent (left) |

---

## 2:1 Aspect Ratio Compensation

Monospace cells are ~2× taller than wide. For geometric shapes:
- Diagonal steps: 2 cols per 1 row for visual 45°
- Circle rendering: horizontal radius = 2× vertical radius in buffer coords
- Perpendicular computation: convert to visual space (halve horizontal), compute perp, convert back

Our renderer already handles this in coordinate maps and `getStaffStep()`.

---

## Bezier Arc Rendering

Quadratic Bezier for curved arrows: P(t) = (1-t)²·start + 2(1-t)t·control + t²·end

Control point: midpoint of chord + perpendicular offset in visual space.
- CW: bulge away from center (outward sweep)
- CCW: bulge toward center (tight hug)

Dense sampling (2.5× visual distance) → rasterize to grid → tangent angle → getArcChar.

---

## Future: Braille Sub-Cell Rendering

Unicode Braille (U+2800-U+28FF) = 2×4 dot grid per cell = 8× resolution.
Dot-to-bit mapping: `pixel_map = ((0x01, 0x08), (0x02, 0x10), (0x04, 0x20), (0x40, 0x80))`
Character = `String.fromCharCode(0x2800 + bits)`

Combined with Zingl's generalized Bresenham for lines/circles/Bezier curves.
Effective 160×96 pixels on an 80×24 terminal. Limitation: per-character color only.

Source: github.com/zingl/Bresenham, github.com/asciimoo/drawille

---

## Key Libraries

| Library | Language | Approach | Geometric Primitives |
|---------|----------|----------|---------------------|
| libcaca | C | Dithering + color | Lines, circles, ellipses, triangles |
| drawille | Python/JS | Braille sub-cell | Lines via Bresenham |
| ascii-renderer | Python | 6D shape vectors | Image → ASCII conversion |
| Gradscii-art | Python | Gradient descent | Optimization-based |
| Chafa | C | Multi-symbol class | Image → terminal |
| figlet | JS | Font-based | Text only |

---

## Grade Scale for Our Renderer

| Element | Current Quality | Target | Technique |
|---------|----------------|--------|-----------|
| Staves (lines) | Good | Good | Direct line chars |
| Hand markers | Good | Good | Single char placement |
| Grid dots | Good | Good | Single char placement |
| Straight arrows | Good | Good | Bresenham + arrow chars |
| Curved arrows | Fair | Great | Bezier + 12-dir chars |
| Orientation caps | Good | Good | Perpendicular chars |
| Beta offsets | Good | Good | Offset coordinates |
