# Card Designer v2 — Implementation Spec

## Context

The Card Designer tab lives in the Choreo Cards module (`src/lib/features/choreo-card/`). It shows the front and back of a choreo card side by side so the user can design the back. The current implementation has severe layout bugs: cards don't fit their containers, variant buttons push content off-screen, and the back card overflows on taller sequences.

## What Exists

- `CardDesigner.svelte` — the tab content. Has nav, length filter chips, card pair layout, variant switcher, export button, context menu. **Needs a full rewrite of the layout and variant switcher placement.**
- `CardBack.svelte` — the original back design (placeholder quality). Keep as variant 0.
- `card-back/CardBackV1-V4.svelte` — four new design variants. They render correctly inside their container but the container sizing is broken.
- `card-back/card-back-data.ts` — shared data derivation for all variants. This is solid, don't touch.
- `context-menu/CardDesignerContextMenuHost.svelte` + `CardDesignerContextMenuBuilder.ts` — right-click visibility toggles. Working, don't touch.

## The Layout Problem (Why It Keeps Breaking)

The front card is a pre-composed image rendered by `PropAwareThumbnail`. Its aspect ratio varies by sequence length:

| Beats | Cols × Rows (with start) | Approximate Aspect |
|-------|--------------------------|-------------------|
| 2 | 3 × 1 | ~2.1:1 landscape |
| 4 | 5 × 1 | ~3.5:1 very wide |
| 8 | 5 × 2 | ~2.0:1 landscape |
| 12 | 4 × 4 | ~0.8:1 portrait |
| 16 | 5 × 4 | ~1.0:1 square-ish |

(Header adds ~1/3 stepSize height, footer adds ~1/7 stepSize height)

The layout calculation that currently exists (`layout` derived) correctly picks vertical vs. horizontal placement and calculates card dimensions. **The math is right.** The problem is:

1. The variant switcher bar was placed INSIDE the pair container, stealing space and pushing cards off-screen
2. The card back variants don't properly fill their allocated container (overflow, wrong sizing)
3. There's no consideration for the "playing card size" concept the user wants

## The Correct Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ Nav: Name, ‹ 1/432 ›, export button                │
│ Length chips: All 2 4 6 8 10 12 16                  │
│ Variant chips: Current Archive Signal Field Mint    │
├─────────────────────────────────────────────────────┤
│                                                     │
│    ┌──────────┐    ┌──────────┐                     │
│    │  FRONT   │    │  BACK    │  ← same size        │
│    │  label   │    │  label   │                      │
│    │          │    │          │                      │
│    │  card    │    │  card    │  ← side-by-side      │
│    │  frame   │    │  frame   │    OR stacked,       │
│    │          │    │          │    whichever fits     │
│    └──────────┘    └──────────┘                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Key rules:
- ALL controls (nav, length chips, variant chips) go at the TOP, above the card pair
- The card pair container takes ALL remaining space below the controls
- Both cards are ALWAYS the same pixel dimensions
- NO scrolling. NO overflow. Cards scale to fit.
- The layout auto-detects whether vertical or horizontal placement gives bigger cards

## Controls Layout

All controls should be compact and centered:

```
               AAKE
          ‹  1 / 244  ›  ⬇
   All  2  4  6  8  10  12  16
  Current  Archive  Signal  Field  Mint
```

- Nav: centered name, prev/next buttons close together with counter between them, export icon after
- Length chips: single centered row
- Variant chips: single centered row below length chips
- All controls use `--min-touch-target` (48px) for button sizes
- Borders visible: use `--theme-stroke-strong` not `--theme-stroke`

## Card Pair Layout Algorithm

This exists and works. Keep it:

1. Measure container with ResizeObserver → `cW`, `cH`
2. Get card image natural aspect ratio → `cardAspect` (poll for image load, default to 3:1)
3. Calculate two options:
   - **Vertical**: each card height = min(availH/2, availW/aspect), width = height × aspect
   - **Horizontal**: each card width = min(availW/2, availH × aspect), height = width / aspect
