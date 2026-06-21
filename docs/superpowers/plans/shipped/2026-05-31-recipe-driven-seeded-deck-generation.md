# Recipe-Driven Seeded Deck Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deck releaser's LOOP draw recipe-driven and seeded — every Generate follows the exact dials (loop type, level, period, step-count weights, deck size, start-ori, grid, start-position subset, reversal + turn variation), yields a fresh 52 each time, and is reproducible from a stored `(recipe, seed)`.

**Architecture:** The Firestore LOOP pool stays as the derived cache (per `2026-05-31-unified-generation-vocabulary-design.md` §Decision 1). Today's draw (`composeDeck`) already produces a fresh subset via bare `Math.random()` — this plan replaces that with a **seeded RNG** threaded from an explicit recipe seed, so "fresh each time" becomes "fresh on reroll, identical on reproduce." Loop type / level / period become real axes by filtering the catalog set (`Catalog` already carries `loopType`, `level`, `sliceType`, `stepCount`) before building the pool. A new start-position subset filter narrows which base seeds the pool draws from. The recipe (dials + seed + `generatorVersion`) is stamped onto every release; Reroll mints a new seed with dials fixed.

**Tech Stack:** Svelte 5 runes, TypeScript, Vitest. Pure functions in `choreo-card/services/`, RNG util in `shared/foundation/utils/`. No new dependencies — `sfc32`/`cyrb128` are tiny public-domain PRNGs (bryc), and canonical JSON is a sorted-key stringify.

---

## Scope

