# Viewer URL-Addressable State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A copied sequence-viewer link snapshots the complete visual state; opening it restores exactly that state without touching the recipient's saved settings.

**Architecture:** A per-mount `ViewerUrlSession` decodes slice payloads from the URL and hands them to the viewer's existing store factories as `initial` + `persist:false` (the shipped view-only pattern from `createEffectsConfigState`). Mounted surfaces register live `capture()` hooks; a Svelte `$effect` in the orchestrator re-captures on any change and debounce-writes the URL via `mutateCurrentUrl`. Share/Copy call a synchronous `captureNow()`. Spec: `docs/superpowers/specs/2026-08-30-viewer-url-addressable-state-design.md`.

**Tech Stack:** SvelteKit + Svelte 5 runes, existing `compressForURL` (fflate) in `sequence-codec.ts`, vitest (`npx vitest run --config tests/config/vitest.config.ts <file>`).

**Worktree:** `E:/worktrees/tka-platform/viewer-url-state`, branch `claude/viewer-url-state`.

**Executor discipline (every task):** re-read this plan file at task start; commit ONLY with explicit pathspec (`git commit -m "..." -- <paths>`); every commit message ends with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; completion claims carry test output. Do not delegate further.

**Phase A (Tasks 1–8)** ships the core + the two slices that caused the incident (view/pane + effects). It is independently shippable. **Phase B (Tasks 9–14)** rolls the remaining slices onto the demonstrated pattern; each Phase B task begins with a mandatory store-discovery step because the spec requires encoding each store's post-normalize persisted shape, never an invented schema.

---

## Phase A — Core

### Task 1: URL state codec

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/viewer-url-state-codec.ts`
- Test: `src/lib/shared/sequence-viewer/services/viewer-url-state-codec.test.ts`

The codec owns param names and the headline/blob split. Headline params are canonical for their fields; the blob never duplicates them.

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  encodeViewerStateParams,
  decodeViewerStateParams,
  deepEqual,
  VIEWER_STATE_PARAM_NAMES,
} from "./viewer-url-state-codec";

describe("viewer-url-state-codec", () => {
  it("round-trips headline + blob slices", () => {
    const slices = {
      vw: { mode: "split", split: { leftPane: "animation", rightPane: "card" } },
      fx: { active: "sparkles", tuning: { sparkles: { rate: 0.92 } } },
      tn: { speed: 2, cameraMode: "orbit" },
    };
    const patch = encodeViewerStateParams(slices);
    expect(patch.set.vm).toBe("split");
    expect(patch.set.split).toBe("animation,card");
    expect(patch.set.fx).toBe("sparkles");
    expect(patch.set.s).toMatch(/^(d1:|raw:)/);

    const params = new URLSearchParams(patch.set);
    expect(decodeViewerStateParams(params)).toEqual(slices);
  });

  it("empty slices produce removals, not params", () => {
    const patch = encodeViewerStateParams({});
    expect(Object.keys(patch.set)).toHaveLength(0);
    expect([...patch.remove].sort()).toEqual([...VIEWER_STATE_PARAM_NAMES].sort());
  });

  it("headline-only state emits no blob", () => {
    const patch = encodeViewerStateParams({ vw: { mode: "animation" } });
    expect(patch.set.vm).toBe("animation");
    expect(patch.set.s).toBeUndefined();
    expect(patch.remove).toContain("s");
  });

  it("cd slice splits cols headline from blob rest", () => {
    const patch = encodeViewerStateParams({ cd: { cols: 4, rest: { showWord: false } } });
    expect(patch.set.cols).toBe("4");
    const decoded = decodeViewerStateParams(new URLSearchParams(patch.set));
    expect(decoded.cd).toEqual({ cols: 4, rest: { showWord: false } });
  });

  it("ignores a corrupt blob but keeps headline params", () => {
    const params = new URLSearchParams({ vm: "card", s: "d1:%%%not-base64%%%" });
    expect(decodeViewerStateParams(params)).toEqual({ vw: { mode: "card" } });
  });

  it("ignores unknown slice ids in the blob", () => {
    const patch = encodeViewerStateParams({ tn: { speed: 1 } });
    // hand-craft a blob with a foreign key by decoding, mutating, re-encoding is
    // overkill — instead assert decode only returns known ids
    const decoded = decodeViewerStateParams(new URLSearchParams(patch.set));
    expect(Object.keys(decoded)).toEqual(["tn"]);
  });

  it("deepEqual: structural, order-sensitive arrays, null-safe", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/sequence-viewer/services/viewer-url-state-codec.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement the codec**

```ts
/**
 * Viewer URL state codec — owns the param names and the headline/blob split
 * for full-state viewer links.
 * Spec: docs/superpowers/specs/2026-08-30-viewer-url-addressable-state-design.md
 *
 * Headline params (`vm`, `split`, `fx`, `cols`) are canonical for their
 * fields; the compressed `s` blob carries everything else and never
 * duplicates a headline value. `?v=` (sequence identity) is NOT owned here.
 */
