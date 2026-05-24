---
phase: mandala-render-review
reviewed: 2026-05-23T21:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/lib/shared/mandala/components/SequenceMandala.svelte
  - src/lib/shared/mandala/domain/mandala-constants.ts
  - src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts
  - src/lib/shared/mandala/services/implementations/MandalaPathPreparer.ts
  - src/lib/shared/mandala/services/mandala-renderer.ts
  - src/lib/shared/library/data/firestore-paths.ts
  - src/lib/features/background-builder/components/VoidLab.svelte
  - src/lib/features/lab/LabModule.svelte
  - src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts
  - src/lib/features/themes-lab/state/themes-lab-state.svelte.ts
  - src/lib/features/retro/dos/services/implementations/SvgToBrailleConverter.ts
  - src/routes/q/[code]/+page.svelte
  - src/routes/sequence/[id]/+page.svelte
  - src/routes/test/card-back-capture/+page.svelte
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Mandala System & Render Pipeline Code Review

**Reviewed:** 2026-05-23T21:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the mandala geometry pipeline (calculator, path preparer, renderer), supporting constants and types, Firestore path helpers, lab state management, the Braille converter, and three route files. The geometry math is well-structured with correct Catmull-Rom spline conversion and proper staff angle chaining. The Firestore paths module is clean with correct odd/even segment conventions. The main concerns are: (1) an incomplete cache key in MandalaGeometryCalculator that can return stale geometry when orientation or rotation direction changes, (2) a module-level counter in mandala-renderer.ts that produces colliding SVG filter/mask IDs under SSR or concurrent renders, and (3) an XSS vector in the QR video route via `{@html svgString}`. Several smaller quality issues noted below.

## Warnings

### WR-01: MandalaGeometryCalculator cache key omits orientation and rotation direction

**File:** `src/lib/shared/mandala/services/implementations/MandalaGeometryCalculator.ts:496-513`
**Issue:** `buildCacheKey` hashes `motionType`, `startLocation`, `endLocation`, and `turns` for each motion, but omits `rotationDirection`, `startOrientation`, and `endOrientation`. Two sequences that differ only in rotation direction (e.g. CW vs CCW) or orientation (e.g. "in" vs "out") will produce the same cache key and return incorrect cached geometry. This is a correctness bug -- the wrong mandala will silently render.
**Fix:**
```ts
if (b)
  parts.push(
    b.motionType + b.startLocation + b.endLocation +
    (b.turns ?? 0) + (b.rotationDirection ?? "") +
    (b.startOrientation ?? "") + (b.endOrientation ?? "")
  );
if (r)
  parts.push(
    r.motionType + r.startLocation + r.endLocation +
    (r.turns ?? 0) + (r.rotationDirection ?? "") +
    (r.startOrientation ?? "") + (r.endOrientation ?? "")
  );
```

### WR-02: Module-level maskIdCounter grows unbounded and can collide in SSR

**File:** `src/lib/shared/mandala/services/mandala-renderer.ts:36`
**Issue:** `let maskIdCounter = 0` is module-scoped and incremented on every call to `renderMandalaSVG`. In a long-lived SPA session this counter grows without bound (minor), but the real risk is SSR: if this module is loaded server-side, the counter resets on every request, producing identical IDs across different renders. If two mandala SVGs coexist in the same DOM (e.g. a gallery grid), they will share `glow`, `feather0`, `bloom0`, etc. filter/mask IDs, causing incorrect visual output. The `glow` filter ID at line 113 is not namespaced at all and will always collide between multiple mandala SVGs on the same page.
**Fix:** Use `crypto.randomUUID().slice(0, 8)` or a passed-in unique key per render call instead of a global counter. Also namespace the `glow` filter:
```ts
const uid = crypto.randomUUID().slice(0, 8);
// Then use id="glow-${uid}" everywhere
```

### WR-03: {@html svgString} in SequenceMandala is an XSS vector if sequence data is untrusted

**File:** `src/lib/shared/mandala/components/SequenceMandala.svelte:166`
**Issue:** `{@html svgString}` renders raw HTML into the DOM. The SVG string is constructed from `renderMandalaSVG`, which interpolates numeric path data from sequence steps. If a crafted sequence contained specially-formed location/orientation strings that survive through to path `d` attributes, arbitrary markup could be injected. The risk is mitigated by the fact that `MandalaGeometryCalculator` processes values through `Math.cos`/`Math.sin` (which coerce to NaN for non-numeric input), but the string interpolation in `renderMandalaSVG` (palette colors, filter attributes) does not sanitize caller-provided values in the `palette` object.
**Fix:** Validate that palette color strings match a safe pattern (hex or rgba) before interpolation:
```ts
function sanitizeColor(c: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
  if (/^rgba?\(\d/.test(c)) return c;
  return "#888"; // fallback
}
```

### WR-04: MandalaPathPreparer cache uses reference equality for steps array

