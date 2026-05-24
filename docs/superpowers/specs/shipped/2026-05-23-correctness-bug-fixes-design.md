# Correctness Bug Fixes (2026-05-23 Audit)

Four bugs found during code audit. All are small, surgical fixes.

---

## Bug 1: Mandala Cache Key Missing rotationDirection

**File:** `src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts`
**Line:** 496 (`buildCacheKey`)

### Problem

`buildCacheKey` hashes each motion using only `motionType`, `startLocation`, `endLocation`, and `turns`. It omits `rotationDirection`, `startOrientation`, and `endOrientation`. Two sequences that differ only in CW vs CCW (or in orientation) produce identical cache keys. The second lookup returns the wrong cached geometry silently.

This is data corruption: mandala SVG paths render the wrong shape with no error signal.

### Current (broken) code

```ts
if (b)
  parts.push(
    b.motionType + b.startLocation + b.endLocation + (b.turns ?? 0)
  );
if (r)
  parts.push(
    r.motionType + r.startLocation + r.endLocation + (r.turns ?? 0)
  );
```

### Fix

Include all fields that `extractMotion` normalizes (line 385-393) and that `calculateMotionEndpoints` consumes (line 129-136). Those fields are: `motionType`, `rotationDirection`, `startLocation`, `endLocation`, `startOrientation`, `endOrientation`, `turns`.

```ts
if (b)
  parts.push(
    b.motionType +
    b.rotationDirection +
    b.startLocation +
    b.endLocation +
    (b.startOrientation ?? '') +
    (b.endOrientation ?? '') +
    (b.turns ?? 0)
  );
if (r)
  parts.push(
    r.motionType +
    r.rotationDirection +
    r.startLocation +
    r.endLocation +
    (r.startOrientation ?? '') +
    (r.endOrientation ?? '') +
    (r.turns ?? 0)
  );
```

Note: `buildCacheKey` reads raw `StepLike` motions (which have `rotationDirection`, `startOrientation`, `endOrientation`), not the `NormalizedMotion` struct. The field names on the raw motion are `rotationDirection`, `startOrientation`, `endOrientation` per the `MotionLike` interface used at line 387-391.

### Verification

1. `npm run check` passes (type safety).
2. Open two sequences that share the same locations and turns but differ in rotation direction (e.g. CW vs CCW on the same letter). Render mandalas for both. Confirm the SVG paths are visually distinct (they should be mirror images). Before the fix, both would render identical geometry.

---

## Bug 2: validateFormatOptions Always Returns False

**File:** `src/lib/shared/render/services/implementations/ImageFormatConverter.ts`
**Line:** 169

### Problem

The `ImageFormatOptions` interface (line 5-9) defines `format` as `"png" | "jpeg" | "webp"` (lowercase). The validation check compares against `["PNG", "JPEG", "WEBP"]` (uppercase). Since `"png" !== "PNG"`, the `includes()` call always returns `false`. Format validation is silently bypassed everywhere this method is called.

### Current (broken) code

```ts
validateFormatOptions(options: ImageFormatOptions): boolean {
  return options && ["PNG", "JPEG", "WEBP"].includes(options.format);
}
```

### Fix

Match the case of the type definition:

```ts
validateFormatOptions(options: ImageFormatOptions): boolean {
  return options && ["png", "jpeg", "webp"].includes(options.format);
}
```

### Verification

1. `npm run check` passes.
2. Unit test or manual: call `validateFormatOptions({ format: "png" })` and confirm it returns `true`. Before the fix it returned `false`.

---

## Bug 3: dataUrlToCanvas Hangs Forever on Corrupt URLs

**File:** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`
**Lines:** 339-350

### Problem

`dataUrlToCanvas` creates an `Image`, sets `onload`, and sets `src`. If the data URL is corrupt or the image fails to decode, `onerror` is never attached. The Promise never resolves or rejects. Because `reconstructPair` (line 331) awaits two of these in `Promise.all`, the entire print render pipeline hangs forever with no error feedback and no way to recover.

### Current (broken) code

```ts
function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.src = dataUrl;
  });
}
```

### Fix

Add `reject` to the Promise constructor and wire up `onerror`:

```ts
function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Failed to load image from data URL"));
    img.src = dataUrl;
  });
}
```

The caller (`reconstructPair` at line 331) uses `Promise.all`, so a rejection will propagate up to the print pipeline's `try/catch` (or needs one added). Verify the caller handles rejection gracefully; if it doesn't, add a `try/catch` around the `reconstructPair` call that logs the error and skips the corrupt card.

### Verification

1. `npm run check` passes.
2. Manual test: corrupt a card's `frontUrl` (e.g., set it to `"data:image/png;base64,INVALID"`). Before the fix, the print preview hangs indefinitely. After the fix, the error is caught and the pipeline either skips the bad card or shows an error message instead of hanging.

---

## Bug 4: Export Back Button Closes Drawer Instead of Exiting Export Mode

**File:** `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
**Line:** 293

### Problem

When in export mode (`isAnyExportActive` is true), the back button in the drawer header calls `handleDismiss` (line 293). `handleDismiss` (line 241) calls `closeSequenceOverlay()` and navigates away, closing the entire drawer. The expected behavior is to exit export mode and return to the normal viewer, not close the drawer.

The correct method already exists: `ctx.viewerState.exitExport()` (used at line 437 in the content rail). `exitExport()` clears `exportContext` without closing the drawer (viewer-state.svelte.ts line 54-56).

### Current (broken) code

```svelte
{#if isAnyExportActive}
  <button
    type="button"
    class="drawer-back-button"
    onclick={handleDismiss}
    aria-label="Close viewer"
  >
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    <span class="drawer-back-label">Back</span>
  </button>
```

### Fix

Replace `handleDismiss` with `ctx.viewerState.exitExport()` and update the aria-label:

```svelte
{#if isAnyExportActive}
  <button
    type="button"
    class="drawer-back-button"
    onclick={() => ctx.viewerState.exitExport()}
    aria-label="Exit export mode"
  >
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    <span class="drawer-back-label">Back</span>
  </button>
```

### Verification

1. `npm run check` passes.
2. Open a sequence in the viewer drawer. Enter export mode (e.g., click "Download Animation" or "Download Card"). Click the back arrow in the header. Before the fix, the entire drawer closes. After the fix, the drawer stays open and returns to the normal viewer state.

---

## Implementation Order

All four fixes are independent. No ordering constraints. Each is a single-file, few-line change.

| Bug | Risk | Lines changed |
|-----|------|---------------|
| 1. Cache key | High (silent data corruption) | ~6 |
| 2. Format validation | Low (validation bypass, no visible symptoms yet) | ~1 |
| 3. Image onerror | Medium (hangs print pipeline on corrupt data) | ~2 |
| 4. Export back button | Medium (UX regression, drawer closes unexpectedly) | ~2 |
