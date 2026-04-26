# Card Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add elemental stripe frames to card fronts, pin mandala to center on card backs, derive and display VTG ratios, update branding, and add rounded corners throughout.

**Architecture:** Six independent changes touching the data layer (`elemental-theme.ts`, `card-back-data.ts`), canvas renderer (`PrintCardRenderer.ts`), Svelte components (`CardBack.svelte`, `PrintPreviewPages.svelte`), and callers (`VtgFamilyDrillDown.svelte`, `DeckBrowser.svelte`). Data layer changes come first since renderer and components depend on them.

**Tech Stack:** Svelte 5, TypeScript, Canvas 2D API, html2canvas, ITI DI

**Spec:** `docs/superpowers/specs/2026-04-04-card-visual-polish-design.md`

---

### Task 1: Extend Elemental Theme Data

**Files:**
- Modify: `src/lib/features/choreo-card/domain/elemental-theme.ts`

- [ ] **Step 1: Add `darkComplement` to `ElementalTheme` interface**

```typescript
export interface ElementalTheme {
  readonly familyId: string;
  readonly element: string;
  readonly accentColor: string;
  readonly darkComplement: string;
  readonly svgPath: string;
}
```

- [ ] **Step 2: Add `darkComplement` to each entry in `VTG_ELEMENTAL_THEMES`**

```typescript
export const VTG_ELEMENTAL_THEMES: readonly ElementalTheme[] = [
  {
    familyId: "split-same",
    element: "water",
    accentColor: "#63b7cd",
    darkComplement: "#1a5276",
    svgPath: "/images/elements/water.svg",
  },
  {
    familyId: "tog-same",
    element: "earth",
    accentColor: "#75A874",
    darkComplement: "#2a4a29",
    svgPath: "/images/elements/earth.svg",
  },
  {
    familyId: "quarter-same",
    element: "sun",
    accentColor: "#ffde17",
    darkComplement: "#7a6a00",
    svgPath: "/images/elements/sun.svg",
  },
  {
    familyId: "split-opp",
    element: "fire",
    accentColor: "#f2673a",
    darkComplement: "#6b1a0a",
    svgPath: "/images/elements/fire.svg",
  },
  {
    familyId: "tog-opp",
    element: "air",
    accentColor: "#78b7e3",
    darkComplement: "#1a4a6b",
    svgPath: "/images/elements/air.svg",
  },
  {
    familyId: "quarter-opp",
    element: "moon",
    accentColor: "#6a4199",
    darkComplement: "#2a1540",
    svgPath: "/images/elements/moon.svg",
  },
] as const;
```

- [ ] **Step 3: Add `VTG_TURNS_RATIO_MAP` and `getElementalTheme()` helper**

```typescript
/** Inverse of VTG_RATIO_TURNS_MAP — maps turn values to ratio strings */
export const VTG_TURNS_RATIO_MAP: Readonly<Record<number, string>> = {
  0: "1:1",
  0.5: "2:1",
  1: "3:1",
  1.5: "4:1",
  2: "5:1",
  2.5: "6:1",
  3: "7:1",
};

export function getElementalTheme(familyId: string): ElementalTheme | null {
  return VTG_ELEMENTAL_THEMES.find((t) => t.familyId === familyId) ?? null;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/domain/elemental-theme.ts
git commit -m "feat(choreo-card): add darkComplement colors and turns-ratio map to elemental themes"
```

---

### Task 2: VTG Ratio Derivation (TDD)