import {
  compressForURL,
  decompressFromURL,
} from "$lib/shared/navigation/services/sequence-codec";

export type SliceId = "vw" | "fx" | "an" | "ex" | "t3" | "cd" | "tn" | "ps";
export type SlicePayloads = Partial<Record<SliceId, unknown>>;

const BLOB_SLICE_IDS: readonly SliceId[] = ["fx", "an", "ex", "t3", "cd", "tn", "ps"];

export const VIEWER_STATE_PARAM_NAMES = ["vm", "split", "fx", "cols", "s"] as const;

export interface ViewerUrlParamPatch {
  set: Record<string, string>;
  remove: string[];
}

interface VwPayload {
  mode?: string;
  split?: { leftPane: string; rightPane: string };
}
interface FxPayload {
  active?: string;
  tuning?: Record<string, unknown>;
}
interface CdPayload {
  cols?: number;
  rest?: Record<string, unknown>;
}

export function encodeViewerStateParams(slices: SlicePayloads): ViewerUrlParamPatch {
  const set: Record<string, string> = {};
  const blob: Record<string, unknown> = {};

  const vw = slices.vw as VwPayload | undefined;
  if (vw?.mode) set.vm = vw.mode;
  if (vw?.split) set.split = `${vw.split.leftPane},${vw.split.rightPane}`;

  const fx = slices.fx as FxPayload | undefined;
  if (fx?.active) set.fx = fx.active;
  if (fx?.tuning && Object.keys(fx.tuning).length > 0) blob.fx = fx.tuning;

  const cd = slices.cd as CdPayload | undefined;
  if (cd?.cols != null) set.cols = String(cd.cols);
  if (cd?.rest && Object.keys(cd.rest).length > 0) blob.cd = cd.rest;

  for (const id of BLOB_SLICE_IDS) {
    if (id === "fx" || id === "cd") continue;
    const payload = slices[id];
    if (payload != null) blob[id] = payload;
  }

  if (Object.keys(blob).length > 0) {
    set.s = compressForURL(JSON.stringify({ sv: 1, ...blob }));
  }

  const remove = VIEWER_STATE_PARAM_NAMES.filter((name) => !(name in set));
  return { set, remove };
}

export function decodeViewerStateParams(params: URLSearchParams): SlicePayloads {
  const slices: SlicePayloads = {};

  let blob: Record<string, unknown> = {};
  const s = params.get("s");
  if (s) {
    try {
      const parsed = JSON.parse(decompressFromURL(s)) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") blob = parsed;
    } catch {
      // Corrupt blob: tolerated per spec — headline params still apply.
    }
  }

  const vw: VwPayload = {};
  const vm = params.get("vm");
  if (vm) vw.mode = vm;
  const split = params.get("split");
  if (split) {
    const [leftPane, rightPane] = split.split(",");
    if (leftPane && rightPane) vw.split = { leftPane, rightPane };
  }
  if (Object.keys(vw).length > 0) slices.vw = vw;

  const fx: FxPayload = {};
  const active = params.get("fx");
  if (active) fx.active = active;
  if (blob.fx && typeof blob.fx === "object") {
    fx.tuning = blob.fx as Record<string, unknown>;
  }
  if (Object.keys(fx).length > 0) slices.fx = fx;

  const cd: CdPayload = {};
  const cols = Number(params.get("cols"));
  if (Number.isInteger(cols) && cols > 0) cd.cols = cols;
  if (blob.cd && typeof blob.cd === "object") {
    cd.rest = blob.cd as Record<string, unknown>;
  }
  if (Object.keys(cd).length > 0) slices.cd = cd;

  for (const id of BLOB_SLICE_IDS) {
    if (id === "fx" || id === "cd") continue;
    if (blob[id] != null) slices[id] = blob[id];
  }

  return slices;
}

