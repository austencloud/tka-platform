# Worker Front-Render Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Off-thread, multi-core pictograph card-front rendering that is pixel-parity with the main-thread render, proven green and fast in the `/test/card-back-parity` "Front (worker vs main)" harness, with zero re-integration into the app until the harness passes.

**Architecture:** Sever the worker's only client-only reach (the 4 arrow-override singletons statically importing firebase/auth-bound repos) by lazy-loading those repos inside `doInitialize()`. Then route all 4 override types through a pure-function **resolver seam** so the worker can resolve overrides from a transferred, serializable `OverridePlacementBundle` hydrated into the import-clean `*State` classes — no repo, persister, firebase, or auth in the worker. QR is rendered on main and transferred in.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vite module workers, OffscreenCanvas, Vitest.

**Spec:** `docs/superpowers/specs/active/2026-05-31-worker-front-render-parity-design.md`

**Delicacy note:** Tasks 3 and 4 touch `arrow-adjustment-calculator.ts` / `special-placer.ts` — the positioning core. Execute and review those with the `arrow-positioning-expert` agent. The parity harness is the behavioral gate for the whole plan. Run `npm run check:watch` in the background during iteration; one full `npm run check` before each commit.

**Commit discipline:** Shared index may hold other agents' work. Every commit uses an explicit pathspec: `git commit -m "..." -- <exact files>`. Never bare `git commit`, never `git add -A`.

---

## File Structure