**In scope (this plan — the user's ask: "every time I generate 52 it follows the exact parameters and I get a fresh 52 each time"):**

1. Seeded RNG utility (`sfc32` + `cyrb128`) + canonical-JSON recipe hashing — shared, reusable, RFC-grounded.
2. Extend the `DeckRecipe` model with `seed`, `generatorVersion`, `schemaVersion`, and the new axes (`loopType`, `level`, `period`, `startPositionIds`).
3. Thread a seeded `Rng` through `composeDeck` / `fisherYatesSample` / `shuffle` / `swapCard` (replace the four bare `Math.random()` calls). `rollVariation` / `applyVariation` already accept an injectable `Rng` — feed them the same seeded stream.
4. **Per-slot sub-stream seeding** so adding/removing one card leaves the others bit-identical (load-bearing for incremental edits and content-fingerprint dedup).
5. Loop type / level / period as catalog-selection axes (extend `CatalogPoolFilter`).
6. Start-position subset filter on the pool.
7. Reroll = mint a new seed, dials fixed. Stamp recipe (with seed + version) on release. Reproduce a deck exactly from its stored recipe.
8. Integrate the existing content-fingerprint dedup ledger (`hashDeckContent`) so overlapping rerolls are still caught.

**Out of scope (deferred — see "Known Gaps" at end):**

- **The bento-grid UI port** (prototype `src/routes/test/unified-generation/+page.svelte` → real Configure step). That is Phase 1 of the design spec; it is a layout refactor + component swap and gets its own plan. This plan exposes the *data contract* (the extended recipe) that the UI will bind to, and ships a temporary set of controls on the existing Configure step to drive the new axes so the generation behavior is testable before the UI port lands.
- **Live sequence generation** (`SequenceBuilder`) for `(loopType, level, period, stepCount)` combinations not yet enumerated into Firestore. The engine is currently unseeded (`Math.random` for rotation direction, start position, bridges). Seeding the engine is a separate, larger effort. This plan generates from the **existing enumerated pool** and surfaces an unavailable combination as guidance ("no quartered inverted LOOPs enumerated at 10 steps — run `scripts/enumerate-deck.cjs`"), never a silent empty deck.
- **Props / Hands / Dashes (Smooth/Mixed/Choppy) as generation constraints.** These are `constraintPreset` axes the live builder honors; the pre-enumerated pool was built with a fixed reversal pattern and cannot honor them. They are deferred to the live-generation phase. The prototype's Props/Hands/Dashes tiles map onto the **deck reversal/turn variation system** (`reversalPattern`, `variationConfig`) where they overlap — that mapping is specified in the UI-port plan, not here.

---

## File Structure

**Create:**

- `src/lib/shared/foundation/utils/seeded-rng.ts` — `cyrb128(str) → [number,number,number,number]`, `sfc32(a,b,c,d) → () => number`, `makeRng(seed: string) → () => number`, `childSeed(seed: string, key: string|number) → string`. One responsibility: deterministic seeded pseudo-randomness. (No internal seeded-RNG existed — `shared/3d/procedural-engine/generation/seed-generator.ts` is 3D-domain-scoped; this is the general-purpose home.)
- `src/lib/shared/foundation/utils/canonical-json.ts` — `canonicalJSON(value) → string` (recursively sorted object keys, RFC-8785-style) so logically-identical recipes hash identically. (No generic stable-stringify existed — `comparison/sequence-canonicalizer.ts` is sequence-domain-specific.)
- `src/lib/features/choreo-card/services/deck-recipe.ts` — recipe hashing + seed derivation glue: `hashRecipe(recipe) → string` (canonicalJSON ⊕ sfc32 master seed), `GENERATOR_VERSION` constant, `mintSeed() → string`. Bridges the generic RNG util to the deck domain.
- Test files alongside each (see tasks).

**Modify:**

- `src/lib/features/choreo-card/domain/models/DeckRelease.ts` — extend `DeckRecipe` (lines 53–67) with `seed`, `generatorVersion`, `schemaVersion`, `loopType?`, `level?`, `period?`, `startPositionIds?`.
- `src/lib/features/choreo-card/services/deck-composer.ts` — add `rng: () => number` parameter to `composeDeck` (130), `fisherYatesSample` (223), `shuffle` (233), `swapCard` (~205); extend `CatalogPoolFilter` (26) + `buildSequencePool` (47) with `loopType`/`level` and a `startPositionIds` filter.
- `src/lib/features/choreo-card/services/deck-variation.ts` — no signature change (already takes `Rng`); confirm the seeded stream is passed at call sites.
- `src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts` — add `seed`, `loopType`, `level`, `period`, `selectedStartPositionIds` state; extend `toRecipe()` (209) and `loadRecipe()` (233); add `reroll()`.
- `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte` — `composeFullDeck()` (535) builds the seeded rng from the recipe and passes it down; `handleDraw` (593) / `handleRedraw` (607) mint/keep the seed appropriately.

---

## Task 1: Seeded RNG utility

**Files:**
- Create: `src/lib/shared/foundation/utils/seeded-rng.ts`
- Test: `src/lib/shared/foundation/utils/__tests__/seeded-rng.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/shared/foundation/utils/__tests__/seeded-rng.test.ts
import { describe, it, expect } from "vitest";
import { cyrb128, sfc32, makeRng, childSeed } from "../seeded-rng";

describe("seeded-rng", () => {
  it("makeRng is deterministic for the same seed", () => {
    const a = makeRng("deck-seed-001");
    const b = makeRng("deck-seed-001");
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = makeRng("seed-A");
    const b = makeRng("seed-B");
    expect(a()).not.toEqual(b());
  });

  it("yields floats in [0, 1)", () => {
    const r = makeRng("range-check");
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("childSeed is stable per key and distinct across keys", () => {
    expect(childSeed("master", 3)).toEqual(childSeed("master", 3));
    expect(childSeed("master", 3)).not.toEqual(childSeed("master", 4));
  });

  it("cyrb128 returns four uint32 values", () => {
    const h = cyrb128("hello");
    expect(h).toHaveLength(4);
    for (const n of h) expect(n).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/foundation/utils/__tests__/seeded-rng.test.ts`
Expected: FAIL — "Cannot find module '../seeded-rng'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/shared/foundation/utils/seeded-rng.ts
/**
 * Deterministic seeded pseudo-randomness for reproducible draws.
 *
 * cyrb128 (hash → 128-bit seed) + sfc32 (fast, well-distributed 32-bit PRNG).
 * sfc32 — not mulberry32, which skips ~1/3 of 32-bit values. Public-domain
 * algorithms (bryc, github.com/bryc/code/blob/master/jshash). Never Math.random
 * for draw logic that must reproduce from a stored seed.
 */

export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k: number; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Build a PRNG from any string seed. */
export function makeRng(seed: string): () => number {
  const [a, b, c, d] = cyrb128(seed);
  return sfc32(a, b, c, d);
}

/**
 * Derive a stable sub-stream seed for one keyed slot. Per-slot sub-streams mean
 * adding/removing one card leaves every other card's stream bit-identical, so an
 * incremental edit never reshuffles the whole deck.
 */
export function childSeed(seed: string, key: string | number): string {
  return `${seed}:${key}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/foundation/utils/__tests__/seeded-rng.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/foundation/utils/seeded-rng.ts src/lib/shared/foundation/utils/__tests__/seeded-rng.test.ts
git commit -m "feat(deck-gen): seeded RNG util (sfc32 + cyrb128 + sub-streams)" -- src/lib/shared/foundation/utils/seeded-rng.ts src/lib/shared/foundation/utils/__tests__/seeded-rng.test.ts
```

---

## Task 2: Canonical JSON

**Files:**
- Create: `src/lib/shared/foundation/utils/canonical-json.ts`
- Test: `src/lib/shared/foundation/utils/__tests__/canonical-json.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/shared/foundation/utils/__tests__/canonical-json.test.ts
import { describe, it, expect } from "vitest";
import { canonicalJSON } from "../canonical-json";

describe("canonicalJSON", () => {
  it("sorts object keys so key order does not change the string", () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toEqual(canonicalJSON({ a: 2, b: 1 }));
  });

  it("sorts nested object keys", () => {
    const x = canonicalJSON({ outer: { z: 1, a: 2 } });
    const y = canonicalJSON({ outer: { a: 2, z: 1 } });
    expect(x).toEqual(y);
  });

  it("preserves array order (arrays are ordered)", () => {
    expect(canonicalJSON([1, 2, 3])).not.toEqual(canonicalJSON([3, 2, 1]));
  });

  it("is stable for primitives", () => {
    expect(canonicalJSON("x")).toEqual('"x"');
    expect(canonicalJSON(5)).toEqual("5");
    expect(canonicalJSON(null)).toEqual("null");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/foundation/utils/__tests__/canonical-json.test.ts`
Expected: FAIL — "Cannot find module '../canonical-json'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/shared/foundation/utils/canonical-json.ts
/**
 * Deterministic JSON: object keys sorted recursively (RFC-8785-style) so two
 * logically-identical objects serialize to the same string and hash identically.
 * Arrays keep their order (arrays are ordered data). Used to hash deck recipes
 * into a stable seed.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJSON((value as Record<string, unknown>)[k])}`)
    .join(",");
  return `{${body}}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/foundation/utils/__tests__/canonical-json.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/foundation/utils/canonical-json.ts src/lib/shared/foundation/utils/__tests__/canonical-json.test.ts
git commit -m "feat(deck-gen): canonical-JSON stable stringify for recipe hashing" -- src/lib/shared/foundation/utils/canonical-json.ts src/lib/shared/foundation/utils/__tests__/canonical-json.test.ts
```

---

## Task 3: Extend the DeckRecipe model

**Files:**
- Modify: `src/lib/features/choreo-card/domain/models/DeckRelease.ts:53-67`

- [ ] **Step 1: Read the current model**

Run: `Read src/lib/features/choreo-card/domain/models/DeckRelease.ts` (lines 53–92). Confirm `DeckRecipe`, `DeckReleaseCard`, `StepCountWeight` shapes match the signatures used below.

- [ ] **Step 2: Add the new fields**

Modify `DeckRecipe` (lines 53–67). Add these fields (all optional except where noted so legacy recipes migrate-on-read):

```typescript
export interface DeckRecipe {
  /** Shape version of THIS object — migrate-on-read. Absent ⇒ legacy (treat as 0). */
  schemaVersion?: number;
  /** Generation logic pin. Absent ⇒ legacy pool draw (pre-seeding). */
  generatorVersion?: string;
  /** Explicit draw seed. Reroll mints a new one; reproduce reuses it. Absent ⇒ legacy. */
  seed?: string;

  deckMode: "loop" | "tnd";
  startOriModes: ("radial" | "nonradial" | "split")[];
  gridModes: ("diamond" | "box")[];
  reversalPattern?: ResolvedReversalPattern | null;

  // LOOP axes
  weights?: { stepCount: number; weight: number }[];
  totalCards?: number;
  sliceTypes?: ("halved" | "quartered")[];
  variationConfig?: VariationConfig;
  /** New axis: which loop type(s) the deck draws from. Absent ⇒ all enumerated (legacy = rotated only). */
  loopTypes?: string[];
  /** New axis: which level(s). Absent ⇒ all available. */
  levels?: number[];
  /** New axis: start-position id subset. Absent/empty ⇒ any. */
  startPositionIds?: string[];

  // TnD axes
  tndFamilyIds?: string[];
  tndTurnPatternIds?: string[];
}
```

> Period is already represented by `sliceTypes` (`"halved" | "quartered"`) — "Quartered/Halved" in the prototype maps onto `sliceTypes`, no new field. Loop type and level are multi-select arrays to match the deck's "draw from a subset" model; the prototype's single-value tiles write a one-element array.

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast`
Expected: no new errors in `DeckRelease.ts` or its importers (new fields are optional, so existing `toRecipe` builders still satisfy the type).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/domain/models/DeckRelease.ts
git commit -m "feat(deck-gen): extend DeckRecipe with seed, generatorVersion, loop/level/start-pos axes" -- src/lib/features/choreo-card/domain/models/DeckRelease.ts
```

---

## Task 4: Recipe hashing + seed glue

**Files:**
- Create: `src/lib/features/choreo-card/services/deck-recipe.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-recipe.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/features/choreo-card/services/__tests__/deck-recipe.test.ts
import { describe, it, expect } from "vitest";
import { hashRecipe, mintSeed, GENERATOR_VERSION } from "../deck-recipe";
import type { DeckRecipe } from "../../domain/models/DeckRelease";

const base: DeckRecipe = {
  schemaVersion: 1,
  generatorVersion: GENERATOR_VERSION,
  seed: "abc123",
  deckMode: "loop",
  startOriModes: ["radial"],
  gridModes: ["diamond"],
  totalCards: 52,
  sliceTypes: ["quartered"],
  loopTypes: ["rotated"],
  levels: [1],
};

describe("deck-recipe", () => {
  it("hashRecipe is stable regardless of key insertion order", () => {
    const reordered: DeckRecipe = { ...base, gridModes: ["diamond"], startOriModes: ["radial"] };
    expect(hashRecipe(base)).toEqual(hashRecipe(reordered));
  });

  it("different seeds → different hash", () => {
    expect(hashRecipe(base)).not.toEqual(hashRecipe({ ...base, seed: "different" }));
  });

  it("different dials → different hash", () => {
    expect(hashRecipe(base)).not.toEqual(hashRecipe({ ...base, totalCards: 36 }));
  });

  it("mintSeed yields a 16-hex-char string and varies", () => {
    const s = mintSeed();
    expect(s).toMatch(/^[0-9a-f]{16}$/);
    expect(mintSeed()).not.toEqual(s); // crypto-random; practically never equal
  });

  it("GENERATOR_VERSION is a non-empty string", () => {
    expect(typeof GENERATOR_VERSION).toBe("string");
    expect(GENERATOR_VERSION.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-recipe.test.ts`
Expected: FAIL — "Cannot find module '../deck-recipe'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/features/choreo-card/services/deck-recipe.ts
import type { DeckRecipe } from "../domain/models/DeckRelease";
import { canonicalJSON } from "$lib/shared/foundation/utils/canonical-json";
import { cyrb128 } from "$lib/shared/foundation/utils/seeded-rng";

/**
 * Generation-logic pin. Bump when a change to the draw/variation logic would
 * alter the cards a given (recipe, seed) produces — a bumped version changes
 * every hash, so stale cached decks auto-miss instead of silently drifting.
 */
export const GENERATOR_VERSION = "deck-gen@1.0.0";

/**
 * Stable hash of a recipe's draw-relevant fields ⊕ seed ⊕ generatorVersion.
 * Excludes presentation-only fields (name/description/notes are not on DeckRecipe,
 * so nothing to strip). Logically-identical recipes hash identically via canonical JSON.
 */
export function hashRecipe(recipe: DeckRecipe): string {
  const [a, b, c, d] = cyrb128(canonicalJSON(recipe));
  return [a, b, c, d].map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("");
}

/** Mint a fresh crypto-random seed (Reroll). 64-bit, hex. */
export function mintSeed(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  return buf[0]!.toString(16).padStart(8, "0") + buf[1]!.toString(16).padStart(8, "0");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-recipe.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-recipe.ts src/lib/features/choreo-card/services/__tests__/deck-recipe.test.ts
git commit -m "feat(deck-gen): recipe hashing + seed minting glue" -- src/lib/features/choreo-card/services/deck-recipe.ts src/lib/features/choreo-card/services/__tests__/deck-recipe.test.ts
```

---

## Task 5: Thread a seeded RNG through composeDeck

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-composer.ts` (`composeDeck` 130, `fisherYatesSample` 223, `shuffle` 233, `swapCard` ~205)
- Test: `src/lib/features/choreo-card/services/__tests__/deck-composer-seeded.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/features/choreo-card/services/__tests__/deck-composer-seeded.test.ts
import { describe, it, expect } from "vitest";
import { composeDeck } from "../deck-composer";
import { makeRng } from "$lib/shared/foundation/utils/seeded-rng";
import type { StepCountWeight } from "../../domain/models/DeckRelease";

// Minimal pool: 20 entries at step 8, 20 at step 16.
function pool() {
  const mk = (n: number, step: number) =>
    Array.from({ length: n }, (_, i) => ({
      sequenceId: `S${step}-${i}`,
      sourceCatalogId: "cat",
      stepCount: step,
      word: `S${step}-${i}`,
    }));
  return new Map([
    [8, mk(20, 8)],
    [16, mk(20, 16)],
  ]);
}
const weights: StepCountWeight[] = [
  { stepCount: 16, weight: 50, available: 20 },
  { stepCount: 8, weight: 50, available: 20 },
];

describe("composeDeck seeded", () => {
  it("same seed → identical draw (reproducible)", () => {
    const a = composeDeck(pool(), weights, 10, { center: "x" }, makeRng("seed-1"));
    const b = composeDeck(pool(), weights, 10, { center: "x" }, makeRng("seed-1"));
    expect(a.map((c) => c.sequenceId)).toEqual(b.map((c) => c.sequenceId));
  });

  it("different seed → different draw (fresh on reroll)", () => {
    const a = composeDeck(pool(), weights, 10, { center: "x" }, makeRng("seed-1"));
    const b = composeDeck(pool(), weights, 10, { center: "x" }, makeRng("seed-2"));
    expect(a.map((c) => c.sequenceId)).not.toEqual(b.map((c) => c.sequenceId));
  });

  it("draws the requested count", () => {
    const a = composeDeck(pool(), weights, 10, { center: "x" }, makeRng("seed-1"));
    expect(a).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-composer-seeded.test.ts`
Expected: FAIL — `composeDeck` ignores the 5th argument (or arity mismatch), so the same-seed and different-seed draws are both random and the "different seed" assertion is flaky / "same seed" fails.

- [ ] **Step 3: Thread the rng parameter**

In `deck-composer.ts`:

1. `composeDeck` (line 130) — add a 5th param with a default that preserves current behavior:

```typescript
export function composeDeck(
  pool: Map<number, PoolEntry[]>,
  weights: StepCountWeight[],
  totalCards: number,
  footer: CardFooter = { center: "The Kinetic Alphabet" },
  rng: () => number = Math.random,
): DeckReleaseCard[] {
```

2. At the sampling call (was line 180) pass `rng`: `fisherYatesSample(bucket, count, rng)`.
3. At the final shuffle (was line 183): `shuffle(selected, rng)`.
4. `fisherYatesSample` (line 223) — add `rng: () => number = Math.random` param, replace `Math.random()` (line 227) with `rng()`.
5. `shuffle` (line 233) — add `rng: () => number = Math.random` param, replace `Math.random()` (line 235) with `rng()`.
6. `swapCard` (~line 205) — add `rng: () => number = Math.random` param, replace `Math.random()` (line 210) with `rng()`. Update its single caller (the redraw/swap path in `DeckReleaserTab` — grep `swapCard(`) to pass the deck's seeded stream; if the call site doesn't yet have one, leave the default and note it in the swap-card follow-up.

> Defaulting `rng` to `Math.random` keeps every existing call site compiling and behaving exactly as before until callers opt in (Task 8). No behavior change for un-migrated callers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-composer-seeded.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the existing composer tests for regressions**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/`
Expected: existing `deck-composer-tnd.test.ts`, `deck-variation.test.ts`, etc. still PASS (defaults preserve behavior).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-composer-seeded.test.ts
git commit -m "feat(deck-gen): thread seeded rng through composeDeck/fisherYates/shuffle/swapCard" -- src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-composer-seeded.test.ts
```

---

## Task 6: Loop type / level / start-position catalog + pool filters

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-composer.ts` (`CatalogPoolFilter` 26, `buildSequencePool` 47)
- Test: `src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts
import { describe, it, expect } from "vitest";
import { buildSequencePool } from "../deck-composer";
import type { Catalog } from "../../domain/models/Catalog";

function loopCatalog(over: Partial<Catalog>): Catalog {
  return {
    id: over.id ?? "c", name: "", canonicalName: "", description: "",
    families: [{ id: "f", label: "F", typeCombo: "", sequenceIds: over.id === "rot" ? ["AB"] : ["CD"] }],
    totalSequences: 1, gridMode: "diamond" as any, level: 1, collection: "LOOPs",
    loopType: "rotated", sliceType: "quartered", stepCount: 8, turnPattern: "0-turn",
    reversalPattern: "continuous", ...over,
  } as Catalog;
}

describe("buildSequencePool filters", () => {
  const rotated = loopCatalog({ id: "rot", loopType: "rotated" });
  const inverted = loopCatalog({ id: "inv", loopType: "inverted" });

  it("filters by loopType", () => {
    const pool = buildSequencePool([rotated, inverted], { sliceTypes: new Set(["quartered"]), loopTypes: new Set(["rotated"]) });
    const ids = [...pool.values()].flat().map((e) => e.sourceCatalogId);
    expect(ids).toContain("rot");
    expect(ids).not.toContain("inv");
  });

  it("filters by level", () => {
    const l2 = loopCatalog({ id: "l2", level: 2 });
    const pool = buildSequencePool([rotated, l2], { sliceTypes: new Set(["quartered"]), levels: new Set([2]) });
    const ids = [...pool.values()].flat().map((e) => e.sourceCatalogId);
    expect(ids).toEqual(["l2"]);
  });

  it("no loopType/level filter ⇒ all LOOP catalogs (legacy behavior)", () => {
    const pool = buildSequencePool([rotated, inverted], { sliceTypes: new Set(["quartered"]) });
    expect([...pool.values()].flat()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts`
Expected: FAIL — `CatalogPoolFilter` has no `loopTypes`/`levels`; filter is ignored.

- [ ] **Step 3: Extend the filter**

In `deck-composer.ts`:

```typescript
export interface CatalogPoolFilter {
  sliceTypes: Set<'halved' | 'quartered'>;
  /** Optional loop-type narrowing. Absent ⇒ all loop types in the catalog set. */
  loopTypes?: Set<string>;
  /** Optional level narrowing. Absent ⇒ all levels. */
  levels?: Set<number>;
  /** Optional start-position id subset (applied per pool entry; see Task 7). */
  startPositionIds?: Set<string>;
}
```

In `buildSequencePool` (line 47), after the `sliceTypes` guard (line 52) add:

```typescript
if (filter?.loopTypes && !filter.loopTypes.has(catalog.loopType)) continue;
if (filter?.levels && !filter.levels.has(catalog.level)) continue;
```

(Start-position filtering is per-sequence, deferred to Task 7 — it needs the sequence's start position, which is not on the catalog summary.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts
git commit -m "feat(deck-gen): filter LOOP pool by loopType and level" -- src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts
```

---

## Task 7: Start-position subset filter

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-composer.ts` (`PoolEntry` 19, `buildSequencePool` 47)
- Test: extend `src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts`

> The pool is built from `catalog.families[].sequenceIds` — strings, no start position. The sequence's start position lives on the hydrated `SequenceData.startPosition` (loaded later via `catalog-loader`). Two viable approaches; **Approach A** is chosen because it keeps the draw a pure function of the pool and avoids a second Firestore round-trip at filter time:

**Approach A (chosen):** The enumerated `seqId` is `${startPos}_${seedWord}` (per `enumerate-deck.cjs` write at `catalogs/{deckId}/sequences/{seqId}`). Parse the start-position prefix from the id. Add `startPosition: string` to `PoolEntry` (derived from the id) and filter on it.

- [ ] **Step 1: Verify the id format**

Run: `Grep "seqId" scripts/enumerate-deck.cjs -n` and confirm `seqId = \`${startPos}_${seedWord}\`` (or equivalent). If the format differs, adjust the parse in Step 3 to match the real delimiter. **Do not assume — confirm against the script before writing the parser.**

- [ ] **Step 2: Write the failing test (append to deck-pool-filter.test.ts)**

```typescript
it("filters by start-position id subset", () => {
  const cat = loopCatalog({ id: "sp", loopType: "rotated" });
  // override family with start-position-prefixed ids
  (cat.families as any) = [{ id: "f", label: "F", typeCombo: "", sequenceIds: ["alpha1_AB", "beta3_CD"] }];
  const pool = buildSequencePool([cat], {
    sliceTypes: new Set(["quartered"]),
    startPositionIds: new Set(["alpha1"]),
  });
  const words = [...pool.values()].flat().map((e) => e.sequenceId);
  expect(words).toEqual(["alpha1_AB"]);
});
```

- [ ] **Step 3: Implement the per-entry filter**

Add `startPosition: string` to `PoolEntry` (line 19). In `buildSequencePool`, when pushing an entry, derive `startPosition` from the id prefix and skip if a `startPositionIds` filter is present and excludes it:

```typescript
const startPosition = seqId.split("_")[0] ?? "";
if (filter?.startPositionIds && filter.startPositionIds.size > 0 && !filter.startPositionIds.has(startPosition)) continue;
bucket.push({ sequenceId: seqId, sourceCatalogId: catalog.id, stepCount, word: seqId, startPosition });
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts
git commit -m "feat(deck-gen): start-position subset filter on the LOOP pool" -- src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-pool-filter.test.ts
```

---

## Task 8: Wire state — seed, axes, reroll, recipe round-trip

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts`
- Test: `src/lib/features/choreo-card/components/deck-releaser/__tests__/deck-releaser-recipe.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/features/choreo-card/components/deck-releaser/__tests__/deck-releaser-recipe.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { releaserState } from "../deck-releaser-state.svelte";

describe("deck-releaser recipe round-trip", () => {
  beforeEach(() => releaserState.reset());

  it("toRecipe stamps seed + generatorVersion + new axes", () => {
    releaserState.seed = "fixed-seed";
    releaserState.selectedLoopTypes = new Set(["rotated"]);
    releaserState.selectedLevels = new Set([1]);
    const r = releaserState.toRecipe();
    expect(r.seed).toEqual("fixed-seed");
    expect(r.generatorVersion).toBeTruthy();
    expect(r.loopTypes).toEqual(["rotated"]);
    expect(r.levels).toEqual([1]);
  });

  it("loadRecipe restores seed + axes (reproduce exactly)", () => {
    const r = releaserState.toRecipe();
    r.seed = "stored-seed";
    r.loopTypes = ["inverted"];
    releaserState.loadRecipe(r);
    expect(releaserState.seed).toEqual("stored-seed");
    expect([...releaserState.selectedLoopTypes]).toEqual(["inverted"]);
  });

  it("reroll mints a new seed, leaves dials untouched", () => {
    releaserState.selectedLoopTypes = new Set(["rotated"]);
    const before = releaserState.seed;
    releaserState.reroll();
    expect(releaserState.seed).not.toEqual(before);
    expect([...releaserState.selectedLoopTypes]).toEqual(["rotated"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/components/deck-releaser/__tests__/deck-releaser-recipe.test.ts`
Expected: FAIL — `seed`, `selectedLoopTypes`, `selectedLevels`, `reroll` do not exist.

- [ ] **Step 3: Add state + extend toRecipe/loadRecipe/reset + reroll**

In `deck-releaser-state.svelte.ts`:

1. Import the seed minter: `import { mintSeed, GENERATOR_VERSION } from "../../services/deck-recipe";`
2. Add state fields near the other LOOP dials:

```typescript
seed = $state<string>(mintSeed());
selectedLoopTypes = $state<Set<string>>(new Set(["rotated"]));
selectedLevels = $state<Set<number>>(new Set([1]));
selectedStartPositionIds = $state<Set<string>>(new Set()); // empty ⇒ any
```

3. In `toRecipe()` (line 209), inside the `deckMode === "loop"` branch, add:

```typescript
recipe.seed = this.seed;
recipe.generatorVersion = GENERATOR_VERSION;
recipe.schemaVersion = 1;
recipe.loopTypes = [...this.selectedLoopTypes];
recipe.levels = [...this.selectedLevels];
if (this.selectedStartPositionIds.size > 0) recipe.startPositionIds = [...this.selectedStartPositionIds];
```

4. In `loadRecipe()` (line 233), inside the `recipe.deckMode === "loop"` branch, add (with legacy fallbacks):

```typescript
this.seed = recipe.seed ?? mintSeed();
if (recipe.loopTypes?.length) this.selectedLoopTypes = new Set(recipe.loopTypes);
if (recipe.levels?.length) this.selectedLevels = new Set(recipe.levels);
this.selectedStartPositionIds = new Set(recipe.startPositionIds ?? []);
```

5. Add a `reroll()` method:

```typescript
/** New draw, same dials: mint a fresh seed and clear the composed draft so the
 *  next compose draws afresh. Dials (loop type, level, weights, …) untouched. */
reroll() {
  this.seed = mintSeed();
  this.cards = [];
  this.sequences = [];
  this.persist();
}
```

6. In `reset()` (line 270) and the LOOP branch of `loadRecipe`, ensure `selectedLoopTypes`/`selectedLevels`/`selectedStartPositionIds` are reset to defaults. Add `seed: mintSeed()` reset in `reset()`.
7. Persist the new axes: add `seed`, `loopTypes`, `levels`, `startPositionIds` to `PersistedSession` (line 13), `saveSession`/`persist()` (line 151), and the constructor restore (line 117). Follow the exact pattern of `sliceTypes` (`Set` ↔ array).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/components/deck-releaser/__tests__/deck-releaser-recipe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts src/lib/features/choreo-card/components/deck-releaser/__tests__/deck-releaser-recipe.test.ts
git commit -m "feat(deck-gen): recipe seed + loop/level/start-pos axes + reroll in releaser state" -- src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts src/lib/features/choreo-card/components/deck-releaser/__tests__/deck-releaser-recipe.test.ts
```

---

## Task 9: Compose from the seeded recipe in the Tab

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte` (`composeFullDeck` 535, `handleDraw` 593, `handleRedraw` 607)

- [ ] **Step 1: Read the current compose path**

Run: `Read DeckReleaserTab.svelte` lines 525–615. Confirm `composeFullDeck()`, the `buildSequencePool(...)` call (and what filter it passes), `loopDrawCounts`, `composeDeck(pool, rs.weights, base, …)`, `handleDraw`, `handleRedraw`.

- [ ] **Step 2: Build the seeded rng from the recipe and pass it down**

In `composeFullDeck()` (line 535), the LOOP branch:

1. Build the master rng from the current recipe:

```typescript
import { makeRng } from "$lib/shared/foundation/utils/seeded-rng";
import { hashRecipe } from "../../services/deck-recipe";
// …
const recipe = rs.toRecipe();
const rng = makeRng(`${recipe.seed}:${hashRecipe(recipe)}`);
```

2. Pass the new filter axes into `buildSequencePool`:

```typescript
const pool = buildSequencePool(catalogs, {
  sliceTypes: rs.selectedSliceTypes,
  loopTypes: rs.selectedLoopTypes,
  levels: rs.selectedLevels,
  startPositionIds: rs.selectedStartPositionIds.size > 0 ? rs.selectedStartPositionIds : undefined,
});
```

3. Pass `rng` to `composeDeck`:

```typescript
const cards = composeDeck(pool, rs.weights, base, { center: rs.notes }, rng);
```

4. Where variations are rolled (grep `rollVariation(` / `applyVariation(` in the compose/load path — likely in `loadSelectedSequences` or `resolveDeckSequences`), pass a **per-slot sub-stream**: for card at index `i`, `makeRng(childSeed(\`${recipe.seed}:${hashRecipe(recipe)}\`, i))`. This makes each card's variation a pure function of `(recipe, slotIndex)` — Task 10 asserts the stability this buys.

- [ ] **Step 3: handleDraw mints a fresh seed; handleRedraw rerolls**

- `handleDraw` (line 593): before composing, `rs.seed = mintSeed();` (a brand-new deck = a fresh draw). Keep the rest (`rs.name = ""`, dedup bounce, advance to review).
- `handleRedraw` (line 607): call `rs.reroll()` (which mints the seed + clears cards) then `rs.cards = composeFullDeck();`. Same dials, fresh draw.

> Import `mintSeed` from `../../services/deck-recipe`.

- [ ] **Step 4: Verify the runtime behavior**

This is a Svelte component — verify in the running app, not a unit test. Run:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/   # app boots
npm run check:fast
```

Then, per `verification-protocol.md`, ask the user to confirm in the browser: open the deck releaser, set loop type + level, Draw 52, note the cards; Redraw → a different 52; reload a released deck → identical cards. **State explicitly that this needs user/browser confirmation** (component behavior can't be proven from a unit test alone). Alternatively, if browser-control permission is granted, drive it via Chrome DevTools MCP and capture the two draws.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "feat(deck-gen): compose from seeded recipe + loop/level/start-pos filters; reroll" -- src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
```

---

## Task 10: Reproducibility + sub-stream stability acceptance tests

**Files:**
- Create: `src/lib/features/choreo-card/services/__tests__/deck-reproducibility.test.ts`

- [ ] **Step 1: Write the acceptance test**

```typescript
// src/lib/features/choreo-card/services/__tests__/deck-reproducibility.test.ts
import { describe, it, expect } from "vitest";
import { composeDeck } from "../deck-composer";
import { makeRng, childSeed } from "$lib/shared/foundation/utils/seeded-rng";
import { hashRecipe } from "../deck-recipe";
import type { DeckRecipe } from "../../domain/models/DeckRelease";
import type { StepCountWeight } from "../../domain/models/DeckRelease";

function pool() {
  const mk = (n: number, step: number) =>
    Array.from({ length: n }, (_, i) => ({ sequenceId: `S${step}-${i}`, sourceCatalogId: "c", stepCount: step, word: `S${step}-${i}` }));
  return new Map([[8, mk(40, 8)], [16, mk(40, 16)]]);
}
const weights: StepCountWeight[] = [
  { stepCount: 16, weight: 50, available: 40 },
  { stepCount: 8, weight: 50, available: 40 },
];
const recipe: DeckRecipe = {
  schemaVersion: 1, generatorVersion: "deck-gen@1.0.0", seed: "REPRO",
  deckMode: "loop", startOriModes: ["radial"], gridModes: ["diamond"],
  totalCards: 20, sliceTypes: ["quartered"], loopTypes: ["rotated"], levels: [1],
};

describe("deck reproducibility", () => {
  it("identical (recipe, seed) → byte-identical deck (the wipe-and-rebuild invariant)", () => {
    const key = `${recipe.seed}:${hashRecipe(recipe)}`;
    const a = composeDeck(pool(), weights, 20, { center: "x" }, makeRng(key));
    const b = composeDeck(pool(), weights, 20, { center: "x" }, makeRng(key));
    expect(a.map((c) => c.sequenceId)).toEqual(b.map((c) => c.sequenceId));
  });

  it("per-slot sub-streams are stable per index", () => {
    const key = `${recipe.seed}:${hashRecipe(recipe)}`;
    const slot3a = makeRng(childSeed(key, 3))();
    const slot3b = makeRng(childSeed(key, 3))();
    const slot4 = makeRng(childSeed(key, 4))();
    expect(slot3a).toEqual(slot3b);
    expect(slot3a).not.toEqual(slot4);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-reproducibility.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Full check gate**

Run: `npm run check > /tmp/check.log 2>&1` then `grep -niE "error" /tmp/check.log | grep -iE "choreo-card|seeded-rng|canonical-json|deck-recipe"`
Expected: no errors in the touched files. (Pre-existing unrelated errors elsewhere are not this plan's.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/services/__tests__/deck-reproducibility.test.ts
git commit -m "test(deck-gen): reproducibility + sub-stream stability acceptance tests" -- src/lib/features/choreo-card/services/__tests__/deck-reproducibility.test.ts
```

---

## Known Gaps (flag before relying on them)

1. **No bento-grid UI yet.** Tasks 1–10 deliver the seeded, recipe-driven *generation*. The prototype's bento Configure screen is a separate plan (the design's Phase 1). Until that lands, drive the new axes (`selectedLoopTypes`, `selectedLevels`, `selectedStartPositionIds`, Reroll) from temporary controls on the existing Configure step so the behavior is testable. The recipe is the stable contract the UI binds to.

2. **Pool coverage limits the honorable axes.** Loop type / level / period only work for `(loopType, level, slice, stepCount)` combinations already enumerated into Firestore (`scripts/enumerate-deck.cjs`). A selected combo with no catalog yields an empty bucket — surface this as guidance ("no inverted LOOPs enumerated at level 2 — run the enumerator"), never a silent 0. A `validateRecipeCoverage(recipe, catalogs)` helper (cheap, pure) is the natural follow-up.

3. **Live generation + Props/Hands/Dashes constraints are deferred.** The live `SequenceBuilder` is unseeded (Math.random for rotation direction, start position, bridge letters — `BeamSearch.ts`, `SequenceBuilder.ts:971`, `generate-actions.svelte.ts`). Honoring Props/Hands/Dashes (Smooth/Mixed/Choppy `constraintPreset`) and generating combos the pool lacks both require seeding the engine — a separate, larger plan. Until then those prototype tiles map onto the deck reversal/turn-variation system where they overlap (specified in the UI-port plan).

4. **`swapCard` single-card replacement** keeps `Math.random` default until its call site threads the deck's seeded stream (noted in Task 5 Step 3). Low priority — it's a manual single-card swap, not the bulk draw.

---

## Self-Review

- **Spec coverage** — "follows exact parameters": catalog/pool filters (Tasks 6–7) + recipe axes (Task 3, 8). "Fresh 52 each time": seeded reroll (Task 8 `reroll`, Task 9 `handleRedraw`). "Reproducible": same-seed identical draw (Tasks 5, 10). Dedup preserved: existing `hashDeckContent` ledger unchanged, still consulted in `bounceIfDuplicate` (no task needed — it keys on card content, independent of how cards were drawn). ✓
- **Placeholder scan** — every code step shows full code; no TBD/"add validation"/"similar to". ✓
- **Type consistency** — `rng: () => number` used uniformly; `makeRng(seed: string)` returns `() => number`; recipe key string `\`${seed}:${hashRecipe(recipe)}\`` identical in Tasks 9 and 10; `selectedLoopTypes: Set<string>` / `loopTypes: string[]` consistent between state and recipe. ✓
- **Determinism audit honored** — the four `Math.random` sites the explorer flagged in `deck-composer.ts` (227, 235, 210, and the sample call) are all parameterized; `rollVariation`/`applyVariation` already take `Rng` and are fed the sub-stream. ✓

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks. Tasks 1–7 + 10 are pure TDD (ideal for this). Tasks 8–9 touch Svelte state/components (review by hand + browser verify).
2. **Inline Execution** — execute in-session with checkpoints after each commit.

Companion plan to write next (the UI half of "hook this up"): **bento-grid Configure port** — swap the existing three-column Configure controls for the prototype's bento card grid, binding every tile to the recipe axes this plan added. The prototype at `src/routes/test/unified-generation/+page.svelte` is the approved design reference.