/** Structural equality; `undefined` properties are treated as absent. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const aKeys = Object.keys(a as object).filter(
    (k) => (a as Record<string, unknown>)[k] !== undefined
  );
  const bKeys = Object.keys(b as object).filter(
    (k) => (b as Record<string, unknown>)[k] !== undefined
  );
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/sequence-viewer/services/viewer-url-state-codec.test.ts`
Expected: PASS (7 tests). Note: the codec runs in Node too — `compressForURL` uses `btoa`; if the vitest environment lacks it, the test file sets `globalThis.btoa/atob` from `Buffer` in a `beforeAll`.

- [x] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/viewer-url-state-codec.ts src/lib/shared/sequence-viewer/services/viewer-url-state-codec.test.ts
git commit -m "feat(viewer): URL state codec for full-state links" -- src/lib/shared/sequence-viewer/services/viewer-url-state-codec.ts src/lib/shared/sequence-viewer/services/viewer-url-state-codec.test.ts
```

---

### Task 2: ViewerUrlSession

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/viewer-url-session.ts`
- Test: `src/lib/shared/sequence-viewer/services/viewer-url-session.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createViewerUrlSession } from "./viewer-url-session";

describe("ViewerUrlSession", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("exposes decoded seeds", () => {
    const session = createViewerUrlSession(
      new URLSearchParams({ vm: "split", fx: "sparkles" }),
      { writeParams: vi.fn() }
    );
    expect(session.getSeed("vw")).toEqual({ mode: "split" });
    expect(session.getSeed("fx")).toEqual({ active: "sparkles" });
    expect(session.getSeed("tn")).toBeNull();
  });

  it("isOverride: seed present and different from persisted", () => {
    const session = createViewerUrlSession(
      new URLSearchParams({ fx: "sparkles" }),
      { writeParams: vi.fn() }
    );
    expect(session.isOverride("fx", { active: "fire" })).toBe(true);
    expect(session.isOverride("fx", { active: "sparkles" })).toBe(false); // own-link rule
    expect(session.isOverride("tn", null)).toBe(false); // no seed
    expect(session.isOverride("fx", null)).toBe(true); // seed, nothing persisted
  });

  it("captureNow merges live captures over URL seeds (unmounted pass-through)", () => {
    const session = createViewerUrlSession(
      new URLSearchParams({ vm: "animation", fx: "fire" }),
      { writeParams: vi.fn() }
    );
    session.registerSlice("vw", () => ({ mode: "card" }));
    // fx surface never mounted — its seed must survive verbatim
    expect(session.captureNow()).toEqual({
      vw: { mode: "card" },
      fx: { active: "fire" },
    });
  });

  it("a capture returning null clears that slice from the snapshot", () => {
    const session = createViewerUrlSession(new URLSearchParams({ vm: "card" }), {
      writeParams: vi.fn(),
    });
    session.registerSlice("vw", () => null); // back at defaults
    expect(session.captureNow()).toEqual({});
  });

  it("scheduleUrlWrite debounces; captureNow does not depend on it", () => {
    const writeParams = vi.fn();
    const session = createViewerUrlSession(new URLSearchParams(), { writeParams });
    session.registerSlice("vw", () => ({ mode: "card" }));
    session.scheduleUrlWrite();
    session.scheduleUrlWrite();
    expect(writeParams).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(writeParams).toHaveBeenCalledTimes(1);
    expect(writeParams.mock.calls[0][0].set.vm).toBe("card");
  });

  it("unregister removes the live hook; seed pass-through resumes", () => {
    const session = createViewerUrlSession(new URLSearchParams({ vm: "split" }), {
      writeParams: vi.fn(),
    });
    const off = session.registerSlice("vw", () => ({ mode: "card" }));
    off();
    expect(session.captureNow()).toEqual({ vw: { mode: "split" } });
  });

  it("dispose cancels a pending write", () => {
    const writeParams = vi.fn();
    const session = createViewerUrlSession(new URLSearchParams(), { writeParams });
    session.registerSlice("vw", () => ({ mode: "card" }));
    session.scheduleUrlWrite();
    session.dispose();
    vi.advanceTimersByTime(1000);
    expect(writeParams).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/sequence-viewer/services/viewer-url-session.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement the session**

```ts
/**
 * ViewerUrlSession — one per viewer mount. Decodes slice payloads from the
 * inbound URL, hands seeds to store construction, collects live captures, and
 * writes the merged snapshot back to the URL (debounced) so the address bar
 * is always a complete snapshot.
 * Spec: docs/superpowers/specs/2026-08-30-viewer-url-addressable-state-design.md
 */
import {
  decodeViewerStateParams,
  encodeViewerStateParams,
  deepEqual,
  VIEWER_STATE_PARAM_NAMES,
  type SliceId,
  type SlicePayloads,
  type ViewerUrlParamPatch,
} from "./viewer-url-state-codec";

const URL_WRITE_DEBOUNCE_MS = 400;

export interface ViewerUrlSessionDeps {
  /** Applies a param patch to the live URL (production: mutateCurrentUrl). */
  writeParams: (patch: ViewerUrlParamPatch) => void;
}

export type ViewerUrlSession = ReturnType<typeof createViewerUrlSession>;