**File:** `src/lib/shared/mandala/services/implementations/MandalaPathPreparer.ts:97`
**Issue:** The cache check `this.cachedSteps === steps` uses reference equality. If the caller provides a new array reference with identical content (common in Svelte 5 reactive derivations where `$derived` creates new arrays), the cache will miss every time, defeating its purpose. This doesn't cause incorrect output but means the "simple cache" provides no benefit in the most common usage pattern.
**Fix:** Use a content-based comparison, or delegate to the inner `MandalaGeometryCalculator`'s own LRU cache (which already does string-key comparison) and remove the redundant outer cache:
```ts
// Option A: remove outer cache, rely on inner calculator's cache
prepare(steps, canvasSize, show) {
  const stepsWithMotions = steps.filter(s => s.motions?.blue || s.motions?.red);
  if (stepsWithMotions.length === 0) return null;
  const mandalaPaths = this.geometryCalculator.calculate(steps);
  // ... rest unchanged
}
```

### WR-05: QR video route blob URLs are never revoked

**File:** `src/routes/q/[code]/+page.svelte:393`
**Issue:** When a new video renders (prop change, effect change, or initial render), `URL.createObjectURL(blob)` is called, but the previous blob URL is never revoked. Each prop/effect change leaks a video-sized blob in memory. On a mobile device scanning a QR code and experimenting with different props, this can accumulate hundreds of MB.
**Fix:** Track and revoke the previous blob URL before creating a new one:
```ts
let currentBlobUrl: string | null = null;

// In the worker onmessage handler, before setting pageState:
if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
currentBlobUrl = blobUrl;
```
Also revoke on component destroy via `onDestroy`.

## Info

### IN-01: Comment/value mismatch in MANDALA_STANDARD_TIP_DX

**File:** `src/lib/shared/mandala/domain/mandala-constants.ts:1-3`
**Issue:** The JSDoc comment says "dx=125 is the sweet spot" but the actual value is `130`. This creates confusion about the intended value.
**Fix:** Update comment to match the actual value:
```ts
/** Standardized tip point distance for all mandalas, regardless of prop type.
 * dx=130 is the sweet spot between fan (105) and staff (135). */
export const MANDALA_STANDARD_TIP_DX = 130;
```

### IN-02: Dead function _colorIdToCss in SvgToBrailleConverter

**File:** `src/lib/features/retro/dos/services/implementations/SvgToBrailleConverter.ts:82-89`
**Issue:** The function `_colorIdToCss` is prefixed with `_` (indicating intentionally unused) but is fully implemented dead code. It maps color IDs to CSS classes but is never called -- the `encodeToBrailleHtml` method handles color mapping inline at lines 306-312.
**Fix:** Remove the dead function, or if it's intended for future use, add a comment explaining why it's retained.

### IN-03: scene-lab-state.svelte.ts persistence silently swallows errors

**File:** `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts:99`
**Issue:** The `catch {}` block at line 99 silently swallows localStorage write failures with `// noop`. While localStorage quota errors are expected, completely silent failure makes debugging difficult when state isn't persisting.
**Fix:** Add a single `console.debug` for development visibility:
```ts
catch (e) {
  if (import.meta.env.DEV) console.debug("[scene-lab] localStorage write failed:", e);
}
```

### IN-04: LabModule effect does not reset TabComponent before loading new tab

**File:** `src/lib/features/lab/LabModule.svelte:58-100`
**Issue:** When `activeTab` changes, the `$effect` starts loading the new tab's module but doesn't set `TabComponent = null` before the async import resolves. During the loading gap, the previous tab's component remains rendered. This is minor (the old tab renders briefly) but can cause visual flicker or stale state if the old component has side effects.
**Fix:** Set `TabComponent = null` immediately when starting a new load:
```ts
$effect(() => {
  const loader = tabComponents[activeTab];
  if (loader) {
    loadError = null;
    TabComponent = null; // Clear before async load
    // ... rest of loading logic
```

### IN-05: test/card-back-capture route leaks browse engine resources

**File:** `src/routes/test/card-back-capture/+page.svelte:46`
**Issue:** `engine.destroy()` is called in `onDestroy`, which is correct, but `createBrowseEngine` is called at module scope (line 15) outside of `onMount`. In Svelte 5, this means the engine is created during component initialization, which may run during SSR where browser APIs are unavailable. If `createBrowseEngine` accesses browser APIs internally, this would crash during SSR.
**Fix:** Defer engine creation to `onMount` or guard with `browser` check:
```ts
import { browser } from "$app/environment";
let engine: ReturnType<typeof createBrowseEngine> | null = null;

onMount(async () => {
  engine = createBrowseEngine({ persistKey: null, minColumns: 2, initialColumns: 3 });
  await engine.initialize();
  // ...
});
```

---

_Reviewed: 2026-05-23T21:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
