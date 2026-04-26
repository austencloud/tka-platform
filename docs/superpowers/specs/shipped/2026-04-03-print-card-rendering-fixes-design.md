# Print Card Rendering Fixes

## Problem

The Print Prep card rendering has two issues:

1. **Card backs are missing the mandala.** `CardBackCanvasRenderer` (841 lines of Canvas 2D code) reimplements the card back layout without the mandala. `CardBackV5.svelte` in the Card Designer has the correct design with mandala, decorations, and themed gradients. Two rendering paths exist where there should be one.

2. **Card fronts have inconsistent gray letterboxing.** The front renderer samples the edge color of the sequence image (often gray) and fills the entire bleed canvas with it. Sequences with different aspect ratios get different amounts of gray padding, making the cards look inconsistent.

## Design

### Card Backs — Single Rendering Path

**Rename:** `CardBackV5.svelte` → `CardBack.svelte`. Delete `CardBackV1-V4.svelte` (legacy, unused).

**Approach:** Render `CardBack.svelte` offscreen in the DOM, capture to canvas via `html2canvas`.

1. Add `html2canvas` as a dependency
2. Create `CardBackDomRenderer` service that:
   - Creates a hidden container div (off-screen, fixed dimensions matching print size)
   - Mounts `CardBack.svelte` into it with the sequence data and theme
   - Waits for the mandala SVG to render
   - Captures via `html2canvas` → returns `HTMLCanvasElement`
   - Unmounts and cleans up
3. `PrintCardRenderer.renderBack()` calls `CardBackDomRenderer` instead of `CardBackCanvasRenderer`
4. Delete `CardBackCanvasRenderer.ts` and `ICardBackCanvasRenderer.ts`
5. Remove from DI container (`index.ts` and `container-types.ts`)
6. Update `InfoCardCanvasRenderer` to not depend on `CardBackCanvasOptions` (inline what it needs)

**Result:** One component (`CardBack.svelte`) renders card backs everywhere. Print output matches the Card Designer exactly, including the mandala.

### Card Fronts — Consistent White + Gray Bleed

**Current behavior:** `PrintCardRenderer.renderFront()` fills the entire 822x1122 canvas with the edge-dominant color of the sequence image (gray), then centers the sequence. Variable aspect ratios → variable gray padding.

**New behavior:**
1. Fill the entire canvas with a **bleed color** (neutral gray `#808080` or similar) — this is the cut-guide zone
2. Fill the **content area** (750x1050, inset by 36px bleed) with **white**
3. Apply a consistent **inner margin** (e.g. 24px) within the content area
4. Scale and center the sequence image within the remaining space (`750 - 48` x `1050 - 48` = 702x1002)
5. Any remaining space after scaling is white

**Result:** Every card front has: gray bleed edge → white content area → centered sequence. Consistent regardless of sequence dimensions.

### Rename Checklist

| Old | New |
|-----|-----|
| `CardBackV5.svelte` | `CardBack.svelte` |
| `CardBackCanvasRenderer.ts` | Deleted |
| `ICardBackCanvasRenderer.ts` | Deleted |

Delete `CardBackV1.svelte` through `CardBackV4.svelte` (legacy).

Update import in `CardPreviewStack.svelte` from `CardBackV5` → `CardBack`.

### Files Modified

| File | Change |
|------|--------|
| `components/card-back/CardBackV5.svelte` | Rename to `CardBack.svelte` |
| `components/card-back/CardBackV1-V4.svelte` | Delete |
| `components/designer/CardPreviewStack.svelte` | Update import |
| `services/implementations/PrintCardRenderer.ts` | Use DOM renderer for backs, fix front padding |
| `services/implementations/CardBackCanvasRenderer.ts` | Delete |
| `services/contracts/ICardBackCanvasRenderer.ts` | Delete |
| `services/implementations/InfoCardCanvasRenderer.ts` | Remove dependency on CardBackCanvasOptions |
| `shared/di/index.ts` | Remove CardBackCanvasRenderer registration |
| `shared/di/container-types.ts` | Remove type |
| New: `services/implementations/CardBackDomRenderer.ts` | DOM → canvas capture service |
| New: `services/contracts/ICardBackDomRenderer.ts` | Interface |
| `package.json` | Add `html2canvas` dependency |