4. Pick whichever gives bigger cards by area
5. Both cards rendered at those exact pixel dimensions

The critical fix: `cardAspect` must have a fallback (default 3:1 for landscape) so cards render immediately. The image `watchForImage` action polls for the `<img>` natural dimensions and updates `cardAspect` when found, which triggers a layout recalculation.

## Card Back Variants

Five variants (0-4), switchable via the variant bar:

| # | Name | Personality |
|---|------|-------------|
| 0 | Current | The existing CardBack.svelte |
| 1 | Archive | Museum catalog. Serif. Thin rules. Small-caps labels. Connected level scale. |
| 2 | Signal | Trading card. Giant level number. Inverted word bar. Pip indicators. Bold. |
| 3 | Field | Flash card. Rounded containers. Progress dots. Emoji icons. Friendly. |
| 4 | Mint | Luxury. Extreme whitespace. Giant serif level number. Barely-there footer. |

All variants:
- Use `--print-*` or `--cb-*` CSS tokens (never hardcoded hex)
- Use `clamp()` with `cqi` units for font sizes so text scales with container width
- Have `width: 100%; height: 100%` to fill their parent frame
- Set `overflow: hidden` on the root element
- Set `container-type: inline-size` on the root for container queries
- Include `border: 1px solid var(--print-border, #000)` to look like a physical card edge

## What NOT to Do

These are actual mistakes made in previous iterations. Don't repeat them:

1. **Don't use `flex: 1 1 0` to split cards equally** — this ignores the card's natural aspect ratio and creates empty white space
2. **Don't put controls inside the card pair container** — they steal space and push cards off-screen
3. **Don't use `object-fit: contain` on a container with a forced height** — the image won't fill it, creating dead space
4. **Don't gate rendering on `cardAspect`** — chicken-and-egg: the image can't load if it's not rendered. Always render with a fallback, recalculate when the real aspect ratio arrives.
5. **Don't add scrollbars** — if content doesn't fit, scale it down. The math handles this.
6. **Don't use a `<select>` dropdown for sequence navigation** — it takes too much space and looks bad

## Files to Modify

1. **`CardDesigner.svelte`** — Full rewrite of the template and CSS. Keep the script logic (layout calculation, length filter, variant state, context menu, export). Fix the template structure: controls at top, card pair below, no overflow.

2. **`CardBackV1.svelte` through `CardBackV4.svelte`** — May need minor CSS fixes to ensure they fill `width: 100%; height: 100%` with `overflow: hidden` properly. The content should scale via clamp/cqi and use flex with `grow` spacers to distribute vertically.

## Testing Checklist

After implementation, verify ALL of these:

- [ ] AABB (4-beat, very wide landscape): both cards visible, same size, no scroll
- [ ] AAKE (16-beat, near-square): both cards visible, same size, no scroll
- [ ] ABC (12-beat, portrait): both cards visible, same size, no scroll
- [ ] Switch between all 5 variants — each fills the card frame properly
- [ ] Length filter chips work — filtering resets to first card
- [ ] Prev/next navigation works
- [ ] Arrow keys work
- [ ] Export button works
- [ ] Right-click context menu shows visibility toggles
- [ ] All controls visible and not overlapping cards
- [ ] Variant buttons don't push content off-screen
- [ ] On a 4K monitor, controls are centered and compact, not stretched
- [ ] No hardcoded hex colors — only CSS custom properties

## Playing Card Size (Future, Not This Spec)

The user wants all cards to eventually be a standardized physical size (like playing cards — 2.5" × 3.5"). This means the front card image would be placed inside a fixed-aspect-ratio canvas with margins around it when the image is smaller. This is a SEPARATE effort and should NOT be attempted in this implementation. Get the layout working first with natural image sizes.