**Files:**
- Modify: `src/lib/features/choreo-card/components/card-back/card-back-data.ts`
- Create: `tests/unit/VtgRatioDeriver.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/VtgRatioDeriver.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { deriveVtgRatio } from "$lib/features/choreo-card/components/card-back/card-back-data";

/** Helper: one motion per step, blue has the given turns, red is static (0) */
function makeUniform(turnValue: number, stepCount: number = 3) {
  return {
    steps: Array.from({ length: stepCount }, () => ({
      motions: {
        blue: { turns: turnValue, motionType: "pro", rotationDirection: "cw" },
        red: { turns: turnValue, motionType: "anti", rotationDirection: "ccw" },
      },
    })),
  } as any;
}

/** Helper: each step gets a different turn value (simulates LOOP sequences) */
function makeMixed(turnValues: number[]) {
  return {
    steps: turnValues.map((t) => ({
      motions: {
        blue: { turns: t, motionType: "pro", rotationDirection: "cw" },
        red: { turns: t, motionType: "anti", rotationDirection: "ccw" },
      },
    })),
  } as any;
}

describe("deriveVtgRatio", () => {
  it("returns 1:1 for uniform 0 turns", () => {
    expect(deriveVtgRatio(makeUniform(0))).toBe("1:1");
  });

  it("returns 3:1 for uniform 1 turn", () => {
    expect(deriveVtgRatio(makeUniform(1))).toBe("3:1");
  });

  it("returns 5:1 for uniform 2 turns", () => {
    expect(deriveVtgRatio(makeUniform(2))).toBe("5:1");
  });

  it("returns 2:1 for uniform 0.5 turns", () => {
    expect(deriveVtgRatio(makeUniform(0.5))).toBe("2:1");
  });

  it("returns null for mixed turn values (typical LOOP)", () => {
    expect(deriveVtgRatio(makeMixed([0, 1, 0.5, 2]))).toBeNull();
  });

  it("returns null when blue and red hands differ", () => {
    const seq = {
      steps: [{
        motions: {
          blue: { turns: 1, motionType: "pro", rotationDirection: "cw" },
          red: { turns: 0.5, motionType: "anti", rotationDirection: "ccw" },
        },
      }],
    } as any;
    expect(deriveVtgRatio(seq)).toBeNull();
  });

  it("returns 1:1 for sequences with no steps", () => {
    expect(deriveVtgRatio({ steps: [] } as any)).toBe("1:1");
  });

  it("returns null for unrecognized uniform turn values", () => {
    expect(deriveVtgRatio(makeUniform(0.7))).toBeNull();
  });

  it("ignores float turns (fl string) and checks remaining", () => {
    const seq = {
      steps: [
        {
          motions: {
            blue: { turns: "fl", motionType: "float" },
            red: { turns: 1, motionType: "pro", rotationDirection: "cw" },
          },
        },
        {
          motions: {
            blue: { turns: 1, motionType: "pro", rotationDirection: "cw" },
            red: { turns: 1, motionType: "anti", rotationDirection: "ccw" },
          },
        },
      ],
    } as any;
    expect(deriveVtgRatio(seq)).toBe("3:1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/VtgRatioDeriver.test.ts`
Expected: FAIL — `deriveVtgRatio` is not exported

- [ ] **Step 3: Implement `deriveVtgRatio` in card-back-data.ts**

Add to `card-back-data.ts`, after the existing imports:

```typescript
import { VTG_TURNS_RATIO_MAP } from "../../domain/elemental-theme";
```

Add the exported function before `deriveCardBackData`:

```typescript
/**
 * Derive the VTG ratio string from a sequence's motion turn values.
 * Only returns a ratio if ALL numeric turn values are uniform (same value).
 * Returns null for mixed turns (common in LOOP sequences where each beat
 * has different turn values, making a single ratio label misleading).
 */
export function deriveVtgRatio(sequence: SequenceData): string | null {
  let uniformValue: number | null = null;
  let hasTurns = false;

  for (const step of sequence.steps ?? []) {
    for (const motion of Object.values(step.motions ?? {})) {
      if (!motion) continue;
      const t = motion.turns;
      if (t === "fl" || typeof t !== "number") continue;
      hasTurns = true;

      if (uniformValue === null) {
        uniformValue = t;
      } else if (t !== uniformValue) {
        return null; // Mixed turns — ratio is meaningless
      }
    }
  }

  if (!hasTurns) return "1:1";

  const ratio = VTG_TURNS_RATIO_MAP[uniformValue!];
  return ratio ?? null;
}
```

- [ ] **Step 4: Add `vtgRatio` to `CardBackData` interface and `deriveCardBackData`**

Add to the `CardBackData` interface:

