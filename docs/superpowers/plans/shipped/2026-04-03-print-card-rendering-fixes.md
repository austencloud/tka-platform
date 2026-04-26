# Print Card Rendering Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify card back rendering to use the mandala-based CardBack component for print, fix front card padding to be consistent white with gray bleed.

**Architecture:** Replace canvas-based CardBackCanvasRenderer with DOM-to-canvas capture of the existing CardBack Svelte component. Fix PrintCardRenderer.renderFront() to use white content area with gray bleed. Clean up legacy files.

**Tech Stack:** html2canvas, Svelte 5, Canvas 2D API, pdf-lib

**Spec:** `docs/superpowers/specs/2026-04-03-print-card-rendering-fixes-design.md`

---

### Task 1: Rename CardBackV5 → CardBack, Delete Legacy

**Files:**
- Rename: `src/lib/features/choreo-card/components/card-back/CardBackV5.svelte` → `CardBack.svelte`
- Delete: `src/lib/features/choreo-card/components/card-back/CardBackV1.svelte`
- Delete: `src/lib/features/choreo-card/components/card-back/CardBackV2.svelte`
- Delete: `src/lib/features/choreo-card/components/card-back/CardBackV3.svelte`
- Delete: `src/lib/features/choreo-card/components/card-back/CardBackV4.svelte`
- Modify: `src/lib/features/choreo-card/components/designer/CardPreviewStack.svelte:12`

- [ ] **Step 1: Rename CardBackV5.svelte to CardBack.svelte**

```bash
cd /e/tka-platform
git mv src/lib/features/choreo-card/components/card-back/CardBackV5.svelte src/lib/features/choreo-card/components/card-back/CardBack.svelte
```

- [ ] **Step 2: Delete legacy CardBackV1-V4**

These have zero imports across the codebase — confirmed unused.

```bash
rm src/lib/features/choreo-card/components/card-back/CardBackV1.svelte
rm src/lib/features/choreo-card/components/card-back/CardBackV2.svelte
rm src/lib/features/choreo-card/components/card-back/CardBackV3.svelte
rm src/lib/features/choreo-card/components/card-back/CardBackV4.svelte
```

- [ ] **Step 3: Update CardPreviewStack.svelte import**

In `src/lib/features/choreo-card/components/designer/CardPreviewStack.svelte` line 12, change:

```typescript
// OLD
import CardBackV5 from "../card-back/CardBackV5.svelte";

// NEW
import CardBack from "../card-back/CardBack.svelte";
```

And at line 200, change:

```svelte
<!-- OLD -->
<CardBackV5 {sequence} />

<!-- NEW -->
<CardBack {sequence} />
```

- [ ] **Step 4: Verify build**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(choreo-card): rename CardBackV5 → CardBack, delete legacy V1-V4"
```

---

### Task 2: Add html2canvas Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install html2canvas**

```bash
npm install html2canvas
```

- [ ] **Step 2: Verify it installed**

```bash
grep html2canvas package.json
```

Expected: `"html2canvas": "^1.x.x"` in dependencies

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html2canvas dependency for print card back rendering"
```

---

### Task 3: Create CardBackDomRenderer Service

This service renders the CardBack Svelte component offscreen and captures it to a canvas.

**Files:**
- Create: `src/lib/features/choreo-card/services/contracts/ICardBackDomRenderer.ts`
- Create: `src/lib/features/choreo-card/services/implementations/CardBackDomRenderer.ts`

- [ ] **Step 1: Create the interface**

Create `src/lib/features/choreo-card/services/contracts/ICardBackDomRenderer.ts`:

```typescript
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface CardBackDomRenderOptions {
  /** Width in pixels of the output canvas (default: 822 for MPC poker) */
  width: number;
  /** Height in pixels of the output canvas (default: 1122 for MPC poker) */
  height: number;
  /** Bleed in pixels (default: 36) */
  bleedPx: number;
  /** Card back theme id (e.g. "nightSky") */
  theme: string;
}

export interface ICardBackDomRenderer {
  render(sequence: SequenceData, options: CardBackDomRenderOptions): Promise<HTMLCanvasElement>;
}
```

- [ ] **Step 2: Create the implementation**

Create `src/lib/features/choreo-card/services/implementations/CardBackDomRenderer.ts`:

