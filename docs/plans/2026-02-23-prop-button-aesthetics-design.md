# Prop Button Aesthetics Design

**Feedback:** pOT1JelCllAktB4OeBKk
**Date:** 2026-02-23
**Status:** Approved

## Problem

The prop selection indicator button in the Create module's button panel shows a single blue SVG at 28px inside a dark circle. It's functional but visually flat. The prop selection drawer also shows single-prop SVGs per button. Both should display aesthetically pleasing paired-prop compositions (one red, one blue).

## Approach: Programmatic Paired-Prop Compositions + Lab Tab

### Component: `PropCompositionPreview.svelte`

An inline SVG component that renders two copies of a prop's button SVG — one blue (`#2e3192`), one red (via `hue-rotate(125deg) saturate(1.2)`) — arranged using a per-family composition recipe.

**Props:**
- `propType: PropType` — which prop to render
- `size?: number` — container size in px (default 64)
- `showLabels?: boolean` — show "R" / "B" labels (lab mode only)

**Rendering approach:**
- Container SVG with `viewBox="0 0 100 100"`
- Two `<image>` elements referencing the existing button SVGs from `/images/props/buttons/`
- Each image gets transforms (rotate, translate, scale) from the composition recipe
- Blue copy uses the SVG's native `#2e3192` fill
- Red copy applies CSS `filter: hue-rotate(125deg) saturate(1.2)` (same as existing PropTypeButton)

### Composition Recipes

Each prop family maps to a recipe defining how the pair is arranged:

```typescript
interface CompositionRecipe {
  // Blue prop transforms
  blue: { x: number; y: number; rotation: number; scale: number };
  // Red prop transforms
  red: { x: number; y: number; rotation: number; scale: number };
  // Overall scale factor (props may need shrinking to fit as a pair)
  pairScale: number;
}
```

Initial recipes (to be refined in lab):

| Family | Blue Transform | Red Transform | Concept |
|--------|---------------|---------------|---------|
| Staff | x:25, y:50, rot:-45 | x:75, y:50, rot:45 | Crossed X |
| Fan | x:35, y:50, rot:0 | x:65, y:50, rot:180 | Facing each other |
| Club | x:35, y:50, rot:-20 | x:65, y:50, rot:20 | Angled V |
| Buugeng | x:35, y:50, rot:0 | x:65, y:50, rot:180 | Interlocked curves |
| Hoop | x:40, y:50, rot:0 | x:60, y:50, rot:0 | Overlapping circles |
| Triad | x:35, y:50, rot:0 | x:65, y:50, rot:60 | Rotational offset |
| Default | x:35, y:50, rot:10 | x:65, y:50, rot:-10 | Mirrored pair |

### Lab Tab: "Prop Buttons"

Added to the Lab module at `src/lib/features/lab/tabs/PropButtonLab.svelte`.

**Layout:**
- Grid of all base prop types (13 families), each showing current composition at ~120px
- Click a prop to open a tuning panel with sliders for:
  - Blue/Red: x, y, rotation, scale
  - Overall pair scale
- Live preview updates as sliders change
- "Copy Recipe" button exports the current values as JSON
- "Reset" button returns to defaults

**Purpose:** Visual iteration tool. Tune each composition until it looks right, then copy the finalized recipes into the production component.

### Integration Points

1. **`PropIndicatorButton.svelte`** — Replace the single `<img>` with `<PropCompositionPreview>` showing both blue and red props at 32px
2. **`PropTypeButton.svelte`** (in Settings drawer) — Replace single `<img>` with the composition preview
3. **`PropTypeDisplayRegistry.ts`** — No changes needed (still the source for SVG paths)

### File Structure

```
src/lib/features/lab/tabs/PropButtonLab.svelte          # Lab tab
src/lib/shared/pictograph/prop/
  components/PropCompositionPreview.svelte                # Reusable composition component
  domain/prop-composition-recipes.ts                      # Per-family layout recipes
```

## Out of Scope

- Animated compositions (hover effects, entrance animations) — can add later
- Per-variant custom recipes — variants inherit from base family
- New SVG artwork — using existing button SVGs only