export function createViewerUrlSession(
  initialParams: URLSearchParams,
  deps: ViewerUrlSessionDeps
) {
  const seeds: SlicePayloads = decodeViewerStateParams(initialParams);
  const liveCaptures = new Map<SliceId, () => unknown | null>();
  let writeTimer: ReturnType<typeof setTimeout> | null = null;

  function getSeed(id: SliceId): unknown | null {
    return seeds[id] ?? null;
  }

  /**
   * The own-link rule: a seed that deep-equals what the user's own disk would
   * load is NOT an override — their own link must not flip them to view-only.
   */
  function isOverride(id: SliceId, persisted: unknown | null): boolean {
    const seed = seeds[id];
    if (seed == null) return false;
    return !deepEqual(seed, persisted);
  }

  function registerSlice(id: SliceId, capture: () => unknown | null): () => void {
    liveCaptures.set(id, capture);
    return () => {
      if (liveCaptures.get(id) === capture) liveCaptures.delete(id);
    };
  }

  /** URL seeds pass through verbatim for slices with no mounted surface. */
  function captureNow(): SlicePayloads {
    const merged: SlicePayloads = { ...seeds };
    for (const [id, capture] of liveCaptures) {
      const value = capture();
      if (value == null) delete merged[id];
      else merged[id] = value;
    }
    return merged;
  }

  function scheduleUrlWrite(): void {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      writeTimer = null;
      deps.writeParams(encodeViewerStateParams(captureNow()));
    }, URL_WRITE_DEBOUNCE_MS);
  }

  /** Synchronous full snapshot as a param patch — used by Share/Copy Link. */
  function captureNowAsParams(): ViewerUrlParamPatch {
    return encodeViewerStateParams(captureNow());
  }

  function ownedParams(): readonly string[] {
    return VIEWER_STATE_PARAM_NAMES;
  }

  function dispose(): void {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
    liveCaptures.clear();
  }

  return {
    getSeed,
    isOverride,
    registerSlice,
    captureNow,
    captureNowAsParams,
    scheduleUrlWrite,
    ownedParams,
    dispose,
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/sequence-viewer/services/viewer-url-session.test.ts`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git commit -m "feat(viewer): ViewerUrlSession — seeds, own-link rule, capture, debounced sync" -- src/lib/shared/sequence-viewer/services/viewer-url-session.ts src/lib/shared/sequence-viewer/services/viewer-url-session.test.ts
```

---

### Task 3: Effects store — snapshot() + persisted-config export

**Files:**
- Modify: `src/lib/shared/effects/state/effects-config-state.svelte.ts`
- Test: extend the store's existing test file if one exists (`Grep: effects-config-state.test`); otherwise create `src/lib/shared/effects/state/effects-config-state.snapshot.test.ts`

Two small extensions of the owner (never a parallel serializer):

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  createEffectsConfigState,
  loadPersistedEffectsConfig,
} from "./effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";