**New files:**
- `src/lib/shared/pictograph/arrow/positioning/placement/services/override-resolvers.ts` — pure-function resolver slots + setters/getters for special, global, prop-geometry (mirrors the existing `defaultOverrideResolver` slot in `arrow-placer.ts`). One responsibility: hold the override read-seam, decoupled from singletons/repos.
- `src/lib/shared/render/services/override-placement-bundle.ts` — `OverridePlacementBundle` type + `buildOverridePlacementBundle()` (main-thread; reads the initialized singletons' repos). Imports singletons — never imported by the worker.
- `src/lib/shared/render/services/seed-override-resolvers.ts` — worker-safe `seedOverrideResolvers(bundle)`: builds the 4 `*State` instances, `loadAll(docs)`, registers the 4 resolvers. Imports only `*State` factories + resolver setters. No firebase/auth.
- Test files alongside (see tasks).

**Modified files:**
- 4 singletons (lazy repo import + resolver registration): `default-override/services/default-override-singleton.ts`, `special-override/services/special-override-singleton.ts`, `global/services/global-adjustment-singleton.ts`, `prop-geometry/services/prop-geometry-singleton.ts`
- 4 repos (add `getAll()` export): `default-override/.../default-arrow-placement-repository.ts`, `special-override/.../special-arrow-placement-repository.ts`, `global/.../global-arrow-adjustment-repository.ts`, `prop-geometry/.../prop-geometry-adjustment-repository.ts`
- `global/state/GlobalArrowAdjustmentState.svelte.ts` (move cascading lookup here)
- `arrow-adjustment-calculator.ts` + `special-placer.ts` (consume resolvers instead of singletons)
- `composition-dispatcher.ts` + `composition.worker.ts` (carry + seed the override bundle)
- `src/routes/test/card-back-parity/+page.svelte` (build + seed override bundle; QR)

---

## Task 1: Lazy-load override repos behind the singletons (worker-safety unblock)

This is the change that actually lets the worker import the render graph. After it, importing a singleton module no longer drags firebase/auth/posthog/`$env` into the worker. Main-thread behavior is unchanged (init still loads from Firestore).

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton.ts`

- [ ] **Step 1: default-override-singleton — convert static repo/persister imports to dynamic, keep types**

Replace the top value imports of the repo + persister with type-only imports, and dynamic-import the concrete classes inside `doInitialize()`.

Change the import block (currently):
```ts
import { DefaultArrowPlacementRepository } from "./default-arrow-placement-repository";
import { DefaultArrowPlacementPersister } from "./default-arrow-placement-persister";
```
to:
```ts
import type { DefaultArrowPlacementRepository } from "./default-arrow-placement-repository";
import type { DefaultArrowPlacementPersister as _DefaultPersister } from "./default-arrow-placement-persister";
```
And inside `doInitialize()`, replace the `new` lines:
```ts
const persister = new DefaultArrowPlacementPersister();
const repository = new DefaultArrowPlacementRepository(persister);
```
with:
```ts
const { DefaultArrowPlacementPersister } = await import("./default-arrow-placement-persister");
const { DefaultArrowPlacementRepository } = await import("./default-arrow-placement-repository");
const persister = new DefaultArrowPlacementPersister();
const repository = new DefaultArrowPlacementRepository(persister);
```
Leave the `setDefaultOverrideResolver(...)` registration and `pictographPreparer.clearCache()` calls exactly as they are.

- [ ] **Step 2: Apply the identical transform to the other three singletons**

`special-override-singleton.ts`, `global-adjustment-singleton.ts`, `prop-geometry-singleton.ts`: change their `import { XxxRepository } / { XxxPersister }` to `import type`, and `await import(...)` the two classes inside each `doInitialize()` right before the `new` calls. (Each file's `doInitialize` already news a persister then a repository — same shape as default.)

- [ ] **Step 3: Prove the worker graph is now free of client-only deps**

Run:
```bash
npx tsx --eval "import('./src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts').then(()=>console.log('arrow-placer import OK')).catch(e=>{console.error(e);process.exit(1)})" 2>&1 | tail -5
```
Expected: `arrow-placer import OK` with no `$env` / `window` / firebase error. (If tsx is unavailable, instead grep-verify no static reach remains — Step 4.)

- [ ] **Step 4: Static-reach guard grep**

Run:
```bash
grep -rnE "^import \{[^}]*\} from .*(default-arrow-placement-(repository|persister)|special-arrow-placement-(repository|persister)|global-arrow-adjustment-(repository|persister)|prop-geometry-adjustment-(repository|persister))" src/lib/shared/pictograph/arrow/positioning/*/services/*-singleton.ts
```
Expected: no matches (all such imports are now `import type` or dynamic).

- [ ] **Step 5: Full typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "singleton\.ts" /tmp/check.log`
Expected: no errors in the four singleton files.

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(arrow-overrides): lazy-load override repos behind singletons (worker-safe import)" -- \
  src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts \
  src/lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton.ts \
  src/lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton.ts \
  src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton.ts
```

---

## Task 2: Move global cascading lookup onto the import-clean State

The worker resolver for global must run identical cascading logic without the repo. The repo's `getAdjustmentCascading` is pure (only calls `this.getAdjustment` + key spreading), so move it onto `GlobalArrowAdjustmentState` (which already has `getAdjustment`) and have the repo delegate.

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/global/state/GlobalArrowAdjustmentState.svelte.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/global/services/global-arrow-adjustment-repository.ts:154-222`
- Test: `src/lib/shared/pictograph/arrow/positioning/global/state/__tests__/global-cascading.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createGlobalArrowAdjustmentState } from "../GlobalArrowAdjustmentState.svelte";
import type { GlobalArrowAdjustment } from "../../domain/GlobalArrowAdjustment";

function adj(over: Partial<GlobalArrowAdjustment>): GlobalArrowAdjustment {
  return {
    gridMode: "diamond", motionType: "pro", placementKey: "n_alpha", turns: "0",
    oriKey: "from_layer1", propType: "staff", otherPropType: "staff",
    x: 0, y: 0, ...over,
  } as GlobalArrowAdjustment;
}

describe("GlobalArrowAdjustmentState.getAdjustmentCascading", () => {
  it("returns layer-2 prop-specific adjustment for non-staff props", () => {
    const s = createGlobalArrowAdjustmentState();
    s.loadAll([adj({ propType: "fan", x: 7, y: 9 })]);
    const r = s.getAdjustmentCascading(
      { gridMode: "diamond", motionType: "pro", placementKey: "n_alpha", turns: "0", oriKey: "from_layer1", propType: "fan", otherPropType: "fan" },
      "fan", "fan",
    );
    expect(r).not.toBeNull();
    expect(r!.layer).toBe(2);
    expect(r!.adjustment.x).toBe(7);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/shared/pictograph/arrow/positioning/global/state/__tests__/global-cascading.test.ts`
Expected: FAIL — `getAdjustmentCascading is not a function`.

- [ ] **Step 3: Add the method to the State class**

In `GlobalArrowAdjustmentState.svelte.ts`, add the import for the result type and the method. Add to the imports:
```ts
import type { CascadingLookupResult } from "../services/types";
```
Add this method to the state object/class (place near `getFullAdjustment`), copied verbatim from the repo but calling the state's own `getAdjustment`:
```ts
getAdjustmentCascading(
  baseKey: GlobalAdjustmentKey,
  thisPropType: string,
  otherPropType: string,
  legacyOriKey?: string,
): CascadingLookupResult | null {
  const normalizedThisProp = thisPropType.toLowerCase();
  const normalizedOtherProp = otherPropType.toLowerCase();
  const fallbackKey = legacyOriKey && legacyOriKey !== baseKey.oriKey
    ? { ...baseKey, oriKey: legacyOriKey }
    : null;

  if (normalizedThisProp !== "staff" || normalizedOtherProp !== "staff") {
    const layer3Key: GlobalAdjustmentKey = { ...baseKey, propType: normalizedThisProp, otherPropType: normalizedOtherProp };
    const layer3 = this.getAdjustment(layer3Key);
    if (layer3) return { adjustment: layer3, layer: 3 };
    if (fallbackKey) {
      const layer3Fallback: GlobalAdjustmentKey = { ...fallbackKey, propType: normalizedThisProp, otherPropType: normalizedOtherProp };
      const layer3fb = this.getAdjustment(layer3Fallback);
      if (layer3fb) return { adjustment: layer3fb, layer: 3 };
    }
  }

  const layer2Key: GlobalAdjustmentKey = { ...baseKey, propType: normalizedThisProp };
  const layer2 = this.getAdjustment(layer2Key);
  if (layer2) return { adjustment: layer2, layer: 2 };
  if (fallbackKey) {
    const layer2Fallback: GlobalAdjustmentKey = { ...fallbackKey, propType: normalizedThisProp };
    const layer2fb = this.getAdjustment(layer2Fallback);
    if (layer2fb) return { adjustment: layer2fb, layer: 2 };
  }

  if (normalizedThisProp === "staff" && normalizedOtherProp === "staff") {
    const layer1 = this.getAdjustment(baseKey);
    if (layer1) return { adjustment: layer1, layer: 1 };
    if (fallbackKey) {
      const layer1fb = this.getAdjustment(fallbackKey);
      if (layer1fb) return { adjustment: layer1fb, layer: 1 };
    }
  }
  return null;
}
```
> If `this.getAdjustment` is not accessible from within the factory's returned object (closure-style state), call the local function that backs `getAdjustment` instead. Match the file's existing method style.

- [ ] **Step 4: Delegate from the repo**

In `global-arrow-adjustment-repository.ts`, replace the body of `getAdjustmentCascading(baseKey, thisPropType, otherPropType, legacyOriKey)` (lines ~154-222) with a one-line delegation:
```ts
getAdjustmentCascading(
  baseKey: GlobalAdjustmentKey,
  thisPropType: string,
  otherPropType: string,
  legacyOriKey?: string,
): CascadingLookupResult | null {
  return this.state.getAdjustmentCascading(baseKey, thisPropType, otherPropType, legacyOriKey);
}
```

- [ ] **Step 5: Run the test — expect PASS**

Run: `npx vitest run src/lib/shared/pictograph/arrow/positioning/global/state/__tests__/global-cascading.test.ts`
Expected: PASS.

- [ ] **Step 6: Run existing global-adjustment tests to confirm no regression**

Run: `npx vitest run src/lib/shared/pictograph/arrow/positioning/global`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor(arrow-overrides): move global cascading lookup onto GlobalArrowAdjustmentState" -- \
  src/lib/shared/pictograph/arrow/positioning/global/state/GlobalArrowAdjustmentState.svelte.ts \
  src/lib/shared/pictograph/arrow/positioning/global/services/global-arrow-adjustment-repository.ts \
  src/lib/shared/pictograph/arrow/positioning/global/state/__tests__/global-cascading.test.ts
```

---

## Task 3: Create the override resolver seam (new module)

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/placement/services/override-resolvers.ts`
- Test: `src/lib/shared/pictograph/arrow/positioning/placement/services/__tests__/override-resolvers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { Point } from "fabric";
import {
  setSpecialOverrideResolver, getSpecialOverrideResolver,
  setGlobalAdjustmentResolver, getGlobalAdjustmentResolver,
  setPropGeometryResolver, getPropGeometryResolver,
} from "../override-resolvers";

describe("override-resolvers seam", () => {
  beforeEach(() => {
    setSpecialOverrideResolver(null);
    setGlobalAdjustmentResolver(null);
    setPropGeometryResolver(null);
  });

  it("special resolver round-trips getOverride/getFullOverride", () => {
    setSpecialOverrideResolver({
      getOverride: () => new Point(3, 4),
      getFullOverride: () => null,
    });
    expect(getSpecialOverrideResolver()!.getOverride("k")!.x).toBe(3);
  });

  it("global + prop-geometry resolver slots default to null", () => {
    expect(getGlobalAdjustmentResolver()).toBeNull();
    expect(getPropGeometryResolver()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (module missing)**

Run: `npx vitest run src/lib/shared/pictograph/arrow/positioning/placement/services/__tests__/override-resolvers.test.ts`
Expected: FAIL — cannot find module `../override-resolvers`.

- [ ] **Step 3: Create the resolver module**

```ts
// Pure-function override read-seam. Lets the render path consume admin
// placement overrides without importing the firebase/auth-bound singletons.
// Main thread registers resolvers backed by the repos (in each singleton's
// doInitialize); the composition worker registers resolvers backed by the
// import-clean *State classes seeded from a transferred bundle. Mirrors the
// existing defaultOverrideResolver slot in arrow-placer.ts.
import type { Point } from "fabric";
import type {
  GlobalAdjustmentKey,
} from "../../global/domain/GlobalArrowAdjustment";
import type { CascadingLookupResult } from "../../global/services/types";
import type { SpecialArrowPlacement } from "../../special-override/domain/SpecialArrowPlacement";
import type { PropGeometryKey } from "../../prop-geometry/domain/PropGeometryAdjustment";
import type { CascadingPropGeometryResult } from "../../prop-geometry/services/types";

export interface SpecialOverrideResolver {
  getOverride(key: string): Point | null;
  getFullOverride(key: string): SpecialArrowPlacement | null;
}
export type GlobalAdjustmentResolver = (
  baseKey: GlobalAdjustmentKey,
  thisPropType: string,
  otherPropType: string,
  legacyOriKey?: string,
) => CascadingLookupResult | null;
export type PropGeometryResolver = (
  key: PropGeometryKey,
) => CascadingPropGeometryResult | null;

let specialOverrideResolver: SpecialOverrideResolver | null = null;
let globalAdjustmentResolver: GlobalAdjustmentResolver | null = null;
let propGeometryResolver: PropGeometryResolver | null = null;

export function setSpecialOverrideResolver(r: SpecialOverrideResolver | null): void {
  specialOverrideResolver = r;
}
export function getSpecialOverrideResolver(): SpecialOverrideResolver | null {
  return specialOverrideResolver;
}
export function setGlobalAdjustmentResolver(r: GlobalAdjustmentResolver | null): void {
  globalAdjustmentResolver = r;
}
export function getGlobalAdjustmentResolver(): GlobalAdjustmentResolver | null {
  return globalAdjustmentResolver;
}
export function setPropGeometryResolver(r: PropGeometryResolver | null): void {
  propGeometryResolver = r;
}
export function getPropGeometryResolver(): PropGeometryResolver | null {
  return propGeometryResolver;
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest run src/lib/shared/pictograph/arrow/positioning/placement/services/__tests__/override-resolvers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(arrow-overrides): add pure-function override resolver seam" -- \
  src/lib/shared/pictograph/arrow/positioning/placement/services/override-resolvers.ts \
  src/lib/shared/pictograph/arrow/positioning/placement/services/__tests__/override-resolvers.test.ts
```

---

## Task 4: Consume the resolver seam in the calculator + special-placer (arrow-positioning-expert)

> **Run with `arrow-positioning-expert`.** Mechanical data-source swap; logic unchanged. The parity harness (Task 9) is the behavioral gate. Resolver-present replaces the `?.isInitialized` guard, since resolvers are registered only after init.

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts` (imports + sites 203/263, 308, 339, 589, 598, 665)
- Modify: `src/lib/shared/pictograph/arrow/positioning/placement/services/special-placer.ts` (import line 31 + site 104/113)

- [ ] **Step 1: Swap imports in arrow-adjustment-calculator.ts**

Remove:
```ts
import { getPropGeometryRepository } from "../../prop-geometry/services/prop-geometry-singleton";
import { getGlobalAdjustmentRepository } from "../../global/services/global-adjustment-singleton";
import { getSpecialOverrideRepository } from "../../special-override/services/special-override-singleton";
```
Add:
```ts
import {
  getSpecialOverrideResolver,
  getGlobalAdjustmentResolver,
  getPropGeometryResolver,
} from "../../placement/services/override-resolvers";
```

- [ ] **Step 2: Convert the global site (~line 203/263)**

Replace:
```ts
const repo = getGlobalAdjustmentRepository();
```
…and its `if (repo?.isInitialized)` guard + `repo.getAdjustmentCascading(baseKey, thisPropType, otherPropType, legacyOriKey)` call with:
```ts
const globalResolver = getGlobalAdjustmentResolver();
```
guard `if (globalResolver)` and call `globalResolver(baseKey, thisPropType, otherPropType, legacyOriKey)`. Keep the result-handling (`cascadingResult.adjustment` / `.layer`) identical.

- [ ] **Step 3: Convert the four special sites (308, 339, 589, 598)**

At each site replace `const ... = getSpecialOverrideRepository();` + `if (repo?.isInitialized ...)` with `const specialResolver = getSpecialOverrideResolver();` + `if (specialResolver ...)`. Replace `repo.getFullOverride(key)` → `specialResolver.getFullOverride(key)` (sites 308, 339) and `repo.getOverride(key)` → `specialResolver.getOverride(key)` (sites 589, 598). Preserve every surrounding condition (`pictographData.letter`, key computation, `new Point(...)` wrapping) verbatim.

- [ ] **Step 4: Convert the prop-geometry site (~line 665)**

In `lookupPropGeometryAdjustment`, replace:
```ts
const repo = getPropGeometryRepository();
if (!repo?.isInitialized) return null;
...
const result = repo.getAdjustmentCascading(propGeometryKey);
```
with:
```ts
const propGeometryResolver = getPropGeometryResolver();
if (!propGeometryResolver) return null;
...
const result = propGeometryResolver(propGeometryKey);
```
Keep `derivePropGeometryKey(...)` and `result ? result.adjustment : null` unchanged.

- [ ] **Step 5: Convert special-placer.ts (line 31 import + site 104/113)**

Remove the `getGlobalAdjustmentRepository` import (line 31); add `import { getGlobalAdjustmentResolver } from "./override-resolvers";`. Replace `const globalAdjustmentRepo = getGlobalAdjustmentRepository();` + guard + `globalAdjustmentRepo.getAdjustmentCascading(baseKey, thisPropType, otherPropType, legacyOriKey)` with the resolver equivalent (`const globalResolver = getGlobalAdjustmentResolver(); if (globalResolver) { const cascadingResult = globalResolver(baseKey, thisPropType, otherPropType, legacyOriKey); ... }`).

- [ ] **Step 6: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "arrow-adjustment-calculator\.ts|special-placer\.ts" /tmp/check.log`
Expected: no errors in those two files.

- [ ] **Step 7: Run arrow positioning tests**

Run: `npx vitest run src/lib/shared/pictograph/arrow`
Expected: all pass (resolvers unregistered in unit tests → null → base placements, same as uninitialized repos before).

- [ ] **Step 8: Commit**

```bash
git commit -m "refactor(arrow-overrides): consume resolver seam in calculator + special-placer" -- \
  src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts \
  src/lib/shared/pictograph/arrow/positioning/placement/services/special-placer.ts
```

---

## Task 5: Main-thread resolver registration in the singletons + repo `getAll()`

Each singleton registers its resolver after init; each repo exposes its loaded docs for the bundle.

**Files:**
- Modify: 4 repos (add `getAll()`)
- Modify: `special-override-singleton.ts`, `global-adjustment-singleton.ts`, `prop-geometry-singleton.ts` (register resolver in `doInitialize`, clear in `dispose`)
- (default-override-singleton already registers `setDefaultOverrideResolver`.)

- [ ] **Step 1: Add `getAll()` to each repo**

- `default-arrow-placement-repository.ts`: the state lacks a docs export; add to the State a `getAllDocs(): DefaultArrowPlacementDoc[]` that returns the loaded docs array, then repo `getAll(): DefaultArrowPlacementDoc[] { return this.state.getAllDocs(); }`. (If the state already stores the raw docs from `loadAll`, return a copy; otherwise store them in `loadAll`.)
- `special-arrow-placement-repository.ts`: add `getAll(): SpecialArrowPlacement[] { return this.state.getAllOverrides(); }` and a matching `getAllOverrides()` on the special state returning the loaded array.
- `global-arrow-adjustment-repository.ts`: add `getAll(): GlobalArrowAdjustment[] { return this.state.getAllAdjustments(); }` (state already has `getAllAdjustments()`).
- `prop-geometry-adjustment-repository.ts`: add `getAll(): PropGeometryAdjustment[] { return this.state.getAllAdjustments(); }` and a matching `getAllAdjustments()` on the prop-geometry state returning the loaded array.

For the states that need a new docs-export (default, special, prop-geometry): in each state's `loadAll(docs)`, retain `this._docs = [...docs]` (a private field) and return `[...this._docs]` from the new getter. This guarantees the exported docs are exactly what `loadAll` consumed (round-trips through `loadAll` in the worker).

- [ ] **Step 2: Register resolvers in the three singletons' `doInitialize`**

In `special-override-singleton.ts` `doInitialize`, after `repositoryInstance = repository;`:
```ts
const { setSpecialOverrideResolver } = await import("../../placement/services/override-resolvers");
setSpecialOverrideResolver({
  getOverride: (key) => repository.getOverride(key),
  getFullOverride: (key) => repository.getFullOverride(key),
});
```
And in `disposeSpecialOverrides`, before nulling the instance:
```ts
const { setSpecialOverrideResolver } = await import("../../placement/services/override-resolvers");
setSpecialOverrideResolver(null);
```
(or import the setter statically at the top — the resolver module is import-clean, so a static import here is fine and simpler; prefer static.)

In `global-adjustment-singleton.ts` `doInitialize` after assignment:
```ts
setGlobalAdjustmentResolver((baseKey, thisPropType, otherPropType, legacyOriKey) =>
  repository.getAdjustmentCascading(baseKey, thisPropType, otherPropType, legacyOriKey),
);
```
In `prop-geometry-singleton.ts` `doInitialize` after assignment:
```ts
setPropGeometryResolver((key) => repository.getAdjustmentCascading(key));
```
Clear each in the corresponding `disposeXxx`. Import the setters statically from `../../placement/services/override-resolvers` (import-clean).

> Verify the special/prop-geometry repos actually expose `getOverride`/`getFullOverride`/`getAdjustmentCascading` as public methods (they do per the extraction). If a method is missing, add a one-line delegation to the state.

- [ ] **Step 3: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "repository\.ts|singleton\.ts|State\.svelte\.ts" /tmp/check.log | grep -iE "arrow|prop-geometry|global|special|default"`
Expected: no errors in the touched repo/singleton/state files.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(arrow-overrides): repo getAll() exports + main-thread resolver registration" -- \
  src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts \
  src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts \
  src/lib/shared/pictograph/arrow/positioning/special-override/services/special-arrow-placement-repository.ts \
  src/lib/shared/pictograph/arrow/positioning/special-override/state/SpecialArrowPlacementState.svelte.ts \
  src/lib/shared/pictograph/arrow/positioning/global/services/global-arrow-adjustment-repository.ts \
  src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-adjustment-repository.ts \
  src/lib/shared/pictograph/arrow/positioning/prop-geometry/state/PropGeometryAdjustmentState.svelte.ts \
  src/lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton.ts \
  src/lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton.ts \
  src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton.ts
```

---

## Task 6: `OverridePlacementBundle` + main-thread builder

**Files:**
- Create: `src/lib/shared/render/services/override-placement-bundle.ts`
- Test: `src/lib/shared/render/services/__tests__/override-placement-bundle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildOverridePlacementBundle, type OverridePlacementBundle } from "../override-placement-bundle";

describe("buildOverridePlacementBundle", () => {
  it("returns empty arrays when no override singletons are initialized", () => {
    const b: OverridePlacementBundle = buildOverridePlacementBundle();
    expect(b.default).toEqual([]);
    expect(b.special).toEqual([]);
    expect(b.global).toEqual([]);
    expect(b.propGeometry).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (module missing)**

Run: `npx vitest run src/lib/shared/render/services/__tests__/override-placement-bundle.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the bundle builder**

```ts
// Main-thread snapshot of the four override stores' loaded docs, in exactly
// the shape each store's *State.loadAll(docs) consumes. Structured-clone
// transferred into the composition worker, which hydrates the import-clean
// *State classes and registers resolvers — so worker placement resolution
// matches main pixel-for-pixel. NEVER import this module from the worker.
import { getDefaultOverrideRepository } from "$lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton";
import { getSpecialOverrideRepository } from "$lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton";
import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
import { getPropGeometryRepository } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton";
import type { DefaultArrowPlacementDoc } from "$lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement";
import type { SpecialArrowPlacement } from "$lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement";
import type { GlobalArrowAdjustment } from "$lib/shared/pictograph/arrow/positioning/global/domain/GlobalArrowAdjustment";
import type { PropGeometryAdjustment } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/PropGeometryAdjustment";

export interface OverridePlacementBundle {
  default: DefaultArrowPlacementDoc[];
  special: SpecialArrowPlacement[];
  global: GlobalArrowAdjustment[];
  propGeometry: PropGeometryAdjustment[];
}

export function buildOverridePlacementBundle(): OverridePlacementBundle {
  return {
    default: getDefaultOverrideRepository()?.getAll() ?? [],
    special: getSpecialOverrideRepository()?.getAll() ?? [],
    global: getGlobalAdjustmentRepository()?.getAll() ?? [],
    propGeometry: getPropGeometryRepository()?.getAll() ?? [],
  };
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest run src/lib/shared/render/services/__tests__/override-placement-bundle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(render): OverridePlacementBundle + main-thread builder" -- \
  src/lib/shared/render/services/override-placement-bundle.ts \
  src/lib/shared/render/services/__tests__/override-placement-bundle.test.ts
```

---

## Task 7: Worker-side `seedOverrideResolvers`

**Files:**
- Create: `src/lib/shared/render/services/seed-override-resolvers.ts`
- Test: `src/lib/shared/render/services/__tests__/seed-override-resolvers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { seedOverrideResolvers } from "../seed-override-resolvers";
import {
  getSpecialOverrideResolver, getGlobalAdjustmentResolver, getPropGeometryResolver,
  setSpecialOverrideResolver, setGlobalAdjustmentResolver, setPropGeometryResolver,
} from "$lib/shared/pictograph/arrow/positioning/placement/services/override-resolvers";
import { setDefaultOverrideResolver } from "$lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer";

describe("seedOverrideResolvers", () => {
  beforeEach(() => {
    setSpecialOverrideResolver(null); setGlobalAdjustmentResolver(null);
    setPropGeometryResolver(null); setDefaultOverrideResolver(null);
  });

  it("registers all four resolvers from an empty bundle", () => {
    seedOverrideResolvers({ default: [], special: [], global: [], propGeometry: [] });
    expect(getSpecialOverrideResolver()).not.toBeNull();
    expect(getGlobalAdjustmentResolver()).not.toBeNull();
    expect(getPropGeometryResolver()).not.toBeNull();
  });

  it("a seeded global adjustment resolves through the registered resolver", () => {
    seedOverrideResolvers({
      default: [], special: [], propGeometry: [],
      global: [{ gridMode: "diamond", motionType: "pro", placementKey: "n_alpha", turns: "0", oriKey: "from_layer1", propType: "fan", otherPropType: "fan", x: 5, y: 6 } as never],
    });
    const r = getGlobalAdjustmentResolver()!(
      { gridMode: "diamond", motionType: "pro", placementKey: "n_alpha", turns: "0", oriKey: "from_layer1", propType: "fan", otherPropType: "fan" } as never,
      "fan", "fan",
    );
    expect(r!.adjustment.x).toBe(5);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (module missing)**

Run: `npx vitest run src/lib/shared/render/services/__tests__/seed-override-resolvers.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the seeder**

```ts
// Worker-safe hydration of the override resolver seam from a transferred
// OverridePlacementBundle. Builds the four import-clean *State instances,
// loads the docs, and registers resolvers backed by those states. Imports
// only state factories + resolver setters — no repo, persister, firebase,
// or auth, so it is safe to import inside the composition worker.
import type { OverridePlacementBundle } from "./override-placement-bundle";
import { createDefaultArrowPlacementState } from "$lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte";
import { createSpecialArrowPlacementState } from "$lib/shared/pictograph/arrow/positioning/special-override/state/SpecialArrowPlacementState.svelte";
import { createGlobalArrowAdjustmentState } from "$lib/shared/pictograph/arrow/positioning/global/state/GlobalArrowAdjustmentState.svelte";
import { createPropGeometryAdjustmentState } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/state/PropGeometryAdjustmentState.svelte";
import { setDefaultOverrideResolver } from "$lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer";
import {
  setSpecialOverrideResolver,
  setGlobalAdjustmentResolver,
  setPropGeometryResolver,
} from "$lib/shared/pictograph/arrow/positioning/placement/services/override-resolvers";

export function seedOverrideResolvers(bundle: OverridePlacementBundle): void {
  const defaultState = createDefaultArrowPlacementState();
  defaultState.loadAll(bundle.default);
  setDefaultOverrideResolver((gridMode, motionType, placementKey, turns, propType) =>
    defaultState.getValue(gridMode, propType, motionType, placementKey, turns),
  );

  const specialState = createSpecialArrowPlacementState();
  specialState.loadAll(bundle.special);
  setSpecialOverrideResolver({
    getOverride: (key) => specialState.getOverride(key),
    getFullOverride: (key) => specialState.getFullOverride(key),
  });

  const globalState = createGlobalArrowAdjustmentState();
  globalState.loadAll(bundle.global);
  setGlobalAdjustmentResolver((baseKey, thisPropType, otherPropType, legacyOriKey) =>
    globalState.getAdjustmentCascading(baseKey, thisPropType, otherPropType, legacyOriKey),
  );

  const propGeometryState = createPropGeometryAdjustmentState();
  propGeometryState.loadAll(bundle.propGeometry);
  setPropGeometryResolver((key) => propGeometryState.getAdjustmentCascading(key));
}
```
> Confirm the default resolver arg→state.getValue mapping matches the existing default-override-singleton mapping (`(gridMode, motionType, placementKey, turns, propType) → getValue(gridMode, propType, motionType, placementKey, turns)`); it does per the extraction. `PlacementValue` is a `[number, number]` tuple consumed at `arrow-placer.ts:174`.

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest run src/lib/shared/render/services/__tests__/seed-override-resolvers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(render): worker-safe seedOverrideResolvers from bundle" -- \
  src/lib/shared/render/services/seed-override-resolvers.ts \
  src/lib/shared/render/services/__tests__/seed-override-resolvers.test.ts
```

---

## Task 8: Carry the override bundle through the dispatcher → worker init

**Files:**
- Modify: `src/lib/shared/render/services/composition-dispatcher.ts` (message type, `setOverrideBundle`, init payload)
- Modify: `src/lib/shared/render/workers/composition.worker.ts` (`handleInit` seeds resolvers)

- [ ] **Step 1: Extend the init message + add a pending field**

In `composition-dispatcher.ts`, change the `init` arm of `CompositionWorkerInMessage` to carry the bundle:
```ts
  | {
      type: "init";
      glyphs: ImageBitmap[];
      glyphMeta: GlyphTransferEntry[];
      bundle: import("./card-asset-bundle").AssetBundle;
      overrideBundle: import("./override-placement-bundle").OverridePlacementBundle;
    }
```
Add a pending field + setter near `setAssetBundle`:
```ts
private pendingOverrideBundle: import("./override-placement-bundle").OverridePlacementBundle | null = null;

/** Set the override placement bundle seeded into each worker at init. */
setOverrideBundle(bundle: import("./override-placement-bundle").OverridePlacementBundle): void {
  this.pendingOverrideBundle = bundle;
}
```

- [ ] **Step 2: Include the bundle in the init payload**

In `spawnWorker`, where `initMessage` is built, add the override bundle (it is plain serializable data — structured-cloned by `postMessage`, NOT in the transfer list):
```ts
const initMessage: CompositionWorkerInMessage = {
  type: "init",
  glyphs: clonedBitmaps,
  glyphMeta,
  bundle: bundleClone,
  overrideBundle: this.pendingOverrideBundle ?? { default: [], special: [], global: [], propGeometry: [] },
};
```
Leave the transfer list unchanged (`[...clonedBitmaps, ...bundleTransferables(bundleClone)]`).

- [ ] **Step 3: Seed resolvers in the worker's `handleInit`**

In `composition.worker.ts`, change `handleInit`'s signature and add the seed call. Update the signature:
```ts
async function handleInit(
  glyphs: ImageBitmap[],
  glyphMeta: GlyphTransferEntry[],
  bundle: import("../services/card-asset-bundle").AssetBundle,
  overrideBundle: import("../services/override-placement-bundle").OverridePlacementBundle,
): Promise<void> {
```
After `seedCachesFromBundle(bundle);`, add:
```ts
const { seedOverrideResolvers } = await import("../services/seed-override-resolvers");
seedOverrideResolvers(overrideBundle);
```
And update the `init` case in the router:
```ts
case "init":
  handleInit(msg.glyphs, msg.glyphMeta, msg.bundle, msg.overrideBundle).catch((err) => {
    console.error("[composition.worker] Init failed:", err);
    postResult({ type: "error", id: -1, message: `Init failed: ${err instanceof Error ? err.message : String(err)}` });
  });
  break;
```

- [ ] **Step 4: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "composition-dispatcher\.ts|composition\.worker\.ts" /tmp/check.log`
Expected: no errors in those two files.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(render): carry + seed OverridePlacementBundle through worker init" -- \
  src/lib/shared/render/services/composition-dispatcher.ts \
  src/lib/shared/render/workers/composition.worker.ts
```

---

## Task 9: Wire the harness to seed the override bundle + QR, and validate parity

**Files:**
- Modify: `src/routes/test/card-back-parity/+page.svelte` (front mode: seed override bundle; pass QR bitmap to worker)

- [ ] **Step 1: Seed the override bundle in the front-mode run**

In `+page.svelte`, import the builder:
```ts
import { buildOverridePlacementBundle } from "$lib/shared/render/services/override-placement-bundle";
```
In `makeRun()` front mode, immediately after the existing `getCompositionDispatcher().setAssetBundle(bundle)` call (~line 186), add:
```ts
getCompositionDispatcher().setOverrideBundle(buildOverridePlacementBundle());
```
This snapshots whatever overrides the main thread currently has loaded, so worker and main resolve identically.

- [ ] **Step 2: Render a QR bitmap on main and pass it to the worker**

In `renderFrontWorker(seq)`, render a QR bitmap on main (worker has no QR generator) and pass it through the existing `composeFrontBitmap` `qrBitmap` param. Only do this if `frontOptions()` is extended to request QR; for the parity milestone QR is optional. If QR is not in `frontOptions`, pass `null`:
```ts
async function renderFrontWorker(seq: SequenceData): Promise<HTMLCanvasElement> {
  const bmp = await getCompositionDispatcher().composeFrontBitmap(seq, frontOptions(), null);
  return normalizeToCanvas(bmp as CanvasImageSource, OUT_W, OUT_H);
}
```
> QR parity is exercised at integration time (the deck render includes QR). The harness front options do not currently render QR, so `null` keeps worker == main here. (If QR is later added to `frontOptions`, render it via the main `ImageComposer.qrGenerator` at `PrintCardRenderer.QR_BITMAP_SIZE` and pass the `ImageBitmap`.)

- [ ] **Step 3: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "card-back-parity/\+page\.svelte" /tmp/check.log`
Expected: no errors.

- [ ] **Step 4: Manual parity gate (user-driven browser)**

Hard-reload `http://localhost:5173/test/card-back-parity` (respawns workers with new code), run "Front (worker vs main)". Capture the result JSON. **Pass criteria:** no `$env` / `window` / "Failed to render beat" console errors; every WORKER cell renders pictographs + header glyphs; worst diff ≤ 1% across the set (including override-bearing sequences like `BΦ-LΦ`).

> This step is verified by the user (Claude does not drive the browser here). Report the harness JSON + a screenshot. If diff > 1% on a specific sequence, the failing override type is the suspect — diff its resolved value main vs worker.

- [ ] **Step 5: Commit (only after the gate passes)**

```bash
git commit -m "feat(test): seed override bundle into worker front-render parity harness" -- \
  src/routes/test/card-back-parity/+page.svelte
```

---

## Task 10: Multicore speed validation

- [ ] **Step 1: Measure**

With the harness green, the user runs the front comparison on the full set and reports: wall-clock for worker vs main, and (via DevTools performance trace, user-captured) that multiple `DedicatedWorker` threads show CPU-busy time during the draw. **Pass:** worker wall-clock materially below main, ≥2 worker threads active.

- [ ] **Step 2: Record the result**

Append a short "Results" section to the spec (`docs/superpowers/specs/active/2026-05-31-worker-front-render-parity-design.md`) with the measured numbers, and commit:
```bash
git commit -m "docs(spec): record worker front-render parity + speed results" -- \
  docs/superpowers/specs/active/2026-05-31-worker-front-render-parity-design.md
```

---

## Out of scope (do not touch in this plan)

- Re-integration into `PrintPreviewPages.svelte` / `PrintCardRenderer.ts` (they stay main-thread). That is a separate follow-up plan, gated on this harness being green and fast.
- The card-**back** BackJob word/glyph parity gap (unrelated subsystem).

## Self-review notes

- **Spec coverage:** Part 1 → Task 1; resolver seam (Part 2) → Tasks 2–5,7,8; bundle (Part 2) → Tasks 6,8; QR (Part 3) → Task 9 Step 2; validation → Tasks 9–10. Covered.
- **Type consistency:** resolver types (`SpecialOverrideResolver`, `GlobalAdjustmentResolver`, `PropGeometryResolver`) defined in Task 3, consumed in Tasks 4/5/7; `OverridePlacementBundle` defined in Task 6, consumed in Tasks 7/8/9; `getAll()` defined in Task 5, consumed in Task 6. Method names match the extraction (`getOverride`/`getFullOverride`/`getAdjustmentCascading`/`getValue`/`getAllAdjustments`).
- **Open item to verify during execution:** special + prop-geometry repos must expose `getAll()` and their states a docs-export getter (Task 5 Step 1 adds these); global state's `getAllAdjustments()` already exists.