```typescript
import html2canvas from "html2canvas";
import { mount, unmount } from "svelte";
import CardBack from "../../components/card-back/CardBack.svelte";
import type { ICardBackDomRenderer, CardBackDomRenderOptions } from "../contracts/ICardBackDomRenderer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export class CardBackDomRenderer implements ICardBackDomRenderer {
  async render(sequence: SequenceData, options: CardBackDomRenderOptions): Promise<HTMLCanvasElement> {
    const { width, height, bleedPx, theme } = options;
    const contentW = width - bleedPx * 2;
    const contentH = height - bleedPx * 2;

    // Create an offscreen container at the exact content dimensions
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = `${contentW}px`;
    container.style.height = `${contentH}px`;
    container.style.overflow = "hidden";
    // CardBack uses container queries — we need container-type set
    container.style.containerType = "inline-size";
    document.body.appendChild(container);

    try {
      // Mount CardBack into the offscreen container
      const component = mount(CardBack, {
        target: container,
        props: { sequence },
      });

      // Wait for SVG mandala and images to render
      await new Promise((resolve) => requestAnimationFrame(() =>
        requestAnimationFrame(() => setTimeout(resolve, 100))
      ));

      // Capture the rendered DOM to canvas
      const capturedCanvas = await html2canvas(container, {
        width: contentW,
        height: contentH,
        scale: 1,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      // Unmount the Svelte component
      unmount(component);

      // Create the final MPC canvas with bleed
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = width;
      finalCanvas.height = height;
      const ctx = finalCanvas.getContext("2d")!;

      // Fill bleed area with dark background matching the card
      ctx.fillStyle = "#060610";
      ctx.fillRect(0, 0, width, height);

      // Draw captured content centered in the bleed area
      ctx.drawImage(capturedCanvas, bleedPx, bleedPx, contentW, contentH);

      return finalCanvas;
    } finally {
      document.body.removeChild(container);
    }
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/services/contracts/ICardBackDomRenderer.ts src/lib/features/choreo-card/services/implementations/CardBackDomRenderer.ts
git commit -m "feat(choreo-card): add CardBackDomRenderer for print-quality card back capture"
```

---

### Task 4: Fix PrintCardRenderer Front Padding

**Files:**
- Modify: `src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts` (renderFront method, lines 39-113)

- [ ] **Step 1: Update renderFront to use white content area with gray bleed**

In `PrintCardRenderer.ts`, replace the section that fills the bleed canvas (approximately lines 93-113 where it creates the MPC canvas and draws the sequence). The new logic:

1. Fill entire canvas with gray bleed color (`#808080`)
2. Fill content area (inset by bleedPx) with white
3. Apply consistent inner margin (24px) within content area
4. Scale and center sequence image within the padded zone

Find the code after the sequence canvas is composed (the section starting with `// Wrap in MPC canvas with bleed`). Replace with:

```typescript
// Wrap in MPC canvas with bleed
const mpcCanvas = document.createElement("canvas");
mpcCanvas.width = canvasWidth;
mpcCanvas.height = canvasHeight;
const mpcCtx = mpcCanvas.getContext("2d")!;

// 1. Fill bleed area with neutral gray (cutting guide)
mpcCtx.fillStyle = "#808080";
mpcCtx.fillRect(0, 0, canvasWidth, canvasHeight);

// 2. Fill content area with white
mpcCtx.fillStyle = "#ffffff";
mpcCtx.fillRect(bleed, bleed, contentW, contentH);

// 3. Center sequence in content area with consistent inner margin
const innerMargin = 24;
const availW = contentW - innerMargin * 2;
const availH = contentH - innerMargin * 2;

const scaleX = availW / sequenceCanvas.width;
const scaleY = availH / sequenceCanvas.height;
const scale = Math.min(scaleX, scaleY);
const drawW = sequenceCanvas.width * scale;
const drawH = sequenceCanvas.height * scale;
const offsetX = bleed + innerMargin + (availW - drawW) / 2;
const offsetY = bleed + innerMargin + (availH - drawH) / 2;

mpcCtx.drawImage(sequenceCanvas, offsetX, offsetY, drawW, drawH);

return mpcCanvas;
```

- [ ] **Step 2: Remove the old edge-color sampling code**

Delete the `sampleEdgeColor` helper function or any code that samples the sequence canvas edge color to fill the bleed area.

- [ ] **Step 3: Verify build**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts
git commit -m "fix(choreo-card): consistent white padding on print card fronts with gray bleed"
```

---

### Task 5: Wire CardBackDomRenderer into PrintCardRenderer and DI

**Files:**
- Modify: `src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts` (constructor + renderBack)
- Modify: `src/lib/shared/di/index.ts` (lines 108, 488-502)
- Modify: `src/lib/shared/di/container-types.ts` (line 169)

- [ ] **Step 1: Update PrintCardRenderer constructor and renderBack**

Replace the `cardBackRenderer: ICardBackCanvasRenderer` dependency with `cardBackDomRenderer: ICardBackDomRenderer`.

Constructor change:
```typescript
// OLD
private readonly cardBackRenderer: ICardBackCanvasRenderer,

// NEW
private readonly cardBackDomRenderer: ICardBackDomRenderer,
```

Update the import at top of file:
```typescript
// OLD
import type { ICardBackCanvasRenderer } from "../contracts/ICardBackCanvasRenderer";