```typescript
/** VTG turn ratio derived from sequence motions, e.g. "3:1" */
vtgRatio: string | null;
```

Add to the return object in `deriveCardBackData()`, after `startPosition`:

```typescript
vtgRatio: deriveVtgRatio(sequence),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/VtgRatioDeriver.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 6: Run full build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 7: Commit**

```bash
git add tests/unit/VtgRatioDeriver.test.ts src/lib/features/choreo-card/components/card-back/card-back-data.ts
git commit -m "feat(choreo-card): derive VTG ratio from sequence turn data with tests"
```

---

### Task 3: Card Back — Mandala Centering, Ratio Label, Branding

**Files:**
- Modify: `src/lib/features/choreo-card/components/card-back/CardBack.svelte`

- [ ] **Step 1: Update branding markup**

Replace the `.top-brand` div (lines 173-177):

```svelte
<!-- Branding: pinned to top center, between corner badges -->
<div class="top-brand">
  <span class="brand">Choreo Card</span>
  <span class="brand-dot">·</span>
  <span class="brand-sub">TKA</span>
</div>
```

With:

```svelte
<!-- Branding: pinned to top center -->
<div class="top-brand">
  <span class="brand">CHOREO CARDS</span>
</div>
```

- [ ] **Step 2: Update branding CSS**

Replace the `.brand`, `.brand-dot`, and `.brand-sub` rules with:

```css
.brand {
  font-size: 2.8cqi;
  font-weight: 300;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.6);
}
```

Remove `.brand-dot` and `.brand-sub` CSS rules entirely.

- [ ] **Step 3: Restructure `.content` for absolute-positioned mandala**

Replace the entire `.content` div (lines 179-203) with:

```svelte
<!-- CENTER CONTENT — mandala pinned to true center -->
<div class="content">
  <div class="word" style="font-size: {wordFontCqi}cqi;">{d.word}</div>
  {#if hasGreekLetters}
    <div class="pronunciation">{pronunciation}</div>
  {/if}

  <div class="mandala-anchor">
    <SequenceMandala
      {sequence}
      mode="card-back"
      style="stroke"
      show="both"
      size={380}
    />
  </div>

  {#if d.vtgRatio}
    <div class="ratio-label">{d.vtgRatio}</div>
  {/if}

  {#if d.hasLoop}
    <p class="loop-explanation">{loopExplanationText}</p>
  {/if}
</div>
```

- [ ] **Step 4: Update `.content` and child CSS for absolute positioning**

Replace the existing `.content`, `.word`, `.pronunciation`, `.mandala-hero`, and `.loop-explanation` CSS rules with:

```css
.content {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 4cqi;
  box-sizing: border-box;
}

.word {
  position: absolute;
  top: 14%;
  font-family: Georgia, serif;
  font-size: 10.4cqi;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 1;
  white-space: nowrap;
}

.pronunciation {
  position: absolute;
  top: calc(14% + 12cqi);
  font-size: 2.6cqi;
  font-style: italic;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.02em;
}

.mandala-anchor {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72cqi;
  max-height: 72cqi;
}

/* Override the mandala's fixed pixel sizing so it fills the container */
.mandala-anchor :global(.mandala-container) {
  width: 100% !important;
  height: 100% !important;
}

.ratio-label {
  position: absolute;
  top: calc(50% + 22cqi);
  font-size: 4cqi;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.04em;
}

.loop-explanation {
  position: absolute;
  top: calc(50% + 28cqi);
  margin: 0;
  font-size: 2.6cqi;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
  max-width: 76cqi;
}
```

Also remove the `.spacer` rule if it still exists.

- [ ] **Step 5: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/card-back/CardBack.svelte
git commit -m "feat(choreo-card): pin mandala to center, add ratio label, update branding to CHOREO CARDS"
```

---

### Task 4: Add `elementTheme` to PrintRenderOptions

**Files:**
- Modify: `src/lib/features/choreo-card/services/contracts/IPrintCardRenderer.ts`

- [ ] **Step 1: Add import and field**

Add import at top:

```typescript
import type { ElementalTheme } from "../../domain/elemental-theme";
```

Add to `PrintRenderOptions` interface:

```typescript
/** VTG elemental theme for front frame coloring. Omit for neutral gray. */
elementTheme?: ElementalTheme;
```

- [ ] **Step 2: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/services/contracts/IPrintCardRenderer.ts
git commit -m "feat(choreo-card): add elementTheme to PrintRenderOptions"
```

---

### Task 5: Rewrite `renderFront()` for Stripe Frame

**Files:**
- Modify: `src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts`

- [ ] **Step 1: Add import for ElementalTheme**

Add at top of file:

```typescript
import type { ElementalTheme } from "../../domain/elemental-theme";
```

- [ ] **Step 2: Add stripe drawing helper methods**

Add these private methods to the `PrintCardRenderer` class, after the constructor:

```typescript
/** Draw a rounded rectangle path (does not fill or stroke) */
private roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

/** Fill the canvas with diagonal pinstripes */
private drawStripes(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  accent: string, dark: string,
  stripeWidth: number = 6
): void {
  // Fill base with dark color
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, w, h);

  // Draw diagonal accent stripes
  ctx.fillStyle = accent;
  const half = stripeWidth / 2;
  // Diagonal stripes need to cover the full canvas diagonal
  const diagonal = Math.sqrt(w * w + h * h);
  const count = Math.ceil(diagonal / stripeWidth) + 1;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 4); // 45 degrees

  for (let i = -count; i <= count; i++) {
    const x = i * stripeWidth;
    ctx.fillRect(x, -diagonal / 2, half, diagonal);
  }
  ctx.restore();
}

/** Draw the edge glow overlay */
private drawEdgeGlow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const glowHeight = h * 0.2;

  // Top glow
  const topGrad = ctx.createLinearGradient(0, 0, 0, glowHeight);
  topGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
  topGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, glowHeight);

  // Bottom glow
  const botGrad = ctx.createLinearGradient(0, h - glowHeight, 0, h);
  botGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
  botGrad.addColorStop(1, "rgba(255, 255, 255, 0.2)");
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, h - glowHeight, w, glowHeight);
}
```

- [ ] **Step 3: Rewrite `renderFront()` method**

Replace the entire `renderFront` method body:

```typescript
async renderFront(
  sequence: SequenceData,
  options: PrintRenderOptions
): Promise<HTMLCanvasElement> {
  const canvasW = options.canvasWidth ?? MPC_WIDTH;
  const canvasH = options.canvasHeight ?? MPC_HEIGHT;
  const bleed = options.bleedPx ?? MPC_BLEED;
  const contentW = canvasW - bleed * 2;
  const contentH = canvasH - bleed * 2;

  // Resolve element colors
  const accent = options.elementTheme?.accentColor ?? "#999999";
  const dark = options.elementTheme?.darkComplement ?? "#444444";

  // Render the sequence image
  const sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, {
    includeStartPosition: options.includeStartPosition,
    startPositionLayout: options.startPositionLayout ?? "column",
    addStepNumbers: true,
    addWord: options.showWord,
    addDifficultyLevel: true,
    stepSize: 300,
    stepScale: 1,
    margin: 0,
    format: "PNG",
    quality: 1,
    scale: 1,
    redVisible: true,
    blueVisible: true,
    addReversalSymbols: true,
    combinedGrids: false,
    userName: "Austen Cloud",
    exportDate: new Date().toISOString(),
    notes: "Created with TKA Composer",
    customNotesText: "Created with TKA Composer",
    showCreatorName: true,
    showNotes: true,
    showBirthday: true,
    loopType: sequence.loopType ?? undefined,
    showLoopGlyph: !!sequence.loopType,
    ...(options.bluePropType && { bluePropTypeOverride: options.bluePropType }),
    ...(options.redPropType && { redPropTypeOverride: options.redPropType }),
    visibilityOverrides: {
      showTKA: options.showTKA,
      showGrid: options.showGrid,
      showQRCode: options.showQRCode ?? false,
      printMode: true,
      darkMode: false,
      handPointVisibility: options.handPointsVisible ? "all" : "none",
      ...(options.bluePropType && { bluePropType: options.bluePropType }),
      ...(options.redPropType && { redPropType: options.redPropType }),
    },
  });

  // Build the card canvas
  const mpcCanvas = document.createElement("canvas");
  mpcCanvas.width = canvasW;
  mpcCanvas.height = canvasH;
  const ctx = mpcCanvas.getContext("2d")!;

  const outerRadius = 12;
  const innerRadius = 8;

  // 1. Clip to rounded outer card shape
  ctx.save();
  this.roundRectPath(ctx, 0, 0, canvasW, canvasH, outerRadius);
  ctx.clip();

  // 2. Draw stripe pattern across entire canvas
  this.drawStripes(ctx, canvasW, canvasH, accent, dark);

  // 3. Draw edge glow overlay
  this.drawEdgeGlow(ctx, canvasW, canvasH);

  // 4. Clip inner content area (rounded rect inside bleed)
  ctx.save();
  this.roundRectPath(ctx, bleed, bleed, contentW, contentH, innerRadius);
  ctx.clip();

  // 5. Fill inner area with white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bleed, bleed, contentW, contentH);

  // 6. Draw sequence image edge-to-edge in content area
  const scaleX = contentW / sequenceCanvas.width;
  const scaleY = contentH / sequenceCanvas.height;
  const scale = Math.min(scaleX, scaleY);
  const drawW = sequenceCanvas.width * scale;
  const drawH = sequenceCanvas.height * scale;
  const offsetX = bleed + (contentW - drawW) / 2;
  const offsetY = bleed + (contentH - drawH) / 2;

  ctx.drawImage(sequenceCanvas, offsetX, offsetY, drawW, drawH);

  ctx.restore(); // inner clip
  ctx.restore(); // outer clip

  return mpcCanvas;
}
```

- [ ] **Step 4: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts
git commit -m "feat(choreo-card): rewrite renderFront with stripe frame, edge glow, and rounded corners"
```

