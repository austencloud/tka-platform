# Landing Page: Replace "What is TKA" with Downloadable Guides

## Problem

The "What is TKA?" section uses emoji icons (music note, ABC blocks) and AI-sounding copy
to explain TKA via analogy. It looks generated. The Notation in Motion demo already shows
what TKA is — explaining it again with marketing copy is redundant.

## Solution

Replace the section with downloadable PDF guides. Show the real thing instead of explaining it.

## Design

### Section: "Learn TKA"

Three guide cards in a responsive row (stacks on mobile).

**Each card:**
- Cover image or styled placeholder
- Level name + short description
- "Download PDF" link (direct download, no auth)

**Card content:**

| Card | Title | Description | Image |
|------|-------|-------------|-------|
| Level 1 | Positions & Letters | Zero turns. The grid, all 6 letter types, basic words. | `level-1-cover.png` (real art) |
| Level 2 | Turns | Whole turns. Shifts get rotation, combos get harder. | Styled placeholder (number "2") |
| Level 3 | Half Turns & Float | Half turns, float state. Full vocabulary. | Styled placeholder (number "3") |

**Below cards:** "Grab a pair of staves and follow along."

### Page flow

Hero → Notation in Motion → **Learn TKA** (guides) → Footer

### File changes

1. **Delete:** `WhatIsTKASection.svelte` content (rewrite as `GuidesSection.svelte`)
2. **Copy PDFs** from `_GUIDE/exports/` to `static/guides/`:
   - `level-1.pdf` (18MB)
   - `level-2.pdf` (3.5MB)
   - `level-3.pdf` (6.8MB)
3. **Copy cover image** from `_GUIDE/images/shared/level-1-front-cover.png` to `static/guides/level-1-cover.png`
4. **Update** `+page.svelte` import: `WhatIsTKASection` → `GuidesSection`

### Placeholder covers for Level 2 & 3

CSS-styled cards with a large level number centered on a dark background with a subtle
pictograph-inspired border treatment. No fake images. Real art replaces these later.