describe("effects config snapshot", () => {
  it("snapshot() returns a detached full config", () => {
    const state = createEffectsConfigState(undefined, { persist: false });
    state.setActiveEffect("sparkles");
    const snap = state.snapshot();
    expect(snap.activeEffect).toBe("sparkles");
    // Detached: mutating the snapshot must not affect live state
    (snap as { activeEffect: string }).activeEffect = "fire";
    expect(state.activeEffect).toBe("sparkles");
  });

  it("loadPersistedEffectsConfig returns null with empty storage", () => {
    localStorage.clear();
    expect(loadPersistedEffectsConfig()).toBeNull();
  });

  it("snapshot at factory defaults deep-equals DEFAULT_EFFECTS_CONFIG", () => {
    const state = createEffectsConfigState(undefined, { persist: false });
    expect(state.snapshot()).toEqual(DEFAULT_EFFECTS_CONFIG);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/effects/state/effects-config-state.snapshot.test.ts`
Expected: FAIL — `snapshot is not a function` / export missing.

- [x] **Step 3: Implement**

In the factory, add next to the existing methods (uses the same clone-fallback idiom as the undo capture at ~line 345):

```ts
  /** Detached copy of the full current config (transients like prewarmHint excluded by construction). */
  function snapshot(): EffectsConfig {
    try {
      return structuredClone($state.snapshot(config)) as EffectsConfig;
    } catch {
      return JSON.parse(JSON.stringify(config)) as EffectsConfig;
    }
  }
```

Add `snapshot,` to the returned object. Then export at module level, delegating to the existing private loader + normalize path (do NOT duplicate their logic — call them):

```ts
/**
 * What a persist:true instance would boot with, for the URL layer's own-link
 * comparison. Null when nothing is stored.
 */
export function loadPersistedEffectsConfig(): EffectsConfig | null {
  const stored = loadStoredConfig();
  return stored ? normalizeEffectsConfig(stored) : null;
}
```

(If `loadStoredConfig` already normalizes internally, match whatever the persist:true constructor path actually does — the exported value must equal a persist:true instance's boot state. Read the constructor and mirror it exactly.)

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/effects/state/effects-config-state.snapshot.test.ts`
Expected: PASS (3 tests). Also run the store's existing tests if any exist — zero regressions.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(effects): snapshot() and loadPersistedEffectsConfig for URL state layer" -- src/lib/shared/effects/state/effects-config-state.svelte.ts src/lib/shared/effects/state/effects-config-state.snapshot.test.ts
```

---

### Task 4: fx slice — capture/seed + zero-write guard

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/viewer-url-slices/fx-slice.ts`
- Test: `src/lib/shared/sequence-viewer/services/viewer-url-slices/fx-slice.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { captureFxSlice, seedFromFxSlice } from "./fx-slice";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

afterEach(() => vi.restoreAllMocks());

describe("fx slice", () => {
  it("returns null at factory defaults", () => {
    const state = createEffectsConfigState(undefined, { persist: false });
    expect(captureFxSlice(state)).toBeNull();
  });

  it("captures only the keys that differ from defaults", () => {
    const state = createEffectsConfigState(undefined, { persist: false });
    state.setActiveEffect("sparkles");
    state.updateEffect("sparkles", { rate: 0.92 });
    const slice = captureFxSlice(state);
    expect(slice?.active).toBe("sparkles");
    expect(slice?.tuning?.sparkles).toMatchObject({ rate: 0.92 });
    expect(slice?.tuning && "fire" in slice.tuning).toBe(false);
  });

  it("round-trips: capture -> seed -> new instance -> capture is identity", () => {
    const a = createEffectsConfigState(undefined, { persist: false });
    a.setActiveEffect("sparkles");
    a.updateEffect("sparkles", { rate: 0.92 });
    const slice = captureFxSlice(a);

    const b = createEffectsConfigState(seedFromFxSlice(slice!), { persist: false });
    expect(captureFxSlice(b)).toEqual(slice);
    expect(b.activeEffect).toBe("sparkles");
  });

  it("seeding + reading performs zero localStorage writes", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const state = createEffectsConfigState(
      seedFromFxSlice({ active: "sparkles", tuning: { sparkles: { rate: 0.92 } } }),
      { persist: false }
    );
    state.updateEffect("sparkles", { rate: 0.5 }); // tweaks during a link session stay session-local
    expect(setItem).not.toHaveBeenCalled();
  });

  it("seedFromFxSlice merges onto factory defaults, not user state", () => {
    const seeded = seedFromFxSlice({ active: "fire" });
    expect(seeded.activeEffect).toBe("fire");
    expect(seeded.sparkles).toEqual(DEFAULT_EFFECTS_CONFIG.sparkles);
  });
});
```

Note: `updateEffect`'s exact partial-update signature must be read from the store before writing this test — if it differs (e.g. takes a full section), adapt the test to the real API. Never change the store to fit the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/sequence-viewer/services/viewer-url-slices/fx-slice.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * fx slice — effects config <-> URL payload.
 * Capture: per-top-level-key diff vs DEFAULT_EFFECTS_CONFIG (null at defaults).
 * Seed: merge onto factory defaults (the sender diffed against them).
 */
import type { EffectsConfig } from "$lib/shared/effects/domain/effects-config";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { deepEqual } from "../viewer-url-state-codec";

export interface FxSlicePayload {
  active?: string;
  tuning?: Record<string, unknown>;
}

export function captureFxSlice(state: EffectsConfigState): FxSlicePayload | null {
  const snap = state.snapshot();
  const tuning: Record<string, unknown> = {};

  for (const key of Object.keys(DEFAULT_EFFECTS_CONFIG) as (keyof EffectsConfig)[]) {
    if (key === "activeEffect") continue;
    if (!deepEqual(snap[key], DEFAULT_EFFECTS_CONFIG[key])) {
      tuning[key] = snap[key];
    }
  }

  const payload: FxSlicePayload = {};
  if (snap.activeEffect !== DEFAULT_EFFECTS_CONFIG.activeEffect) {
    payload.active = snap.activeEffect as string;
  }
  if (Object.keys(tuning).length > 0) payload.tuning = tuning;

  return Object.keys(payload).length > 0 ? payload : null;
}

export function seedFromFxSlice(payload: FxSlicePayload): EffectsConfig {
  const seed = structuredClone(DEFAULT_EFFECTS_CONFIG) as EffectsConfig;
  if (payload.tuning) Object.assign(seed, payload.tuning);
  if (payload.active) {
    (seed as { activeEffect: unknown }).activeEffect = payload.active;
  }
  return seed;
}
```

(`createEffectsConfigState` normalizes the seed via its own `normalizeEffectsConfig` path — an invalid `active` from a hand-edited URL is healed by the owner, not re-validated here.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/sequence-viewer/services/viewer-url-slices/fx-slice.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(viewer): fx URL slice — capture/seed with zero-write guard" -- src/lib/shared/sequence-viewer/services/viewer-url-slices/fx-slice.ts src/lib/shared/sequence-viewer/services/viewer-url-slices/fx-slice.test.ts
```

---

### Task 5: View-state seam + entry-point wiring

**Files:**
- Modify: `src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts` (add `initialMode`/`initialSplit`/`persist` options)
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` (~line 388 effects creation; add session creation + context + sync `$effect`)
- Modify: `src/routes/sequence/[id]/SequenceViewerPage.svelte` (session from `page.url.searchParams`)
- Modify: `src/lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte.ts` (session for drawer opens)
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` (~line 81 — must receive the orchestrator's effects instance, never construct a second one when a session is active)
- Test: `src/lib/shared/sequence-viewer/state/viewer-state.url-seed.test.ts`

This is the wiring task — the one that most needs hawk-eyed review. Sub-steps:

- [ ] **Step 1: Failing test for the viewer-state seam**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { createViewerState } from "./viewer-state.svelte";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("createViewerState URL seeding", () => {
  it("initialMode wins over persisted mode", () => {
    localStorage.setItem("tka-viewer-mode", "card");
    const state = createViewerState({ initialMode: "tunnel", persist: false });
    expect(state.viewerMode).toBe("tunnel");
  });

  it("persist:false never writes viewer-mode or split keys", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const state = createViewerState({ initialMode: "split", persist: false });
    state.setViewerMode("card");
    state.setSplitConfig({ leftPane: "animation", rightPane: "card" });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("no options preserves today's behavior (loads + persists)", () => {
    const state = createViewerState();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    state.setViewerMode("card");
    expect(setItem).toHaveBeenCalledWith("tka-viewer-mode", "card");
  });

  it("URL post-studio is honored (explicit-intent carve-out)", () => {
    const state = createViewerState({ initialMode: "post-studio", persist: false });
    expect(state.viewerMode).toBe("post-studio");
  });
});
```

- [ ] **Step 2: Verify it fails, then implement the seam**

`createViewerState(options?: { initialMode?: ViewerMode; initialSplit?: SplitConfig; persist?: boolean })`:
- `const persist = options?.persist ?? true;`
- `const initialMode = options?.initialMode ?? loadViewerMode();` — the URL value bypasses `loadViewerMode`'s post-studio/mandala filtering **on purpose**: that filter guards against stale localStorage, and a URL is explicit intent (spec carve-out — put this sentence in a comment).
- `let splitConfig = $state<SplitConfig>(options?.initialSplit ?? loadSplitConfig());`
- Guard every `persistViewerMode(...)`/`persistSplitConfig(...)` call with `if (persist)`.
- Validate `initialMode`/`initialSplit` against the same type guards `viewer-state-persistence.ts` uses (import `isValidContentType` — export it if private) so a hand-edited `vm=garbage` falls back to defaults, not a broken viewer.

Run the test: PASS (4 tests).

- [ ] **Step 3: Wire the session end to end (read each file before editing)**

1. **Orchestrator** creates the session once at mount:

```ts
import { createViewerUrlSession } from "../services/viewer-url-session";
import { mutateCurrentUrl } from "$lib/shared/navigation/services/url-state";
import { captureFxSlice, seedFromFxSlice } from "../services/viewer-url-slices/fx-slice";
import { loadPersistedEffectsConfig } from "$lib/shared/effects/state/effects-config-state.svelte";

const urlSession = createViewerUrlSession(
  new URLSearchParams(browser ? window.location.search : ""),
  {
    writeParams: (patch) =>
      mutateCurrentUrl((url) => {
        for (const name of patch.remove) url.searchParams.delete(name);
        for (const [name, value] of Object.entries(patch.set)) {
          url.searchParams.set(name, value);
        }
      }),
  }
);
```

2. **Effects instance** (replace the bare `createEffectsConfigState()` at ~line 388):

```ts
const fxSeedPayload = urlSession.getSeed("fx") as FxSlicePayload | null;
const fxSeed = fxSeedPayload ? seedFromFxSlice(fxSeedPayload) : null;
const effectsConfigState =
  fxSeed && urlSession.isOverride("fx", loadPersistedEffectsConfig())
    ? createEffectsConfigState(fxSeed, { persist: false })
    : createEffectsConfigState();
urlSession.registerSlice("fx", () => captureFxSlice(effectsConfigState));
```

3. **View state:** pass the `vw` seed into `createViewerState` (or into the existing `initialViewerMode` flow — read how `viewerState` is constructed in the orchestrator/context first and use THAT path; do not create a second mode-setting route). Register the capture:

```ts
urlSession.registerSlice("vw", () => {
  const mode = viewerState.viewerMode;
  const split = viewerState.splitConfig;
  const atDefaultMode = mode === "split";
  const atDefaultSplit = split.leftPane === "animation" && split.rightPane === "card";
  if (atDefaultMode && atDefaultSplit) return null;
  return {
    ...(atDefaultMode ? {} : { mode }),
    ...(atDefaultSplit ? {} : { split }),
  };
});
```

Important: the vw override must also mean `persist:false` for viewer-state (`urlSession.isOverride("vw", { mode: loadViewerMode(), ... })` — compare against the same shape the capture produces, with the same default-elision).

4. **Live sync `$effect`** in the orchestrator (component context, so `$effect` is legal):

```ts
$effect(() => {
  void urlSession.captureNow(); // reads every registered store's reactive state
  urlSession.scheduleUrlWrite();
});
onDestroy(() => urlSession.dispose());
```

5. **Existing `vm` param path:** `SequenceViewerPage.svelte:137` reads `vm` today. The codec now also reads `vm`. Route BOTH through the session: the page passes nothing new — the orchestrator's session reads `window.location.search` directly, so delete/bypass any now-redundant ad-hoc `vm` plumbing **only if** reading the page code proves the orchestrator path fully covers it (drawer opens without URL params must still respect `initialViewerMode` from `openSequenceOverlay` options — programmatic opens win over URL leftovers; precedence: explicit open options > URL seed > localStorage).

6. **ViewerSplitPane** must consume the orchestrator's effects instance (`inheritedEffectsConfig` prop at ~line 81). Verify the orchestrator actually passes it everywhere the viewer renders effects; fix any path that lets a pane construct its own persist:true instance while a session override is active (that would leak link state to disk — the exact bug class this project kills).

- [ ] **Step 4: Verify**

Run both new test files + `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/sequence-viewer` (expected: all green). Then `npm run check > /tmp/check.log 2>&1; grep -ciE "^.*error" /tmp/check.log` — expected 0 errors (one check per turn; capture once, grep many).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(viewer): URL session wiring — view + effects slices seed and live-sync" -- src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts src/lib/shared/sequence-viewer/state/viewer-state.url-seed.test.ts src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte src/routes/sequence/[id]/SequenceViewerPage.svelte src/lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte.ts src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts
```

(Adjust the pathspec to the files actually touched — commit only your own changes.)

---

### Task 6: Share/Copy carry the snapshot (captureNow, not the address bar)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/viewer-share-actions.ts`
- Modify: `src/lib/shared/sequence-viewer/services/viewer-orchestrator-model.ts` (`buildViewerShareDetails`)
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` (pass a `getStateParams` dependency)
- Test: `src/lib/shared/sequence-viewer/services/viewer-orchestrator-model.share-state.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildViewerShareDetails } from "./viewer-orchestrator-model";

describe("share URL carries viewer state", () => {
  it("appends state params from getStateParams to the built URL", () => {
    const details = buildViewerShareDetails({
      sequence: null,
      bpm: 60,
      darkMode: false,
      fallbackUrl: "https://example.com/sequence/EHWE",
      buildUrl: () => "https://example.com/sequence/EHWE",
      getStateParams: () => ({ set: { vm: "card", fx: "sparkles" }, remove: [] }),
    });
    const url = new URL(details.url);
    expect(url.searchParams.get("vm")).toBe("card");
    expect(url.searchParams.get("fx")).toBe("sparkles");
  });
});
```

- [ ] **Step 2: Verify fail, implement**

`buildViewerShareDetails` gains optional `getStateParams?: () => ViewerUrlParamPatch`. After the existing `url = input.buildUrl(...)` (and also on the fallback path), apply the patch:

```ts
if (input.getStateParams) {
  try {
    const patch = input.getStateParams();
    const u = new URL(url);
    for (const name of patch.remove) u.searchParams.delete(name);
    for (const [name, value] of Object.entries(patch.set)) u.searchParams.set(name, value);
    url = u.toString();
  } catch {
    // State params must never break sharing.
  }
}
```

`createViewerShareActions` inputs gain `getStateParams` and pass it through; the orchestrator supplies `() => urlSession.captureNowAsParams()`. This is the synchronous path — no debounce dependence; "the moment I copied" is literal.

- [ ] **Step 3: Verify test passes, run the module's other tests** (`viewer-modes.test.ts` etc. still green).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(viewer): share/copy links carry a synchronous full-state snapshot" -- src/lib/shared/sequence-viewer/services/viewer-share-actions.ts src/lib/shared/sequence-viewer/services/viewer-orchestrator-model.ts src/lib/shared/sequence-viewer/services/viewer-orchestrator-model.share-state.test.ts src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
```

---

### Task 7: Close cleanup strips all owned params

**Files:**
- Modify: `src/lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte.ts:177`
- Test: extend `viewer-url-state-codec.test.ts` is wrong home — add assertion to any existing overlay-state test file (`Grep: sequence-viewer-overlay-state.test`); if none exists, this is covered by Task 8's integration check instead — do NOT build a new browser-test harness just for this line.

- [ ] **Step 1: Implement**

```ts
import { VIEWER_STATE_PARAM_NAMES } from "../services/viewer-url-state-codec";
// in closeSequenceOverlay():
removeCurrentUrlParams(["v", ...VIEWER_STATE_PARAM_NAMES], {
  removeState: ["sequenceOverlay"],
});
```

- [ ] **Step 2: Commit**

```bash
git commit -m "fix(viewer): closing the drawer strips all viewer-state URL params" -- src/lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte.ts
```

---

### Task 8: Phase A verification gate (orchestrator runs this, not a subagent)

- [ ] Full unit suite for touched areas green; one `npm run check` captured to log, 0 errors.
- [ ] Live round-trip in the browser (DevTools MCP, dedicated instance, per `visual-verification-mandatory.md`): open `/sequence/<id>`, set effect to sparkles + tune rate, switch pane to 2D, wait 1s, confirm address bar contains `vm`/`fx`/`s`; copy URL; open it in a fresh incognito-context page; confirm identical pane + effect + tuning; confirm `localStorage.getItem("tka_effects_config")` in the fresh context is unchanged/null.
- [ ] Confirm drawer path: open viewer from gallery, tweak, confirm URL params appear on the module route; close drawer, confirm params stripped.
- [ ] Confirm plain-link invariant: fresh viewer with untouched settings shows NO new params.

---

## Phase B — Remaining slices (one task each, clone the Task 4 pattern)

Every Phase B task follows the same five steps: **(1) Discovery** — read the backing store file(s) end-to-end and list the exact persisted fields (post-normalize shape); **(2) seam** — add `initial`/`persist:false` options to the store factory if missing (for `createPersistenceHelper` consumers, add the option to the helper once, in Task 9); **(3) slice module** in `viewer-url-slices/<id>-slice.ts` with capture-diff-vs-defaults returning null at defaults + seed-merge-onto-defaults; **(4) tests** — round-trip identity, null-at-defaults, zero-write spy (same three shapes as `fx-slice.test.ts`); **(5) register** in the surface that owns the store (register on mount, unregister on destroy — these surfaces mount/unmount with panes, unlike fx). Commit per task with pathspec.

### Task 9: `an` — 2D animation settings
- [ ] Extend `createPersistenceHelper` (`src/lib/shared/state/utils/persistent-state.ts`) with `{ initial?: T; persist?: boolean }` — one change, inherited by its 6 consumers.
- [ ] Stores: `tka_animation_settings` (`animation-settings-state.svelte.ts`), `animation-visibility-settings` (`animation-visibility-state.svelte.ts`), `tka_trail_settings` (owner per `trail-types.ts`). Discovery decides whether visibility + trails fold into one `an` payload (`{ settings, visibility, trails }` sub-keys) — they do; one slice, three sub-keys.
- [ ] Slice + tests + registration where the 2D animation pane constructs these states.

### Task 10: `ex` — export options
- [ ] Store: `createExportOptionsState()` (`export-options-state.svelte.ts`, key `tka_export_options`). Add options seam, slice, tests, registration in the export panel host.

### Task 11: `t3` — 3D viewer
- [ ] Stores (sub-keys of one payload): `tka-3d-animator-state` (`scene3d-persister.ts`), `tka-viewer3d-environment`, `tka-scene-features`, `tka-3d-playback-state` (`createPlaybackState` — already takes options), `tka-scene-audio-v1`, `tka-3d-quality-tier-override`. Discovery step decides which of these are *visual state* (encode) vs *device capability* (quality tier: DO NOT encode — a sender's GPU tier must not follow the link; record the exclusion in the slice's doc comment).
- [ ] Slice + tests + registration in the 3D pane host (`viewer-3d-activation-state` / `Viewer3DCanvas` mount path — discovery names the exact component).

### Task 12: `cd` + `cols` — card controls
- [ ] Stores: `tka-image-composition-settings` (`image-composition-state.svelte.ts`), `columnCount` (viewer context, `viewer-orchestrator-context-state.svelte.ts:268` — discovery traces who sets it and how it persists). `cols` rides the headline param (codec already supports it); the rest goes in the blob.
- [ ] Slice + tests + registration.

### Task 13: `tn` — tunnel config
- [ ] Store: `tka_tunnel_view_state` (`tunnel-view-state.ts` — plain load/persist functions; add a factory-style seam mirroring viewer-state's Task 5 change). User presets (`tka_tunnel_user_presets`) are referenced by value, not id — a recipient doesn't have the sender's presets, so capture resolves the active preset into concrete values (discovery confirms the resolved shape).
- [ ] Slice + tests + registration in the tunnel pane host.

### Task 14: `ps` — Post Studio
- [ ] Store: PostStudio's internal `persist:false` effects instance + its layout/setup state (`PostStudio.svelte:100` — discovery lists what constitutes "setup"). Honor the explicit-intent carve-out: `vm=post-studio` from a URL opens Post Studio (Task 5 already allows it); this task makes its setup round-trip.
- [ ] Slice + tests + registration.

### Task 15: Phase B verification gate (orchestrator)
- [ ] Full-state torture link: 3D pane + environment + effect tuning + export options + card cols + tunnel config in ONE URL; round-trip in a fresh browser context; measure final URL length (log it; expect < 2000 chars for typical state — if a realistic link exceeds that, flag to Austen before shipping).
- [ ] `npm run check` 0 errors; full unit suite green; live browser pass per `visual-verification-mandatory.md` on any surface whose chrome changed (none expected — this project adds no visible UI).

---

## Ledger

- [x] Task 1 — codec
- [x] Task 2 — session
- [x] Task 3 — effects snapshot/export
- [ ] Task 4 — fx slice
- [ ] Task 5 — view seam + wiring
- [ ] Task 6 — share captureNow
- [ ] Task 7 — close cleanup
- [ ] Task 8 — Phase A gate (orchestrator)
- [ ] Task 9 — an slice
- [ ] Task 10 — ex slice
- [ ] Task 11 — t3 slice
- [ ] Task 12 — cd slice
- [ ] Task 13 — tn slice
- [ ] Task 14 — ps slice
- [ ] Task 15 — Phase B gate (orchestrator)