---

### Task 6: Thread Element Theme Through Callers

**Files:**
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`
- Modify: `src/lib/features/choreo-card/components/VtgFamilyDrillDown.svelte`
- Modify: `src/lib/features/choreo-card/components/DeckBrowser.svelte`

- [ ] **Step 1: Add `elementTheme` prop to `PrintPreviewPages.svelte`**

Add import at top:

```typescript
import type { ElementalTheme } from "../../domain/elemental-theme";
```

Add to the `Props` interface:

```typescript
elementTheme?: ElementalTheme;
```

Add to the destructured props:

```typescript
elementTheme,
```

- [ ] **Step 2: Pass `elementTheme` into render options**

In the `buildRenderOptions` function, add `elementTheme` to the returned object:

```typescript
elementTheme,
```

- [ ] **Step 3: Update `PrintPreviewPages.svelte` card cell border-radius**

In the `<style>` block, change:

```css
.card-cell {
  overflow: hidden;
  border-radius: 4px;
  background: #f0f0f0;
}
```

To:

```css
.card-cell {
  overflow: hidden;
  border-radius: 8px;
  background: #f0f0f0;
}
```

- [ ] **Step 4: Pass element theme from `VtgFamilyDrillDown.svelte`**

In `VtgFamilyDrillDown.svelte`, the `theme` variable already resolves to the correct `ElementalTheme`. Pass it to `PrintPreviewPages`:

Find the `<PrintPreviewPages` usage and add:

```svelte
elementTheme={theme}
```

- [ ] **Step 5: Verify `DeckBrowser.svelte` — no change needed**

`DeckBrowser.svelte` renders LOOP decks. It does not pass `elementTheme`, so `PrintPreviewPages` will receive `undefined`, and `PrintCardRenderer.renderFront()` will fall back to neutral gray stripes. No code change required — just verify the default behavior is correct.

- [ ] **Step 6: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte src/lib/features/choreo-card/components/VtgFamilyDrillDown.svelte
git commit -m "feat(choreo-card): thread element theme to print preview, add rounded card cells"
```

---

### Task 7: Run All Tests and Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass, including new VtgRatioDeriver tests

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors
