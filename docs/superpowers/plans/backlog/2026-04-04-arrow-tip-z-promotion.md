# Arrow Tip Z-Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When two arrows overlap, promote the behind-arrow's tip above the front-arrow's shaft so both arrowheads are always visible.

**Architecture:** Pre-split each arrow SVG into shaft + tip portions using a standalone splitter tool. Store results in a JSON manifest. At render time, detect overlap and conditionally render arrows as two z-layers instead of one.

**Tech Stack:** Svelte 5, TypeScript, SVG path geometry (in splitter tool only), AABB intersection (in renderer)

**Spec:** `docs/superpowers/specs/2026-04-04-arrow-tip-z-promotion-design.md`

---

### Task 1: Add Split Fields to Data Models

**Files:**
- Modify: `src/lib/shared/pictograph/shared/domain/models/svg-models.ts`
- Modify: `src/lib/shared/pictograph/arrow/orchestration/domain/arrow-models.ts`
- Modify: `src/lib/shared/pictograph/arrow/orchestration/domain/arrow-factories.ts`

- [ ] **Step 1: Add optional split fields to `ArrowSvgData`**

In `svg-models.ts`, add to the `ArrowSvgData` interface:

```typescript
export interface ArrowSvgData {
  id: string;
  svgContent: string;
  dimensions: SVGDimensions;
  imageSrc?: string | undefined;
  viewBox?: string | undefined;
  center?: { x: number; y: number } | undefined;
  // Arrow tip z-promotion: pre-split shaft/tip SVG content
  shaftSrc?: string;
  tipSrc?: string;
  tipBBox?: { x: number; y: number; width: number; height: number };
}
```

- [ ] **Step 2: Add optional split fields to `ArrowAssets`**

In `arrow-models.ts`, add to the `ArrowAssets` interface:

```typescript
export interface ArrowAssets {
  readonly imageSrc: string;
  readonly viewBox: {
    width: number;
    height: number;
    fullViewBox?: string;
  };
  readonly center: { x: number; y: number };
  // Arrow tip z-promotion: pre-split shaft/tip SVG content
  readonly shaftSrc?: string;
  readonly tipSrc?: string;
  readonly tipBBox?: { x: number; y: number; width: number; height: number };
}
```

- [ ] **Step 3: Map split fields through `createArrowAssets()`**

In `arrow-factories.ts`, update the factory:

```typescript
export function createArrowAssets(data: Partial<ArrowAssets>): ArrowAssets {
  return {
    imageSrc: data.imageSrc ?? "",
    viewBox: data.viewBox ?? { width: 0, height: 0 },
    center: data.center ?? { x: 0, y: 0 },
    shaftSrc: data.shaftSrc,
    tipSrc: data.tipSrc,
    tipBBox: data.tipBBox,
  };
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No new errors. The fields are optional so nothing downstream breaks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/shared/domain/models/svg-models.ts src/lib/shared/pictograph/arrow/orchestration/domain/arrow-models.ts src/lib/shared/pictograph/arrow/orchestration/domain/arrow-factories.ts
git commit -m "feat(arrow): add optional shaft/tip split fields to arrow data models"
```

---

### Task 2: Load Manifest and Populate Split Fields in ArrowSvgLoader

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/rendering/services/implementations/ArrowSvgLoader.ts`

- [ ] **Step 1: Add manifest loading to ArrowSvgLoader**

Add a module-level manifest cache and loader. The manifest is fetched lazily on first arrow load. If it fails, rendering continues without split data.

At the top of `ArrowSvgLoader.ts`, after the existing HMR cache declarations (~line 53), add:

```typescript
// Arrow split manifest - loaded lazily, cached permanently
let hmrSplitManifest: Record<string, { shaftPath: string; tipPath: string; tipBBox: { x: number; y: number; width: number; height: number } }> | null =
  import.meta.hot?.data?.splitManifest ?? null;
let manifestLoadPromise: Promise<void> | null = null;

if (import.meta.hot) {
  // Amend the existing dispose handler - add to the existing block
  const existingDispose = import.meta.hot.data;
  import.meta.hot.dispose((data) => {
    data.rawSvgCache = hmrRawSvgCache;
    data.transformedSvgCache = hmrTransformedSvgCache;
    data.splitManifest = hmrSplitManifest;
    data.arrowSvgLoaderInstance = hmrArrowSvgLoader;
  });
}

async function loadSplitManifest(): Promise<void> {
  if (hmrSplitManifest !== null) return;
  if (manifestLoadPromise) return manifestLoadPromise;

  manifestLoadPromise = (async () => {
    try {
      const response = await fetch("/images/arrows/arrow-split-manifest.json");
      if (response.ok) {
        hmrSplitManifest = await response.json();
      } else {
        hmrSplitManifest = {};
      }
    } catch {
      hmrSplitManifest = {};
    }
  })();

  return manifestLoadPromise;
}
```

Note: The existing HMR dispose handler on lines 48-52 will need to be consolidated with this new one into a single dispose call.

- [ ] **Step 2: Populate split fields in `loadArrowSvg()`**

In the `loadArrowSvg` method, after the `result` object is constructed (~line 134), add manifest lookup before caching:

```typescript
    // Look up split data from manifest
    await loadSplitManifest();
    if (hmrSplitManifest) {
      // Strip base path to get relative key (e.g. "pro/from_radial/pro_0.0.svg")
      const manifestKey = path.replace(/^.*\/images\/arrows\//, "");
      const splitData = hmrSplitManifest[manifestKey];
      if (splitData) {
        // Apply color transformation to split paths too
        result.shaftSrc = this.colorTransformer.applyColorToSvg(
          splitData.shaftPath,
          motionData.color,
          themeMode
        );
        result.tipSrc = this.colorTransformer.applyColorToSvg(
          splitData.tipPath,
          motionData.color,
          themeMode
        );
        result.tipBBox = splitData.tipBBox;
      }
    }
```

Note: The `shaftPath` and `tipPath` in the manifest store raw SVG path content with the default blue fill. The color transformer converts them to the correct color, same as the main `imageSrc`.

- [ ] **Step 3: Map split fields through ArrowLifecycleManager**

In `ArrowLifecycleManager.ts`, update the `loadArrowAssets` method (~line 57) to pass split fields through:

```typescript
    return createArrowAssets({
      imageSrc: svgData.imageSrc,
      viewBox: {
        width: svgData.dimensions.width,
        height: svgData.dimensions.height,
        fullViewBox: svgData.dimensions.viewBox || svgData.viewBox,
      },
      center: svgData.center ?? svgData.dimensions.center,
      shaftSrc: svgData.shaftSrc,
      tipSrc: svgData.tipSrc,
      tipBBox: svgData.tipBBox,
    });
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/arrow/rendering/services/implementations/ArrowSvgLoader.ts src/lib/shared/pictograph/arrow/orchestration/services/implementations/ArrowLifecycleManager.ts
git commit -m "feat(arrow): load split manifest and populate shaft/tip fields"
```

---

### Task 3: Add `renderPart` Prop to ArrowSvg.svelte

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/rendering/components/ArrowSvg.svelte`

- [ ] **Step 1: Add `renderPart` prop**

In the `$props()` declaration (~line 43), add:

```typescript
  let {
    motionData,
    arrowAssets,
    arrowPosition,
    shouldMirror = false,
    showArrow = true,
    color,
    pictographData = null,
    isClickable = false,
    cellIndex = null,
    darkMode = undefined,
    renderPart = undefined,
  } = $props<{
    motionData: MotionData;
    arrowAssets: ArrowAssets;
    arrowPosition: ArrowPosition;
    shouldMirror?: boolean;
    showArrow?: boolean;
    color: string;
    pictographData?: PictographData | null;
    isClickable?: boolean;
    cellIndex?: number | null;
    darkMode?: boolean;
    renderPart?: "shaft" | "tip";
  }>();
```

- [ ] **Step 2: Use `renderPart` in the template**

Replace the `{@html}` rendering block (~line 470-472):

```svelte
    <g transform="translate({-safeCenter.x}, {-safeCenter.y})">
      {@html arrowAssets.imageSrc}
    </g>
```

With:

```svelte
    <g transform="translate({-safeCenter.x}, {-safeCenter.y})">
      {#if renderPart === "shaft" && arrowAssets.shaftSrc}
        {@html arrowAssets.shaftSrc}
      {:else if renderPart === "tip" && arrowAssets.tipSrc}
        {@html arrowAssets.tipSrc}
      {:else}
        {@html arrowAssets.imageSrc}
      {/if}
    </g>
```

This means: if `renderPart` is set and split data exists, render that part. Otherwise fall back to the full combined arrow (backwards compatible).

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/pictograph/arrow/rendering/components/ArrowSvg.svelte
git commit -m "feat(arrow): add renderPart prop for shaft/tip split rendering"
```

---

### Task 4: Add Overlap Detection and Conditional Rendering to PictographRenderer

**Files:**
- Modify: `src/lib/shared/pictograph/shared/components/PictographRenderer.svelte`

- [ ] **Step 1: Add overlap detection `$derived`**

After the existing `motions` derived block (~line 206), add:

```typescript
  // Arrow tip z-promotion: detect when behind-arrow's tip is buried under front-arrow's shaft
  const tipPromotionNeeded = $derived.by(() => {
    // Need exactly 2 arrows with split data to detect overlap
    if (motions.length < 2) return false;

    const blue = motions.find(m => m.color === "blue");
    const red = motions.find(m => m.color === "red");
    if (!blue || !red) return false;

    const blueAssets = arrowAssets["blue"];
    const redAssets = arrowAssets["red"];
    const bluePos = arrowPositions["blue"];
    const redPos = arrowPositions["red"];

    // Both arrows need split data and positions
    if (!blueAssets?.tipBBox || !bluePos || !redAssets || !redPos) return false;

    // Transform blue tip bbox to pictograph space
    // (simplified: offset by arrow position, ignore rotation for AABB approximation)
    const blueTip = {
      x: bluePos.x + blueAssets.tipBBox.x - (blueAssets.center?.x ?? 0),
      y: bluePos.y + blueAssets.tipBBox.y - (blueAssets.center?.y ?? 0),
      width: blueAssets.tipBBox.width,
      height: blueAssets.tipBBox.height,
    };

    // Red arrow overall bbox in pictograph space
    const redBox = {
      x: redPos.x - (redAssets.center?.x ?? 0),
      y: redPos.y - (redAssets.center?.y ?? 0),
      width: redAssets.viewBox.width,
      height: redAssets.viewBox.height,
    };

    // AABB intersection test
    return (
      blueTip.x < redBox.x + redBox.width &&
      blueTip.x + blueTip.width > redBox.x &&
      blueTip.y < redBox.y + redBox.height &&
      blueTip.y + blueTip.height > redBox.y
    );
  });
```

- [ ] **Step 2: Update the arrow rendering section**

Replace the `<!-- Arrows -->` section (the `{#each motions}` block that renders ArrowSvg) with:

```svelte
      <!-- Arrows -->
      {#if tipPromotionNeeded}
        <!-- Split rendering: shafts first, then tips on top -->
        {#each motions as { color, data, opacity } (color + "-shaft")}
          {#if arrowAssets[color] && arrowPositions[color]}
            <g opacity={opacity}>
              <ArrowSvg
                motionData={data}
                {color}
                pictographData={pictograph}
                arrowAssets={arrowAssets[color]}
                arrowPosition={arrowPositions[color]}
                shouldMirror={arrowMirroring[color] || false}
                showArrow={true}
                isClickable={arrowsClickable}
                {cellIndex}
                {darkMode}
                renderPart="shaft"
              />
            </g>
          {/if}
        {/each}
        {#each motions as { color, data, opacity } (color + "-tip")}
          {#if arrowAssets[color] && arrowPositions[color]}
            <g opacity={opacity}>
              <ArrowSvg
                motionData={data}
                {color}
                pictographData={pictograph}
                arrowAssets={arrowAssets[color]}
                arrowPosition={arrowPositions[color]}
                shouldMirror={arrowMirroring[color] || false}
                showArrow={true}
                isClickable={arrowsClickable}
                {cellIndex}
                {darkMode}
                renderPart="tip"
              />
            </g>
          {/if}
        {/each}
      {:else}
        <!-- Normal rendering: single combined path per arrow (identical to current behavior) -->
        {#each motions as { color, data, opacity } (color)}
          {#if arrowAssets[color] && arrowPositions[color]}
            <g opacity={opacity}>
              <ArrowSvg
                motionData={data}
                {color}
                pictographData={pictograph}
                arrowAssets={arrowAssets[color]}
                arrowPosition={arrowPositions[color]}
                shouldMirror={arrowMirroring[color] || false}
                showArrow={true}
                isClickable={arrowsClickable}
                {cellIndex}
                {darkMode}
              />
            </g>
          {/if}
        {/each}
      {/if}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/pictograph/shared/components/PictographRenderer.svelte
git commit -m "feat(arrow): add overlap detection and conditional tip z-promotion rendering"
```

---

### Task 5: Build the Arrow Splitter Tool

**Files:**
- Create: `tools/arrow-splitter.html`

This is the largest task — a standalone HTML file with no external dependencies that lets the user visually split each arrow SVG into shaft + tip portions.

- [ ] **Step 1: Create the splitter tool**

Create `tools/arrow-splitter.html` — a self-contained HTML page with:

**UI Layout:**
- Large canvas showing the current arrow SVG path
- Instructions: "Click two points to draw a cut line"
- Preview panel showing shaft (green) and tip (orange) after splitting
- Overlap margin slider (default 8 SVG units)
- "Save & Next" / "Skip" / "Previous" buttons
- Progress bar (1/60, 2/60...)
- "Load Existing Manifest" file input for resume/edit
- "Download Manifest" button

**Core Logic:**

1. **SVG Path Parsing:** Parse the `d` attribute into an array of segment objects (M, C, c, L, l, z commands with coordinates). Convert relative commands (c, l) to absolute (C, L) for easier math.

2. **Cut Line Drawing:** User clicks two points on the canvas. A line is drawn between them.

3. **Path Splitting:** For each path segment, determine which side of the cut line it falls on:
   - For each bezier curve (C command), use De Casteljau subdivision to find intersection points with the cut line
   - Split intersected curves at the intersection parameter `t`
   - Assign each sub-segment to shaft or tip based on which side of the line it's on
   - The side with fewer path commands is the tip (arrowheads are small)

4. **Overlap Margin:** Extend both the shaft and tip paths past the cut line by the margin amount. This means the De Casteljau split happens at `t - margin` and `t + margin` instead of exactly at `t`.

5. **Preview:** Render shaft segments in green and tip segments in orange on a second canvas. User visually confirms the split looks right.

6. **Tip BBox Calculation:** Compute the axis-aligned bounding box of the tip path segments.

7. **Manifest Assembly:** Each saved arrow gets an entry:
   ```json
   {
     "shaftPath": "<path d='...' style='fill:#2e3192'/>",
     "tipPath": "<path d='...' style='fill:#2e3192'/>",
     "tipBBox": { "x": 180, "y": 200, "width": 80, "height": 60 }
   }
   ```

8. **Arrow Loading:** The tool needs to load SVGs from the local filesystem. Since it's a standalone HTML file opened in a browser, it can't read files directly. Two options:
   - Serve via `npx serve static/` and load from `/images/arrows/...`
   - Or include a file-picker to load the `static/images/arrows/` directory

   Use the serve approach: instructions in the tool say to run `npx serve static/ -p 8080` and open `tools/arrow-splitter.html` in the browser. SVGs load from `http://localhost:8080/images/arrows/...`.

**Arrow file list** (hardcoded in the tool since the set is fixed):

```javascript
const ARROW_FILES = [
  // pro/from_radial (9)
  "pro/from_radial/pro_0.0.svg",
  "pro/from_radial/pro_0.0_skew+.svg",
  "pro/from_radial/pro_0.0_skew-.svg",
  "pro/from_radial/pro_0.5.svg",
  "pro/from_radial/pro_1.0.svg",
  "pro/from_radial/pro_1.5.svg",
  "pro/from_radial/pro_2.0.svg",
  "pro/from_radial/pro_2.5.svg",
  "pro/from_radial/pro_3.0.svg",
  // pro/from_nonradial (7)
  "pro/from_nonradial/pro_0.0.svg",
  "pro/from_nonradial/pro_0.5.svg",
  "pro/from_nonradial/pro_1.0.svg",
  "pro/from_nonradial/pro_1.5.svg",
  "pro/from_nonradial/pro_2.0.svg",
  "pro/from_nonradial/pro_2.5.svg",
  "pro/from_nonradial/pro_3.0.svg",
  // anti/from_radial (8)
  "anti/from_radial/anti_0.0.svg",
  "anti/from_radial/anti_0.5.svg",
  "anti/from_radial/anti_1.0.svg",
  "anti/from_radial/anti_1.5.svg",
  "anti/from_radial/anti_2.0.svg",
  "anti/from_radial/anti_2.5.svg",
  "anti/from_radial/anti_3.0.svg",
  "anti/from_radial/anti_0.0_skew+.svg",  // verify this exists
  // anti/from_nonradial (8)
  "anti/from_nonradial/anti_0.0.svg",
  "anti/from_nonradial/anti_0.5.svg",
  "anti/from_nonradial/anti_1.0.svg",
  "anti/from_nonradial/anti_1.5.svg",
  "anti/from_nonradial/anti_2.0.svg",
  "anti/from_nonradial/anti_2.5.svg",
  "anti/from_nonradial/anti_3.0.svg",
  "anti/from_nonradial/anti_0.0_skew+.svg",  // verify
  // dash/from_radial (7)
  "dash/from_radial/dash_0.0.svg",
  "dash/from_radial/dash_0.5.svg",
  "dash/from_radial/dash_1.0.svg",
  "dash/from_radial/dash_1.5.svg",
  "dash/from_radial/dash_2.0.svg",
  "dash/from_radial/dash_2.5.svg",
  "dash/from_radial/dash_3.0.svg",
  // dash/from_nonradial (7)
  "dash/from_nonradial/dash_0.0.svg",
  "dash/from_nonradial/dash_0.5.svg",
  "dash/from_nonradial/dash_1.0.svg",
  "dash/from_nonradial/dash_1.5.svg",
  "dash/from_nonradial/dash_2.0.svg",
  "dash/from_nonradial/dash_2.5.svg",
  "dash/from_nonradial/dash_3.0.svg",
  // static arrows with real content (exclude static_0.0 which is empty)
  "static/from_radial/static_0.5.svg",
  "static/from_radial/static_1.0.svg",
  "static/from_radial/static_1.5.svg",
  "static/from_radial/static_2.0.svg",
  "static/from_radial/static_2.5.svg",
  "static/from_radial/static_3.0.svg",
  "static/from_nonradial/static_0.5.svg",
  "static/from_nonradial/static_1.0.svg",
  "static/from_nonradial/static_1.5.svg",
  "static/from_nonradial/static_2.0.svg",
  "static/from_nonradial/static_2.5.svg",
  "static/from_nonradial/static_3.0.svg",
];
```

Note: The exact file list should be verified at implementation time by scanning the directory. Some entries above (skew variants) may need adjustment.

- [ ] **Step 2: Test the splitter tool manually**

Open in browser, split 2-3 arrows, verify the preview looks correct, download the manifest, and inspect the JSON structure.

- [ ] **Step 3: Commit**

```bash
git add tools/arrow-splitter.html
git commit -m "feat(tools): add arrow splitter tool for shaft/tip separation"
```

---

### Task 6: Generate the Manifest (User Action)

This is the user's task — not code. The user opens the splitter tool and processes all 60 arrows.

- [ ] **Step 1: Serve the static directory**

Run: `npx serve static/ -p 8080`

- [ ] **Step 2: Open the splitter tool**

Open `tools/arrow-splitter.html` in Chrome. The tool loads arrows from `http://localhost:8080/images/arrows/...`.

- [ ] **Step 3: Process all arrows**

Draw cut lines for each arrow. Verify previews. Save & Next through all 60.

- [ ] **Step 4: Download and place the manifest**

Download `arrow-split-manifest.json` from the tool and place it at `static/images/arrows/arrow-split-manifest.json`.

- [ ] **Step 5: Commit the manifest**

```bash
git add static/images/arrows/arrow-split-manifest.json
git commit -m "data(arrow): add shaft/tip split manifest for all 60 arrows"
```

---

### Task 7: Integration Test

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Visual verification**

Navigate to a pictograph with overlapping arrows (e.g. the J pictograph from the original screenshot). Verify:
- Non-overlapping arrows look identical to before
- When arrows overlap and the behind-arrow's tip is buried, the tip appears above the front-arrow's shaft
- No visible seam at the split point
- Arrow click interaction still works
- Arrow selection glow still works

- [ ] **Step 4: Regression check**

Browse through several pictographs in the sequence viewer. Verify no visual regressions on arrows that don't overlap.
