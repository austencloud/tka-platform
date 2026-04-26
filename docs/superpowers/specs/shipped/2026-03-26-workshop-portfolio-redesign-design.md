# Workshop Portfolio Redesign

## Problem

The "My Workshops" section looks like a data entry system. Wide cards with text walls, Copy/Edit/Delete buttons on every card, loud colored header bands, and text chips create a corporate admin-panel feel. The section should feel like a portfolio showcase, not a CRUD interface.

## Design Direction

Transform workshop cards from data rows into portfolio pieces. Showcase-first, management tucked behind interactions.

## Card Design: Tall Portrait Cards

### Hero Area (top ~40% of card)
- Abstract geometric pattern: SVG circles (stroke-only) and lines, positioned deterministically per card
- Pattern tinted by level color at low opacity (~15%)
- Gradient fade from pattern into card background at the bottom of the hero
- Prop icons displayed as small circular badges (24px, frosted glass background) in the top-right corner of the hero

### Info Area (middle)
- Workshop title: `var(--font-size-min, 14px)`, semibold, full display (no truncation)
- One-line teaser: the full `description` string rendered with CSS `text-overflow: ellipsis`, `white-space: nowrap`, and `overflow: hidden`. No sentence parsing. If description is empty, the line is simply absent.

### Meta Footer (bottom)
- Small colored dot (6px) matching level color
- Level label: `var(--font-size-compact, 12px)`, uppercase, low opacity
- Solo/Partner badge: right-aligned, subtle

### Level Accent
- 3px gradient line across the very top edge of the card
- Color matches level:
  - introductory=#a78bfa
  - beginner=#22c55e
  - intermediate=#eab308
  - advanced=#ef4444
  - mixed=#3b82f6
- Replaces the full-width colored header band

## Prop Icons Mapping

Props are stored as free-text strings. Matching is **case-insensitive** and supports common aliases. Unmatched props get the fallback icon.

| Prop Slug | Aliases | Icon | FA Class |
|-----------|---------|------|----------|
| double-staves | staves, staff, double staves | Vertical lines | `fa-grip-lines-vertical` |
| clubs | club | Bat+ball | `fa-baseball-bat-ball` |
| mixed-static-props | mixed props, mixed | Shapes | `fa-shapes` |
| contact-ball | contact, cj, crystal ball | Circle | `fa-circle` |
| balloons | balloon | Wind | `fa-wind` |
| poi | | Yin-yang | `fa-yin-yang` |
| fans | fan | Fan | `fa-fan` |
| buugeng | s-staff | Infinity | `fa-infinity` |
| (fallback) | | Dot circle | `fa-circle-dot` |

## Interaction Model

### Card Click
- Entire card is the click target (cursor: pointer)
- Opens the existing workshop edit form modal directly (the same `showWorkshopForm` modal that currently exists)
- The form pre-populates with the clicked workshop's data (same as current Edit button behavior)
- Delete button remains inside the modal footer (already exists there conceptually via the delete handler)

There is no new "detail/view mode." The card itself IS the showcase view. Clicking enters edit mode via the existing modal.

### Card Hover
- `translateY(-3px)` lift
- Box shadow deepens
- Border color brightens
- All transitions use `var(--transition-fast, 0.15s)`
- Respects `prefers-reduced-motion` (no transform, no shadow change)

### Copy Action
- Removed from card surface entirely
- Add a "Copy Description" button in the modal footer alongside Save/Cancel/Delete

## Layout

### Grid
- `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
- Gap: 16px
- Cards maintain portrait aspect ratio naturally via content height

### Header
- "Workshops" title on the left
- "+ Add Workshop" button on the right (accent-colored, subtle border)
- No dashed placeholder card in the grid

## Geometric Pattern Generation

Each card gets a unique-looking pattern using deterministic positioning from the workshop ID.

**Algorithm:** Hash the first 8 characters of the workshop UUID to a number. Use modular arithmetic to derive:
- Circle count: 2-3 (hash % 2 + 2)
- Circle sizes: 30-90px range, derived from different bit slices of the hash
- Circle positions: top/left percentages derived from hash
- Line count: 2-3
- Line angles: 10-45 degree range, derived from hash

**Implementation:** Pure CSS with `position: absolute` elements inside a container div. No SVG or Canvas needed. All elements use `currentColor` which inherits the level color from the parent class.

Opacity: 0.12-0.15 so patterns are atmospheric, not distracting.

Patterns don't need to be beautiful or meaningful. They just need to be visually distinct per card and create texture in the hero area.

## Fields Not Displayed on Cards

- `themes`: not displayed (reserved for future filtering)
- Full `description`: lives in the modal, card shows one-line teaser only

## Files to Modify

| File | Change |
|------|--------|
| `WorkshopTemplateCard.svelte` | Complete rewrite: portrait layout, hero area with pattern, remove action buttons, add prop icons, one-line teaser |
| `WorkshopPortfolioEditor.svelte` | Remove dashed add-card from grid, keep header "+ Add Workshop" button, update grid CSS to `minmax(200px, 1fr)`, add Copy button to modal footer |

## Files NOT Modified

- Data model (no schema changes)
- Repository/persistence (no backend changes)
- Festival detail views (FestivalMaterialsPanel, TrackerControls unchanged)

## Accessibility

- Cards are keyboard-focusable with visible focus ring (`outline` on `:focus-visible`)
- Prop icons get `title` attributes for tooltip identification
- Level information conveyed by both color dot AND text label (not color-only)
- Hover/lift animations respect `prefers-reduced-motion`
- All text meets project minimum: 14px for titles, 12px for metadata
- Touch targets: cards are well above 44px minimum on mobile