// NEW
import type { ICardBackDomRenderer } from "../contracts/ICardBackDomRenderer";
```

Update `renderBack()` to call the new renderer:
```typescript
async renderBack(sequence: SequenceData, options: PrintRenderOptions): Promise<HTMLCanvasElement> {
  const canvasWidth = options.canvasWidth ?? MPC_WIDTH;
  const canvasHeight = options.canvasHeight ?? MPC_HEIGHT;
  const bleedPx = options.bleedPx ?? MPC_BLEED;
  const theme = options.theme ?? this.theme;

  return this.cardBackDomRenderer.render(sequence, {
    width: canvasWidth,
    height: canvasHeight,
    bleedPx,
    theme,
  });
}
```

This removes the dependency on `deriveCardBackData()` and `CardBackData` from the render path — CardBack.svelte handles all of that internally.

- [ ] **Step 2: Update DI container**

In `src/lib/shared/di/index.ts`:

Replace import (line 108):
```typescript
// OLD
import { CardBackCanvasRenderer as CardBackCanvasRendererImpl } from "$lib/features/choreo-card/services/implementations/CardBackCanvasRenderer";

// NEW
import { CardBackDomRenderer as CardBackDomRendererImpl } from "$lib/features/choreo-card/services/implementations/CardBackDomRenderer";
```

Replace registration (around line 489):
```typescript
// OLD
cardBackCanvasRenderer: () => new CardBackCanvasRendererImpl(),

// NEW
cardBackDomRenderer: () => new CardBackDomRendererImpl(),
```

Update PrintCardRenderer wiring (around line 496):
```typescript
// OLD
ctx.cardBackCanvasRenderer,

// NEW
ctx.cardBackDomRenderer,
```

- [ ] **Step 3: Update container-types.ts**

In `src/lib/shared/di/container-types.ts` line 169, change:
```typescript
// OLD
cardBackCanvasRenderer: import("$lib/features/choreo-card/services/contracts/ICardBackCanvasRenderer").ICardBackCanvasRenderer;

// NEW
cardBackDomRenderer: import("$lib/features/choreo-card/services/contracts/ICardBackDomRenderer").ICardBackDomRenderer;
```

- [ ] **Step 4: Verify build**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts src/lib/shared/di/index.ts src/lib/shared/di/container-types.ts
git commit -m "feat(choreo-card): wire CardBackDomRenderer into print pipeline"
```

---

### Task 6: Delete CardBackCanvasRenderer and Clean Up Dependencies

**Files:**
- Delete: `src/lib/features/choreo-card/services/implementations/CardBackCanvasRenderer.ts`
- Delete: `src/lib/features/choreo-card/services/contracts/ICardBackCanvasRenderer.ts`
- Modify: `src/lib/features/choreo-card/services/implementations/InfoCardCanvasRenderer.ts` (line 12)
- Modify: `src/lib/features/choreo-card/services/contracts/IInfoCardCanvasRenderer.ts` (if it imports from ICardBackCanvasRenderer)

- [ ] **Step 1: Update InfoCardCanvasRenderer to inline its options type**

In `src/lib/features/choreo-card/services/implementations/InfoCardCanvasRenderer.ts` line 12, it imports `CardBackCanvasOptions`. Replace with an inline type or a local definition:

```typescript
// OLD (line 12)
import type { CardBackCanvasOptions } from "../contracts/ICardBackCanvasRenderer";

// NEW - define locally
interface InfoCardCanvasOptions {
  width: number;
  height: number;
  bleedPx: number;
  theme: string;
}
```

Then replace all uses of `CardBackCanvasOptions` with `InfoCardCanvasOptions` in the file.

Also check `src/lib/features/choreo-card/services/contracts/IInfoCardCanvasRenderer.ts` for any import from `ICardBackCanvasRenderer` and update similarly.

- [ ] **Step 2: Delete the old files**

```bash
rm src/lib/features/choreo-card/services/implementations/CardBackCanvasRenderer.ts
rm src/lib/features/choreo-card/services/contracts/ICardBackCanvasRenderer.ts
```

- [ ] **Step 3: Verify build**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(choreo-card): delete CardBackCanvasRenderer, inline InfoCard options"
```

---

### Task 7: Verify via DevTools

**Files:** None (verification only)

- [ ] **Step 1: Navigate to Print Prep**

Open Chrome DevTools, navigate to a VTG family (e.g. Split-Same Water), click Print.

- [ ] **Step 2: Verify card backs have mandala**

Take a screenshot. Each card back should show the mandala design matching what the Card Designer shows — not the old plain text layout.

- [ ] **Step 3: Verify card fronts have white padding**

Take a screenshot. Card fronts should have:
- Gray outer bleed edge
- White content area
- Sequence centered with consistent margins
- No gray letterboxing

- [ ] **Step 4: Test PDF export**

Click "PDF" format, then "Export". Open the PDF and verify:
- Fronts page: cards in grid with white backgrounds
- Backs page: cards with mandalas, columns mirrored for duplex

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(choreo-card): print card rendering adjustments from verification"
```
