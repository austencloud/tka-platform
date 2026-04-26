# Sequence Engine Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse three parallel LOOP executor implementations and two parallel sequence-step type systems into one canonical engine at `@tka/sequence-engine`, backed by unified `Step`/`Motion` types in `@tka/tka-types`, and publish three reference packages to npm as `0.1.0`.

**Architecture:** Single source of truth per concern: `@tka/tka-types` owns the shape of a step/motion; `@tka/sequence-engine` owns LOOP algebra, constraints, orientation propagation, reversal derivation; `@tka/domain` owns TKA knowledge; `@tka/render-core` owns rendering calculations. The app, local MCP, published MCP, and broadcast Cloud Function all consume from these via workspace links (internal) or npm (external). Each phase is independently revertible and gated by a parity harness diff over 200+ sequences.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, esbuild (for MCP bundling), Firestore (for migration), SvelteKit (app consumer).

**Spec:** `docs/superpowers/specs/2026-04-20-sequence-engine-unification-design.md`

---

## Open Items Requiring Austen's Decision Before Implementation

The spec (Section 13) flagged these as open. Plan tasks that depend on them call out `BLOCKED ON <item>` so they do not run prematurely.

1. **Exact esbuild config for `mcp-server-pkg`** — Phase 4.B. A proposed config is in Task 4.B.2 with specific flags; Austen must confirm or amend before the Phase 4 build step runs.
2. **Firestore migration script structure** — Phase 6. A proposed structure (dry-run flag, batched writes of 500, progress logging, explicit rollback snapshot) is in Task 6.2; Austen must confirm the backup location (suggested: `gs://tka-backups/pre-reversal-drop/`) and the batch size.
3. **Corpus selection methodology** — Phase 0. Proposed: (a) every sequence in every production deck, (b) every sequence written to Firestore in the last 30 days by `created_at`, (c) 50 manually-authored edge cases enumerated in Task 0.1. Austen must confirm before corpus capture runs.
4. **README/CHANGELOG content sign-off** — Phase 7. Drafts produced in Tasks 7.1–7.3 require Austen's editorial pass before `npm publish`.
5. **`@tka/domain` and `@tka/render-core` package scope** — Spec names them as Day 1 publishes but does not enumerate what APIs each exposes. The plan includes a Phase 7 scoping task that must happen *before* publish, not during.
6. **Ambiguity: app-side extension flow entry point** — the spec says "Rewire `SequenceExtender.extendSequence`" (Phase 3). A `SequenceExtender.ts` exists inside the engine at `packages/sequence-engine/src/loop/extension/SequenceExtender.ts` but not in the app tree. The app's extend flow enters via `LOOPExecutorSelector` + per-type executors under `src/lib/features/create/generate/circular/services/implementations/`. Task 3.1 verifies the actual app-side entry point before deletion; Austen must confirm the rewire target.

---

## File Structure

### Files created

- `packages/tka-types/package.json` — package manifest.
- `packages/tka-types/tsconfig.json` — TypeScript config (inherits from root).
- `packages/tka-types/src/index.ts` — barrel export.
- `packages/tka-types/src/step.ts` — `Step` interface + builders.
- `packages/tka-types/src/motion.ts` — `Motion` interface + builders.
- `packages/tka-types/src/enums/letter.ts` — `Letter` enum.
- `packages/tka-types/src/enums/grid.ts` — `GridLocation`, `GridPosition`, `GridMode` enums.
- `packages/tka-types/src/enums/plane.ts` — `Plane` enum.
- `packages/tka-types/src/enums/orientation.ts` — `Orientation` enum.
- `packages/tka-types/src/enums/motion-type.ts` — `MotionType` enum.
- `packages/tka-types/src/enums/prop-color.ts` — `PropColor` enum.
- `packages/tka-types/src/enums/rotation-direction.ts` — `RotationDirection` enum.
- `packages/tka-types/tests/step.test.ts` — builder semantics + type shape tests.
- `packages/tka-types/tests/motion.test.ts` — motion builder tests.
- `packages/sequence-engine/src/analysis/deriveReversals.ts` — pure reversal derivation.
- `packages/sequence-engine/tests/analysis/deriveReversals.test.ts` — derivation unit tests.
- `packages/sequence-engine/harness/parity-corpus/` — captured sequence JSON corpus (200+ files).
- `packages/sequence-engine/harness/parity-runner.ts` — parity harness executor.
- `packages/sequence-engine/harness/parity-diff.ts` — bit-exact JSON diff with step-level pinpointing.
- `packages/sequence-engine/harness/capture-corpus.ts` — one-shot corpus capture script.
- `packages/sequence-engine/harness/__fixtures__/edge-cases.json` — manually-authored edge sequences.
- `src/lib/features/create/shared/state/selection-store.svelte.ts` — UI selection store (Svelte 5 runes).
- `src/lib/features/create/shared/state/selection-store.test.ts` — selection store unit tests.
- `scripts/reversal-derivation-audit.ts` — queries all prod sequences, compares derived vs stored reversals.
- `scripts/drop-reversal-fields.ts` — Phase 6 Firestore migration.
- `mcp-server-pkg/esbuild.config.mjs` — bundle config.
- `packages/sequence-engine/README.md`, `CHANGELOG.md` — publish scaffolding.
- `packages/domain/README.md`, `CHANGELOG.md` — publish scaffolding.
- `packages/render-core/README.md`, `CHANGELOG.md` — publish scaffolding.

### Files modified

- `packages/sequence-engine/src/core/types/sequence-engine-types.ts` — `SequenceStep`/`MotionData` removed; re-exports from `@tka/tka-types` during transition; deleted in Phase 7.
- `packages/sequence-engine/src/index.ts` — export unified types.
- `packages/sequence-engine/package.json` — add `@tka/tka-types` dep.
- All files in `packages/sequence-engine/src/**/*.ts` that import `SequenceStep` or `MotionData` — mechanical migration to `Step`/`Motion`.
- `src/lib/features/create/shared/domain/models/StepData.ts` — deleted (Phase 2).
- `src/lib/shared/pictograph/shared/domain/models/MotionData.ts` — deleted (Phase 2).
- All files in `src/lib/**` that import `StepData` or `MotionData` — migrated to `Step`/`Motion`.
- All files in `src/lib/**` that read `blueReversal`/`redReversal`/`isSelected`/`isStep` on a step — rewritten to use `deriveReversals` and `selectionStore`.
- `mcp-server/src/**` — delete vendored `loop-executor.js`; import from `@tka/sequence-engine/loop`.
- `mcp-server-pkg/src/**` — delete `vendor/sequence-engine/`; import from workspace; add esbuild step.
- `mcp-server-pkg/package.json` — add `@tka/sequence-engine` + `@tka/tka-types` as workspace deps; add esbuild dev dep; update `build` script.
- `deployment/functions/src/broadcast/loop-executor.ts` — deleted.
- `deployment/functions/src/broadcast/**` — imports from engine.
- `package.json` (root) — `build:packages` script includes `@tka/tka-types` tsc step ordered before `sequence-engine`.

### Files deleted (by phase)

- **Phase 3:** `src/lib/features/create/generate/circular/services/implementations/Strict{Mirrored,Flipped,Swapped,Inverted,Rotated}LOOPExecutor.ts` (5 files) plus any combinatorial `Strict*LOOPExecutor` derivatives (`MirroredInverted`, `MirroredRotated`, `MirroredRotatedInverted`, `MirroredRotatedInvertedSwapped`, `MirroredSwapped`, `MirroredSwappedInverted`, `RewoundLOOPExecutor`, `RotatedInverted`, `RotatedSwapped`, `SwappedComplementary`, `SwappedInverted`, `MirroredRotatedComplementary`, `MirroredRotatedComplementarySwapped`) as confirmed by Task 3.1 discovery.
- **Phase 4.A:** `mcp-server/src/**/loop-executor.js` and any vendored engine copy in `mcp-server/`.
- **Phase 4.B:** `mcp-server-pkg/vendor/sequence-engine/` (entire directory).
- **Phase 5:** `deployment/functions/src/broadcast/loop-executor.ts`.
- **Phase 7:** `packages/sequence-engine/src/core/types/sequence-engine-types.ts` (shim removed; consumers import from `@tka/tka-types` directly).

---

## Phase 0 — Foundation Types + Parity Harness

**Goal:** Ship the unified type package and the parity harness. Nothing consumer-facing changes. Corpus is captured and pinned so every later phase can diff against it.

**Risks:** Corpus gaps cause false-negative parity (regression slips through). Mitigated by corpus methodology in Task 0.1 covering decks + 30-day prod writes + manual edge cases.

**Rollback:** Delete `packages/tka-types/src/**` and `packages/sequence-engine/harness/**`. No consumer imports yet; zero downstream impact.

---

### Task 0.1: Confirm corpus selection methodology

**Files:**
- Read: `docs/superpowers/specs/2026-04-20-sequence-engine-unification-design.md`
- Create: `packages/sequence-engine/harness/CORPUS.md` (methodology doc)

- [ ] **Step 1: Write the methodology document**

Write `packages/sequence-engine/harness/CORPUS.md` with exact selection rules:

```markdown
# Parity Corpus Selection

## Sources (deterministic)

1. **All deck sequences.** Enumerate every sequence in every LOOP deck
   registered in Firestore `decks/` collection. Capture each as-of the
   commit hash pinned in `CORPUS_COMMIT.txt`.
2. **30-day prod writes.** Query Firestore `sequences` collection where
   `createdAt >= (capture_date - 30 days)`. Cap at 500 sequences; if
   more, take the 500 most recent.
3. **Manual edge cases (50).** Enumerated in `__fixtures__/edge-cases.json`:
   - Period-2 LOOPs: one per strict type (MIRRORED, FLIPPED, SWAPPED,
     INVERTED, ROTATED, REWOUND) = 6.
   - Period-4 LOOPs: one per strict type = 6.
   - Quartered variants: MIRRORED×ROTATED, FLIPPED×ROTATED, etc. = 12.
   - High-turn sequences (turns >= 3 per hand): 5.
   - Float motion-type sequences: 5.
   - Bridge-inserted sequences: 5.
   - Mixed-plane sequences (wall/wheel/overhead on same step): 3.
   - Blank-step sequences (isBlank: true at various positions): 3.
   - Empty sequence + single-step sequences: 2.
   - Known-buggy quartered MIRRORED regression case: 1.
   - Explicitly ambiguous reversal chain (mid-sequence direction flip): 2.

## Freshness

Corpus is captured once at Phase 0 and PINNED by commit hash. The same
corpus runs before AND after every phase. It is NEVER regenerated
between phases — that would mask regressions.

## Output format

Each sequence serializes to `parity-corpus/<id>.json` using
`canonicalStringify` (sorted keys, deterministic whitespace). Input
word + options are captured in `parity-corpus/<id>.meta.json` so the
harness can rebuild each sequence and diff against the captured output.
```

- [ ] **Step 2: Pause for Austen's sign-off**

Report: *"Corpus methodology written to `packages/sequence-engine/harness/CORPUS.md`. Awaiting your confirmation before capture runs."*

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/harness/CORPUS.md
git commit -m "docs(harness): corpus selection methodology for parity checks"
```

---

### Task 0.2: Scaffold `@tka/tka-types` package

**Files:**
- Create: `packages/tka-types/package.json`
- Create: `packages/tka-types/tsconfig.json`
- Create: `packages/tka-types/src/index.ts` (empty barrel)
- Modify: `package.json` (root) — add `packages/tka-types` to pnpm workspace; wire into `build:packages` script BEFORE `sequence-engine`.

- [ ] **Step 1: Write `packages/tka-types/package.json`**

```json
{
  "name": "@tka/tka-types",
  "version": "0.1.0",
  "description": "Canonical TKA sequence types — Step, Motion, and enums shared across engine, domain, app, and MCP.",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist",
    "test": "vitest run",
    "prepublishOnly": "npm run clean && npm run build"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "rimraf": "^5.0.0"
  },
  "author": "austencloud",
  "license": "MIT"
}
```

- [ ] **Step 2: Write `packages/tka-types/tsconfig.json`**

Mirror `packages/sequence-engine/tsconfig.json` settings: `target: ES2022`, `module: ES2022`, `moduleResolution: Bundler`, `strict: true`, `declaration: true`, `outDir: ./dist`, `rootDir: ./src`, `include: ["src/**/*"]`.

- [ ] **Step 3: Write empty barrel `packages/tka-types/src/index.ts`**

```ts
// Populated in Task 0.3 onward.
export {};
```

- [ ] **Step 4: Add to root workspace**

Edit `package.json` `build:packages` script. `tsc --project packages/tka-types/tsconfig.json` must run **first** (before `flow-arts-core`).

- [ ] **Step 5: Verify package resolves**

```bash
pnpm install
pnpm run build:packages
```

Expected: `@tka/tka-types` compiles with zero errors.

- [ ] **Step 6: Commit**

```bash
git add packages/tka-types/ package.json pnpm-lock.yaml
git commit -m "feat(tka-types): scaffold package with empty barrel export"
```

---

### Task 0.3: Write enum modules (TDD)

**Files:**
- Create: `packages/tka-types/src/enums/letter.ts`
- Create: `packages/tka-types/src/enums/grid.ts`
- Create: `packages/tka-types/src/enums/plane.ts`
- Create: `packages/tka-types/src/enums/orientation.ts`
- Create: `packages/tka-types/src/enums/motion-type.ts`
- Create: `packages/tka-types/src/enums/prop-color.ts`
- Create: `packages/tka-types/src/enums/rotation-direction.ts`
- Create: `packages/tka-types/tests/enums.test.ts`

- [ ] **Step 1: Write failing test `packages/tka-types/tests/enums.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  MotionType, RotationDirection, Orientation,
  GridLocation, GridMode, Plane, PropColor
} from "../src";

describe("MotionType enum", () => {
  it("includes all six motion types", () => {
    const values = Object.values(MotionType);
    expect(values).toEqual(
      expect.arrayContaining(["shift", "dash", "static", "pro", "anti", "float"])
    );
    expect(values.length).toBe(6);
  });
});

describe("RotationDirection enum", () => {
  it("is cw | ccw | noRotation", () => {
    expect(Object.values(RotationDirection).sort())
      .toEqual(["ccw", "cw", "noRotation"]);
  });
});

describe("Orientation enum", () => {
  it("includes radial, non-radial, interradial, centric values", () => {
    const v = Object.values(Orientation);
    expect(v).toEqual(expect.arrayContaining(["in", "out", "clock", "counter"]));
    expect(v).toEqual(expect.arrayContaining(["clockIn", "clockOut", "counterIn", "counterOut"]));
    expect(v).toEqual(expect.arrayContaining(["centerN", "centerNE", "centerE", "centerSE", "centerS", "centerSW", "centerW", "centerNW"]));
  });
});

describe("GridLocation enum", () => {
  it("includes cardinal, intercardinal, center", () => {
    expect(Object.values(GridLocation).sort())
      .toEqual(["c", "e", "n", "ne", "nw", "s", "se", "sw", "w"]);
  });
});

describe("GridMode enum", () => {
  it("is diamond | box", () => {
    expect(Object.values(GridMode).sort()).toEqual(["box", "diamond"]);
  });
});

describe("Plane enum", () => {
  it("is wall | wheel | overhead", () => {
    expect(Object.values(Plane).sort()).toEqual(["overhead", "wall", "wheel"]);
  });
});

describe("PropColor enum", () => {
  it("is blue | red", () => {
    expect(Object.values(PropColor).sort()).toEqual(["blue", "red"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/tka-types && pnpm test
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement enum modules**

Write each enum module as a TypeScript `const` object with `as const` assertion + exported type union. Example (`motion-type.ts`):

```ts
export const MotionType = {
  shift: "shift",
  dash: "dash",
  static: "static",
  pro: "pro",
  anti: "anti",
  float: "float",
} as const;

export type MotionType = typeof MotionType[keyof typeof MotionType];
```

Repeat pattern for every enum. Values copied verbatim from `packages/sequence-engine/src/core/types/sequence-engine-types.ts` (`MotionType`, `RotationDirection`, `Orientation`, `GridLocation`) and from the design spec (`Plane`, `PropColor`, `GridMode`).

For `Letter`: enumerate from `packages/domain/src/letters/types.ts` if it exists; otherwise from MCP `get_alphabet_info` output. Task 0.3a (below) captures the authoritative list.

For `GridPosition`: `alpha1..alpha8 | beta1..beta8 | gamma1..gamma16` (confirm exhaustive list via MCP `list_available_letters` position enumeration; capture in Task 0.3a).

Update `packages/tka-types/src/index.ts` to re-export every enum module.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/tka-types && pnpm test
```

Expected: all enum tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tka-types/src/enums/ packages/tka-types/tests/enums.test.ts packages/tka-types/src/index.ts
git commit -m "feat(tka-types): add enum modules for motion-type, rotation-direction, orientation, grid, plane, prop-color"
```

---

### Task 0.3a: Ground `Letter` and `GridPosition` enums in MCP

**Files:**
- Modify: `packages/tka-types/src/enums/letter.ts`
- Modify: `packages/tka-types/src/enums/grid.ts`
- Create: `packages/tka-types/src/enums/letter.source.md` (authority note)

- [ ] **Step 1: Call `mcp__claude_ai_Flow_Arts_Knowledge__list_available_letters`**

Capture the complete letter set. Expected to include: A–V (Type 1), W, X, Y, Z, Σ, Δ, Θ, Ω (Type 2), their `-` variants (Type 3), Φ, Ψ, Λ (Type 4), `-` variants (Type 5), α, β, γ (Type 6), plus any compound letters.

- [ ] **Step 2: Call `mcp__claude_ai_Flow_Arts_Knowledge__get_domain_topic` with "positions"**

Capture full `GridPosition` list (all alpha/beta/gamma variants).

- [ ] **Step 3: Populate `Letter` enum from MCP output**

Do not hallucinate the list. Use the exact set returned by the MCP calls. Store MCP response citation in `letter.source.md`.

- [ ] **Step 4: Populate `GridPosition` enum from MCP output**

Same rule.

- [ ] **Step 5: Add test coverage for Letter/GridPosition**

Extend `tests/enums.test.ts`:

```ts
import { Letter, GridPosition } from "../src";
import letterSource from "../src/enums/letter.source.md?raw";

describe("Letter enum", () => {
  it("matches MCP list_available_letters output (see letter.source.md)", () => {
    // Test count + spot-check specific letters captured in source.md
    expect(Object.keys(Letter).length).toBeGreaterThanOrEqual(40);
    expect(Object.values(Letter)).toContain("A");
    expect(Object.values(Letter)).toContain("Σ-");
    expect(Object.values(Letter)).toContain("α");
  });
});

describe("GridPosition enum", () => {
  it("includes alpha, beta, gamma variants", () => {
    const v = Object.values(GridPosition);
    expect(v).toContain("alpha1");
    expect(v).toContain("beta1");
    expect(v).toContain("gamma1");
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd packages/tka-types && pnpm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/tka-types/src/enums/letter.ts packages/tka-types/src/enums/grid.ts packages/tka-types/src/enums/letter.source.md packages/tka-types/tests/enums.test.ts
git commit -m "feat(tka-types): populate Letter + GridPosition enums from MCP authority"
```

---

### Task 0.4: Write `Motion` type + builders (TDD)

**Files:**
- Create: `packages/tka-types/src/motion.ts`
- Create: `packages/tka-types/tests/motion.test.ts`

- [ ] **Step 1: Write failing tests `packages/tka-types/tests/motion.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createMotion, updateMotion, type Motion } from "../src";

describe("createMotion", () => {
  it("builds a Motion with required fields", () => {
    const m = createMotion({
      motionType: "shift",
      startLocation: "n",
      endLocation: "e",
      rotationDirection: "cw",
      startOrientation: "in",
      endOrientation: "out",
      turns: 0,
      plane: "wall",
      color: "blue",
    });
    expect(m.motionType).toBe("shift");
    expect(m.color).toBe("blue");
  });

  it("freezes the returned object", () => {
    const m = createMotion({
      motionType: "static", startLocation: "n", endLocation: "n",
      rotationDirection: "noRotation", startOrientation: "in",
      endOrientation: "in", turns: 0, plane: "wall", color: "blue",
    });
    expect(Object.isFrozen(m)).toBe(true);
  });

  it("rejects invalid motionType at runtime", () => {
    expect(() => createMotion({
      motionType: "bogus" as any, startLocation: "n", endLocation: "n",
      rotationDirection: "noRotation", startOrientation: "in",
      endOrientation: "in", turns: 0, plane: "wall", color: "blue",
    })).toThrow(/motionType/);
  });
});

describe("updateMotion", () => {
  it("returns a new frozen Motion with changes applied", () => {
    const m = createMotion({ motionType: "shift", startLocation: "n", endLocation: "e", rotationDirection: "cw", startOrientation: "in", endOrientation: "out", turns: 0, plane: "wall", color: "blue" });
    const m2 = updateMotion(m, { turns: 1 });
    expect(m2.turns).toBe(1);
    expect(m2).not.toBe(m);
    expect(Object.isFrozen(m2)).toBe(true);
  });
});

describe("Motion type shape", () => {
  it("has readonly fields (compile-time assertion)", () => {
    const m: Motion = createMotion({ motionType: "shift", startLocation: "n", endLocation: "e", rotationDirection: "cw", startOrientation: "in", endOrientation: "out", turns: 0, plane: "wall", color: "blue" });
    // @ts-expect-error motionType is readonly
    m.motionType = "dash";
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/tka-types && pnpm test motion
```

Expected: FAIL — `createMotion` not exported.

- [ ] **Step 3: Implement `Motion` + builders**

```ts
// packages/tka-types/src/motion.ts
import { MotionType } from "./enums/motion-type.js";
import { RotationDirection } from "./enums/rotation-direction.js";
import { Orientation } from "./enums/orientation.js";
import { GridLocation } from "./enums/grid.js";
import { Plane } from "./enums/plane.js";
import { PropColor } from "./enums/prop-color.js";

export interface Motion {
  readonly motionType: MotionType;
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly rotationDirection: RotationDirection;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
  readonly turns: number | "fl";
  readonly plane: Plane;
  readonly color: PropColor;
  readonly prefloatMotionType?: MotionType;
  readonly prefloatRotationDirection?: RotationDirection;
}

function assertEnum<T>(value: unknown, enumObj: Record<string, T>, label: string): void {
  if (!Object.values(enumObj).includes(value as T)) {
    throw new TypeError(`Invalid ${label}: ${String(value)}`);
  }
}

export function createMotion(input: Motion): Motion {
  assertEnum(input.motionType, MotionType, "motionType");
  assertEnum(input.rotationDirection, RotationDirection, "rotationDirection");
  assertEnum(input.startOrientation, Orientation, "startOrientation");
  assertEnum(input.endOrientation, Orientation, "endOrientation");
  assertEnum(input.startLocation, GridLocation, "startLocation");
  assertEnum(input.endLocation, GridLocation, "endLocation");
  assertEnum(input.plane, Plane, "plane");
  assertEnum(input.color, PropColor, "color");
  return Object.freeze({ ...input });
}

export function updateMotion(base: Motion, changes: Partial<Motion>): Motion {
  return createMotion({ ...base, ...changes });
}
```

Add `export * from "./motion.js";` to `src/index.ts`.

- [ ] **Step 4: Run tests**

```bash
cd packages/tka-types && pnpm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tka-types/src/motion.ts packages/tka-types/src/index.ts packages/tka-types/tests/motion.test.ts
git commit -m "feat(tka-types): add Motion type with immutable builders + runtime enum validation"
```

---

### Task 0.5: Write `Step` type + builders (TDD)

**Files:**
- Create: `packages/tka-types/src/step.ts`
- Create: `packages/tka-types/tests/step.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createStep, createStartStep, updateStep, type Step, createMotion } from "../src";

const blueMotion = createMotion({
  motionType: "shift", startLocation: "n", endLocation: "e",
  rotationDirection: "cw", startOrientation: "in", endOrientation: "out",
  turns: 0, plane: "wall", color: "blue",
});
const redMotion = createMotion({
  motionType: "shift", startLocation: "s", endLocation: "w",
  rotationDirection: "cw", startOrientation: "in", endOrientation: "out",
  turns: 0, plane: "wall", color: "red",
});

describe("createStep", () => {
  it("builds a Step with required fields", () => {
    const s = createStep({
      id: "step-1", letter: "A", startPosition: "alpha1",
      endPosition: "alpha3", motions: { blue: blueMotion, red: redMotion },
      stepNumber: 1, duration: 1,
    });
    expect(s.stepNumber).toBe(1);
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.motions)).toBe(true);
  });

  it("requires stepNumber >= 0", () => {
    expect(() => createStep({
      id: "x", letter: "A", startPosition: "alpha1", endPosition: "alpha3",
      motions: { blue: blueMotion, red: redMotion },
      stepNumber: -1, duration: 1,
    })).toThrow(/stepNumber/);
  });
});

describe("createStartStep", () => {
  it("produces stepNumber 0 with null letter and static motions", () => {
    const s = createStartStep("alpha1");
    expect(s.stepNumber).toBe(0);
    expect(s.letter).toBeNull();
    expect(s.startPosition).toBe("alpha1");
    expect(s.endPosition).toBe("alpha1");
  });
});

describe("updateStep", () => {
  it("returns new frozen Step with changes applied", () => {
    const s = createStep({
      id: "step-1", letter: "A", startPosition: "alpha1",
      endPosition: "alpha3", motions: { blue: blueMotion, red: redMotion },
      stepNumber: 1, duration: 1,
    });
    const s2 = updateStep(s, { duration: 2 });
    expect(s2.duration).toBe(2);
    expect(s2).not.toBe(s);
    expect(Object.isFrozen(s2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — `createStep`, `createStartStep`, `updateStep` not exported.

- [ ] **Step 3: Implement `Step` + builders**

```ts
// packages/tka-types/src/step.ts
import type { Motion } from "./motion.js";
import { createMotion } from "./motion.js";
import { Letter } from "./enums/letter.js";
import { GridPosition, GridMode } from "./enums/grid.js";

export interface Step {
  readonly id: string;
  readonly letter: Letter | null;
  readonly startPosition: GridPosition | null;
  readonly endPosition: GridPosition | null;
  readonly motions: { readonly blue: Motion; readonly red: Motion };
  readonly gridMode?: GridMode;
  readonly stepNumber: number;
  readonly duration: number;
  readonly variation?: number;
  readonly isBridge?: boolean;
  readonly isBlank?: boolean;
}

export function createStep(input: Step): Step {
  if (!Number.isInteger(input.stepNumber) || input.stepNumber < 0) {
    throw new RangeError(`Step.stepNumber must be a non-negative integer, got ${input.stepNumber}`);
  }
  if (!Number.isFinite(input.duration) || input.duration <= 0) {
    throw new RangeError(`Step.duration must be a positive finite number, got ${input.duration}`);
  }
  if (!input.id || typeof input.id !== "string") {
    throw new TypeError(`Step.id must be a non-empty string`);
  }
  const motions = Object.freeze({ blue: input.motions.blue, red: input.motions.red });
  return Object.freeze({ ...input, motions });
}

export function createStartStep(pos: GridPosition, idSuffix: string = "start"): Step {
  const startMotion = (color: "blue" | "red"): Motion =>
    createMotion({
      motionType: "static",
      startLocation: "n",
      endLocation: "n",
      rotationDirection: "noRotation",
      startOrientation: "in",
      endOrientation: "in",
      turns: 0,
      plane: "wall",
      color,
    });
  return createStep({
    id: `step-0-${idSuffix}`,
    letter: null,
    startPosition: pos,
    endPosition: pos,
    motions: { blue: startMotion("blue"), red: startMotion("red") },
    stepNumber: 0,
    duration: 1,
  });
}

export function updateStep(base: Step, changes: Partial<Step>): Step {
  return createStep({ ...base, ...changes });
}
```

Add `export * from "./step.js";` to `src/index.ts`.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tka-types/src/step.ts packages/tka-types/src/index.ts packages/tka-types/tests/step.test.ts
git commit -m "feat(tka-types): add Step type with createStep/createStartStep/updateStep builders"
```

---

### Task 0.6: Build parity harness — capture script

**Files:**
- Create: `packages/sequence-engine/harness/capture-corpus.ts`
- Create: `packages/sequence-engine/harness/canonical-stringify.ts`
- Create: `packages/sequence-engine/harness/__fixtures__/edge-cases.json`

- [ ] **Step 1: Write `canonical-stringify.ts`**

```ts
// Deterministic JSON — sorted keys, arrays preserve order.
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(value, replacer, 2);
}
function replacer(_key: string, v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      sorted[k] = (v as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return v;
}
```

- [ ] **Step 2: Write `edge-cases.json`**

Populate with the 50 edge cases enumerated in `CORPUS.md` Task 0.1. Each entry has shape:

```json
{
  "id": "edge-quartered-mirrored-regression",
  "kind": "word",
  "word": "ABAB",
  "options": { "loopType": "MIRRORED", "sliceSize": "quarter", "constraintPreset": "smooth" },
  "description": "Known-buggy quartered MIRRORED that triggered this unification"
}
```

Each edge case must be fillable by running `generate_sequence` with the specified inputs. Do not author expected outputs — the harness captures whatever the current engine produces.

- [ ] **Step 3: Write `capture-corpus.ts`**

```ts
// Usage: tsx harness/capture-corpus.ts
// Reads edge-cases.json + queries Firestore + deck registry,
// runs each through SequenceBuilder, serializes output with
// canonicalStringify, writes to harness/parity-corpus/<id>.json
// AND <id>.meta.json.
//
// Writes CORPUS_COMMIT.txt with current git HEAD SHA.
```

Full implementation reads corpus sources per `CORPUS.md`. For each sequence: run through engine, write `{id}.json` (output) + `{id}.meta.json` (inputs). Writes `CORPUS_COMMIT.txt` with `git rev-parse HEAD`.

- [ ] **Step 4: Run capture**

```bash
cd packages/sequence-engine
pnpm tsx harness/capture-corpus.ts
```

Expected: `harness/parity-corpus/` contains >= 250 `.json` files (200 corpus + 50 edge); `CORPUS_COMMIT.txt` exists.

- [ ] **Step 5: Verify corpus size**

```bash
ls packages/sequence-engine/harness/parity-corpus/*.json | wc -l
```

Expected: count >= 250.

- [ ] **Step 6: Commit**

```bash
git add packages/sequence-engine/harness/
git commit -m "feat(harness): parity corpus capture + canonical serialization"
```

---

### Task 0.7: Build parity harness — runner + diff

**Files:**
- Create: `packages/sequence-engine/harness/parity-runner.ts`
- Create: `packages/sequence-engine/harness/parity-diff.ts`
- Create: `packages/sequence-engine/harness/parity.test.ts`

- [ ] **Step 1: Write `parity-diff.ts`**

```ts
// parity-diff.ts — bit-exact diff. When diff found, pinpoints sequence id
// AND step index where divergence occurred, printing both sides.
export interface Divergence {
  sequenceId: string;
  stepIndex: number | null; // null = outputs differ in length
  expected: unknown;
  actual: unknown;
}
export function diff(
  expected: Record<string, string>,
  actual: Record<string, string>
): Divergence[] { /* ... */ }
```

- [ ] **Step 2: Write `parity-runner.ts`**

```ts
// Usage: tsx harness/parity-runner.ts
// Reads parity-corpus/*.meta.json, re-runs each through engine,
// diffs output against stored {id}.json. Exits 0 if all match, 1 otherwise.
// Prints divergence report with sequence id + step index for each mismatch.
```

- [ ] **Step 3: Write `parity.test.ts` (vitest wrapper)**

```ts
import { describe, it, expect } from "vitest";
import { runParity } from "./parity-runner.js";

describe("parity harness", () => {
  it("produces bit-identical output for captured corpus", async () => {
    const divergences = await runParity();
    if (divergences.length > 0) {
      console.error("Divergences:", divergences.slice(0, 5));
    }
    expect(divergences).toEqual([]);
  }, 120_000);
});
```

- [ ] **Step 4: Run parity (baseline must pass)**

```bash
cd packages/sequence-engine && pnpm test parity
```

Expected: PASS — zero divergences at baseline (nothing has changed yet).

- [ ] **Step 5: Commit**

```bash
git add packages/sequence-engine/harness/parity-runner.ts packages/sequence-engine/harness/parity-diff.ts packages/sequence-engine/harness/parity.test.ts
git commit -m "feat(harness): parity runner with bit-exact diff and step-level pinpointing"
```

---

### Phase 0 — Verification

```bash
pnpm run build:packages
pnpm --filter @tka/tka-types test
pnpm --filter @tka/sequence-engine test parity
```

All three must exit 0. Corpus size >= 250.

### Phase 0 — Rollback

```bash
git revert HEAD~<N>..HEAD   # where N = commits added in phase
pnpm install
```

No consumers touched; revert is safe.

### Phase 0 — Definition of Done

- [ ] `@tka/tka-types` installed and built
- [ ] All enums grounded in MCP authority (Letter, GridPosition) or verbatim from existing engine (others)
- [ ] `Motion` + `Step` with immutable builders, runtime-validated
- [ ] 100% unit test coverage on builders (every throw path tested)
- [ ] Parity corpus >= 250 sequences captured and pinned by commit SHA
- [ ] `parity-runner` PASS at baseline
- [ ] Austen signed off on corpus methodology

---

## Phase 1 — Engine Migration

**Goal:** Replace `SequenceStep`/`MotionData` inside `packages/sequence-engine` with `Step`/`Motion` from `@tka/tka-types`. Mechanical swap. Parity harness output identical after migration.

**Risks:** Hidden field usages (e.g. `stepNumber` becoming required when it was optional) break call sites. Mitigated by compile-time errors + parity diff.

**Rollback:** `git revert` the phase commits. Engine types revert; no external consumer changed yet.

---

### Task 1.1: Add `@tka/tka-types` dep to sequence-engine

**Files:**
- Modify: `packages/sequence-engine/package.json`

- [ ] **Step 1: Add dep**

```json
"dependencies": {
  "@tka/tka-types": "workspace:*"
}
```

- [ ] **Step 2: Reinstall + build**

```bash
pnpm install
pnpm run build:packages
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/package.json pnpm-lock.yaml
git commit -m "chore(sequence-engine): depend on @tka/tka-types workspace"
```

---

### Task 1.2: Convert engine's `sequence-engine-types.ts` into a re-export shim

**Files:**
- Modify: `packages/sequence-engine/src/core/types/sequence-engine-types.ts`
- Modify: `packages/sequence-engine/src/index.ts`

- [ ] **Step 1: Rewrite `sequence-engine-types.ts` as shim**

Replace `SequenceStep` and `MotionData` definitions with re-exports:

```ts
// DEPRECATED shim. Will be deleted in Phase 7.
// All consumers should import from "@tka/tka-types" directly.
export type { Step as SequenceStep, Motion as MotionData } from "@tka/tka-types";
export * from "@tka/tka-types";

// Keep engine-only types (PositionGroup, LetterCategory, LetterPositionInfo,
// LetterMappingData, LetterMappingsJson, SequenceResult, OrientationInput,
// HandPath) here unchanged.
```

Note: field names differ between old `SequenceStep` (flat `blueMotion`/`redMotion`, `beatIndex`) and new `Step` (`motions: { blue, red }`, `stepNumber`). A re-export alone is insufficient. The shim must be a type alias that engine code can still consume — which means engine code itself needs migration in Task 1.3. This task only puts the shim in place so Task 1.3 can migrate file-by-file.

Intermediate approach: keep the **old** `SequenceStep` interface in place with a JSDoc `@deprecated` banner and export both old and new types. Engine files migrate over Task 1.3 incrementally; the old export is deleted at end of Phase 1 after all internal consumers moved.

Final shim form at end of Phase 1:

```ts
export type { Step, Motion } from "@tka/tka-types";
export * from "@tka/tka-types";
// Engine-specific remaining types:
export type PositionGroup = /* unchanged */;
// ... etc
```

- [ ] **Step 2: Run engine build**

```bash
pnpm run build:packages
```

Expected: PASS (shim compiles; no behavior change).

- [ ] **Step 3: Commit**

```bash
git add packages/sequence-engine/src/core/types/sequence-engine-types.ts packages/sequence-engine/src/index.ts
git commit -m "refactor(sequence-engine): re-export unified Step/Motion from @tka/tka-types (shim)"
```

---

### Task 1.3: Migrate engine source files from `SequenceStep`/`MotionData` to `Step`/`Motion`

**Files:**
- Modify: every `.ts` file under `packages/sequence-engine/src/` that references `SequenceStep` or `MotionData`.

**Complexity:** Mechanical, but field renames (`blueMotion` → `motions.blue`, `redMotion` → `motions.red`, `beatIndex` → `stepNumber`) require find-and-replace with verification, not blind sed.

- [ ] **Step 1: Enumerate affected files**

```bash
grep -rln "SequenceStep\|MotionData\|blueMotion\|redMotion\|beatIndex" packages/sequence-engine/src/ > /tmp/engine-migration-files.txt
wc -l /tmp/engine-migration-files.txt
```

Expected: ~40-80 files. Commit the list as `docs/superpowers/plans/tmp/engine-migration-files.txt` for audit trail.

- [ ] **Step 2: Migrate file-by-file, running parity after each batch of 10**

For each file:
1. Replace `SequenceStep` → `Step`.
2. Replace `MotionData` → `Motion`.
3. Replace `.blueMotion` → `.motions.blue` and `.redMotion` → `.motions.red`.
4. Replace `.beatIndex` → `.stepNumber`. Where `beatIndex` was optional and `stepNumber` was separately tracked, merge into the single `stepNumber` field.
5. Replace any `startOrientation?` / `endOrientation?` optional access with required access (remove `??` defaults). If a motion genuinely had no orientation before, default via `createMotion` at construction site, not at read site.
6. For any object literal building a `Step` or `Motion`, wrap with `createStep(...)` / `createMotion(...)` so immutability + validation applies.

After every 10 files:

```bash
pnpm --filter @tka/sequence-engine test
pnpm --filter @tka/sequence-engine test parity
```

Both must PASS. If parity diverges, the last batch is the cause — investigate, fix, re-run.

- [ ] **Step 3: Remove old `SequenceStep`/`MotionData` definitions**

Once `grep -rln "SequenceStep\b" packages/sequence-engine/src/ | grep -v "@deprecated"` returns empty, remove the deprecated aliases from `sequence-engine-types.ts`. Shim now re-exports only `Step`/`Motion`.

- [ ] **Step 4: Full engine test + parity**

```bash
pnpm --filter @tka/sequence-engine test
pnpm --filter @tka/sequence-engine test parity
```

Both PASS. Zero divergences.

- [ ] **Step 5: Commit (logical chunks of 10-15 files each)**

```bash
# Repeat per batch:
git add packages/sequence-engine/src/<batch>
git commit -m "refactor(sequence-engine): migrate <batch-name> to Step/Motion"
```

Final commit of this task:

```bash
git add packages/sequence-engine/src/core/types/sequence-engine-types.ts
git commit -m "refactor(sequence-engine): remove deprecated SequenceStep/MotionData aliases"
```

---

### Task 1.4: Introduce `deriveReversals` in engine

**Files:**
- Create: `packages/sequence-engine/src/analysis/deriveReversals.ts`
- Create: `packages/sequence-engine/tests/analysis/deriveReversals.test.ts`
- Modify: `packages/sequence-engine/src/analysis/index.ts` (add export)

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { deriveReversals } from "../../src/analysis/deriveReversals.js";
import { createStep, createStartStep, createMotion } from "@tka/tka-types";

const m = (color: "blue" | "red", rotationDirection: "cw" | "ccw" | "noRotation") =>
  createMotion({
    motionType: "shift", startLocation: "n", endLocation: "e",
    rotationDirection, startOrientation: "in", endOrientation: "out",
    turns: 0, plane: "wall", color,
  });

describe("deriveReversals", () => {
  it("returns empty array for empty input", () => {
    expect(deriveReversals([])).toEqual([]);
  });

  it("marks step 0 (start) as no reversal", () => {
    const start = createStartStep("alpha1");
    const r = deriveReversals([start]);
    expect(r).toEqual([{ blue: false, red: false }]);
  });

  it("detects blue reversal when rotation direction flips", () => {
    const start = createStartStep("alpha1");
    const step1 = createStep({
      id: "s1", letter: "A", startPosition: "alpha1", endPosition: "alpha3",
      motions: { blue: m("blue", "cw"), red: m("red", "cw") },
      stepNumber: 1, duration: 1,
    });
    const step2 = createStep({
      id: "s2", letter: "B", startPosition: "alpha3", endPosition: "alpha5",
      motions: { blue: m("blue", "ccw"), red: m("red", "cw") },
      stepNumber: 2, duration: 1,
    });
    const r = deriveReversals([start, step1, step2]);
    expect(r[2]).toEqual({ blue: true, red: false });
  });

  it("does not mark reversal across noRotation", () => {
    // Step N-1 rotation "noRotation" can't be reversed — the prior direction was absent.
    const start = createStartStep("alpha1");
    const step1 = createStep({
      id: "s1", letter: "A", startPosition: "alpha1", endPosition: "alpha1",
      motions: { blue: m("blue", "noRotation"), red: m("red", "noRotation") },
      stepNumber: 1, duration: 1,
    });
    const step2 = createStep({
      id: "s2", letter: "B", startPosition: "alpha1", endPosition: "alpha3",
      motions: { blue: m("blue", "cw"), red: m("red", "cw") },
      stepNumber: 2, duration: 1,
    });
    const r = deriveReversals([start, step1, step2]);
    expect(r[2]).toEqual({ blue: false, red: false });
  });

  it("breaks reversal chain across blank steps", () => {
    const start = createStartStep("alpha1");
    const s1 = createStep({
      id: "s1", letter: "A", startPosition: "alpha1", endPosition: "alpha3",
      motions: { blue: m("blue", "cw"), red: m("red", "cw") },
      stepNumber: 1, duration: 1,
    });
    const blank = createStep({
      id: "s2", letter: null, startPosition: "alpha3", endPosition: "alpha3",
      motions: { blue: m("blue", "noRotation"), red: m("red", "noRotation") },
      stepNumber: 2, duration: 1, isBlank: true,
    });
    const s3 = createStep({
      id: "s3", letter: "B", startPosition: "alpha3", endPosition: "alpha5",
      motions: { blue: m("blue", "ccw"), red: m("red", "cw") },
      stepNumber: 3, duration: 1,
    });
    const r = deriveReversals([start, s1, blank, s3]);
    expect(r[3]).toEqual({ blue: false, red: false });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — `deriveReversals` not exported.

- [ ] **Step 3: Implement**

```ts
// packages/sequence-engine/src/analysis/deriveReversals.ts
import type { Step } from "@tka/tka-types";

export interface StepReversals { readonly blue: boolean; readonly red: boolean; }

export function deriveReversals(steps: readonly Step[]): readonly StepReversals[] {
  const out: StepReversals[] = [];
  let priorBlueDir: string | null = null;
  let priorRedDir: string | null = null;
  for (const step of steps) {
    if (step.stepNumber === 0 || step.isBlank) {
      out.push({ blue: false, red: false });
      priorBlueDir = step.isBlank ? null : priorBlueDir;
      priorRedDir = step.isBlank ? null : priorRedDir;
      if (step.stepNumber === 0) {
        priorBlueDir = step.motions.blue.rotationDirection;
        priorRedDir = step.motions.red.rotationDirection;
      }
      continue;
    }
    const blueDir = step.motions.blue.rotationDirection;
    const redDir = step.motions.red.rotationDirection;
    const blueRev = priorBlueDir !== null
      && priorBlueDir !== "noRotation"
      && blueDir !== "noRotation"
      && blueDir !== priorBlueDir;
    const redRev = priorRedDir !== null
      && priorRedDir !== "noRotation"
      && redDir !== "noRotation"
      && redDir !== priorRedDir;
    out.push({ blue: blueRev, red: redRev });
    priorBlueDir = blueDir;
    priorRedDir = redDir;
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Export from engine barrel**

Add to `packages/sequence-engine/src/analysis/index.ts`:

```ts
export { deriveReversals, type StepReversals } from "./deriveReversals.js";
```

And add to `packages/sequence-engine/src/index.ts`:

```ts
export { deriveReversals, type StepReversals } from "./analysis/deriveReversals.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/sequence-engine/src/analysis/deriveReversals.ts packages/sequence-engine/src/analysis/index.ts packages/sequence-engine/src/index.ts packages/sequence-engine/tests/analysis/deriveReversals.test.ts
git commit -m "feat(sequence-engine): add deriveReversals pure function for UI + storage parity"
```

---

### Phase 1 — Verification

```bash
pnpm run build:packages
pnpm --filter @tka/sequence-engine test
pnpm --filter @tka/sequence-engine test parity
```

All PASS. Parity harness: zero divergences.

### Phase 1 — Rollback

```bash
git revert <first-phase-1-commit>..<last-phase-1-commit>
pnpm install
pnpm run build:packages
```

Because the app has not yet been migrated, reverting engine types is safe. Engine consumers continue to work as before.

### Phase 1 — Definition of Done

- [ ] Engine builds with zero errors
- [ ] All engine unit tests PASS
- [ ] Parity harness: zero divergences
- [ ] `grep -rln "SequenceStep\b\|MotionData\b\|\.blueMotion\|\.redMotion\|\.beatIndex" packages/sequence-engine/src/` returns empty
- [ ] `deriveReversals` exported from engine with full test coverage

---

## Phase 2 — App Migration

**Goal:** Replace `StepData`/app-side `MotionData` with unified types. Introduce `selectionStore`. Stop reading stored `blueReversal`/`redReversal`/`isSelected`/`isStep`; compute reversals via `deriveReversals`. Firestore writes stop emitting reversal fields.

**Risks:** High. 820+ files reference `StepData` or its fields. Selection store must integrate with every place selection is read/written. Reversal-dependent rendering must switch to derived values atomically per frame.

**Rollback:** Severe. Must be phase-committed, with rollback granularity per commit group. `git revert` individual subtasks as needed; test app boots after each revert.

---

### Task 2.1: Add `@tka/tka-types` dep to app

**Files:**
- Modify: `package.json` (root) — add `@tka/tka-types` to app `dependencies`.

- [ ] **Step 1: Add dep**

Edit `dependencies`: `"@tka/tka-types": "workspace:*"`.

- [ ] **Step 2: Install + build**

```bash
pnpm install
pnpm run check
```

Expected: PASS (no app code changed yet).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(app): depend on @tka/tka-types workspace"
```

---

### Task 2.2: Build `selectionStore` (TDD)

**Files:**
- Create: `src/lib/features/create/shared/state/selection-store.svelte.ts`
- Create: `src/lib/features/create/shared/state/selection-store.test.ts`

**Discovery precedes creation.** Before writing code, invoke the `state-management` skill and grep for existing selection patterns:

- [ ] **Step 1: Discovery**

```bash
grep -rln "isSelected\b" src/lib/ | head -30
grep -rln "createSelectionStore\|SelectionState" src/lib/ | head
```

Report findings. If an existing selection pattern matches, extend it. If not, proceed.

- [ ] **Step 2: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createSelectionStore } from "./selection-store.svelte.js";

describe("createSelectionStore", () => {
  it("starts empty", () => {
    const s = createSelectionStore();
    expect(s.isSelected("a")).toBe(false);
  });

  it("select(id) marks id as selected", () => {
    const s = createSelectionStore();
    s.select("a");
    expect(s.isSelected("a")).toBe(true);
  });

  it("select replaces prior selection by default", () => {
    const s = createSelectionStore();
    s.select("a");
    s.select("b");
    expect(s.isSelected("a")).toBe(false);
    expect(s.isSelected("b")).toBe(true);
  });

  it("select({ additive: true }) preserves prior", () => {
    const s = createSelectionStore();
    s.select("a");
    s.select("b", { additive: true });
    expect(s.isSelected("a")).toBe(true);
    expect(s.isSelected("b")).toBe(true);
  });

  it("deselect removes a specific id", () => {
    const s = createSelectionStore();
    s.select("a", { additive: true });
    s.select("b", { additive: true });
    s.deselect("a");
    expect(s.isSelected("a")).toBe(false);
    expect(s.isSelected("b")).toBe(true);
  });

  it("clear removes all", () => {
    const s = createSelectionStore();
    s.select("a", { additive: true });
    s.select("b", { additive: true });
    s.clear();
    expect(s.isSelected("a")).toBe(false);
    expect(s.isSelected("b")).toBe(false);
  });
});
```

- [ ] **Step 3: Implement with Svelte 5 runes**

```ts
// src/lib/features/create/shared/state/selection-store.svelte.ts
export interface SelectionStore {
  readonly selectedIds: ReadonlySet<string>;
  select(id: string, options?: { additive?: boolean }): void;
  deselect(id: string): void;
  clear(): void;
  isSelected(id: string): boolean;
}

export function createSelectionStore(): SelectionStore {
  const ids = $state(new Set<string>());
  return {
    get selectedIds() { return ids; },
    select(id, options) {
      if (!options?.additive) ids.clear();
      ids.add(id);
    },
    deselect(id) { ids.delete(id); },
    clear() { ids.clear(); },
    isSelected(id) { return ids.has(id); },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/features/create/shared/state/selection-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/state/selection-store.svelte.ts src/lib/features/create/shared/state/selection-store.test.ts
git commit -m "feat(create): scoped selection store keyed by step id"
```

---

### Task 2.3: Migrate `StepData` callers to `Step` (per-module batches)

**Files:**
- Modify: every file importing from `$lib/features/create/shared/domain/models/StepData` or using the `StepData` type.

**Discovery first.** Enumerate module boundaries and migrate module-by-module so each commit compiles.

- [ ] **Step 1: Enumerate affected modules**

```bash
grep -rln "StepData\b" src/lib/ | sort > /tmp/app-stepdata-files.txt
wc -l /tmp/app-stepdata-files.txt
```

Group by feature module (`create/construct`, `create/generate`, `sequence-viewer`, etc.). Commit list to `docs/superpowers/plans/tmp/app-stepdata-files.txt`.

- [ ] **Step 2: Migrate module-by-module**

For each module (one commit per module):

1. Replace `import type { StepData } from "$lib/features/create/shared/domain/models/StepData"` → `import type { Step } from "@tka/tka-types"`.
2. Rename local `StepData` references to `Step`.
3. Replace flat motion access (`step.blueMotionType`, `step.blueStartLocation`, etc.) with structured access (`step.motions.blue.motionType`, etc.). `StepData` extended `PictographData` which had flat motion fields; the new `Step` does not. This is a deeper refactor than a rename.
4. Remove reads of `step.blueReversal` / `step.redReversal` / `step.isSelected` / `step.isStep` — Task 2.4 replaces these.
5. Verify `pnpm run check` passes after each module.
6. Commit per module: `refactor(<module>): migrate StepData to @tka/tka-types Step`.

**Estimate:** 15–25 module-sized commits. Each module 10 min – 2 hr depending on depth.

- [ ] **Step 3: Delete `StepData.ts`**

Once `grep -rln "StepData\b" src/lib/` is empty (excluding the file itself):

```bash
rm src/lib/features/create/shared/domain/models/StepData.ts
pnpm run check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/features/create/shared/domain/models/
git commit -m "refactor(create): delete StepData — fully replaced by @tka/tka-types Step"
```

---

### Task 2.4: Migrate app-side `MotionData` to `Motion`

**Files:**
- Delete: `src/lib/shared/pictograph/shared/domain/models/MotionData.ts`
- Modify: all files importing `MotionData` from that path (discovered via grep).

- [ ] **Step 1: Enumerate**

```bash
grep -rln "from.*shared/pictograph/shared/domain/models/MotionData" src/lib/ > /tmp/app-motiondata-files.txt
```

- [ ] **Step 2: Migrate file-by-file**

Replace imports with `import type { Motion } from "@tka/tka-types"`. Rename `MotionData` to `Motion`. Update field access: `startOrientation` / `endOrientation` / `color` are now required (compile errors will surface optional-access sites; fix by ensuring construction includes them).

- [ ] **Step 3: Delete the old file**

```bash
rm src/lib/shared/pictograph/shared/domain/models/MotionData.ts
pnpm run check
```

Expected: PASS.

- [ ] **Step 4: Commit (batched per module)**

```bash
git commit -m "refactor(pictograph): migrate MotionData to @tka/tka-types Motion"
```

---

### Task 2.5: Replace reversal storage reads with `deriveReversals`

**Files:**
- Every file that read `step.blueReversal` / `step.redReversal`. Grep output from Task 2.3 lists candidates.

- [ ] **Step 1: Enumerate reversal-consuming sites**

```bash
grep -rln "blueReversal\|redReversal" src/lib/ > /tmp/app-reversal-sites.txt
```

- [ ] **Step 2: At each site, compute reversals once per sequence**

Pattern: find the component/service that renders or consumes a sequence. Near the top of that consumer, compute `const reversals = deriveReversals(steps);`. At the per-step consumption site, read `reversals[stepIndex].blue` / `.red`.

Do NOT call `deriveReversals` per-step; it's O(n) already, per-step calls would be O(n²).

- [ ] **Step 3: Stop writing `blueReversal`/`redReversal` to Firestore**

Locate sequence serializers under `src/lib/**/services/**`. Remove reversal field writes. (Read path already ignores them per spec's "transition-window behavior.")

- [ ] **Step 4: Run app check + relevant integration tests**

```bash
pnpm run check
pnpm test src/lib/features/create
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(create): derive reversals on read; stop writing stored fields"
```

---

### Task 2.6: Replace `isSelected` reads with `selectionStore`

**Files:**
- Every file that read `step.isSelected` or wrote it.

- [ ] **Step 1: Enumerate**

```bash
grep -rln "isSelected\b" src/lib/ | grep -v selection-store > /tmp/app-isselected-sites.txt
```

- [ ] **Step 2: Per site, wire to `selectionStore`**

For each consumer: receive the `selectionStore` via context or prop, read `selectionStore.isSelected(step.id)` instead of `step.isSelected`. Mutation sites call `selectionStore.select(step.id)` / `.deselect(step.id)` / `.clear()`.

Selection store lives at whichever scope matches "one sequence view." If a sequence appears in both preview and timeline, each panel gets its own store instance (spec requires this).

- [ ] **Step 3: Remove any remaining reads**

`grep -rln "\.isSelected\b" src/lib/` → should only surface the store itself.

- [ ] **Step 4: Run check + tests**

```bash
pnpm run check
pnpm test src/lib/features/create
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(create): replace step.isSelected with per-panel selectionStore"
```

---

### Task 2.7: Remove `isStep` type discriminator

**Files:**
- Every file narrowing on `isStep`.

- [ ] **Step 1: Enumerate**

```bash
grep -rln "\.isStep\b\|\"isStep\"" src/lib/ > /tmp/app-isstep-sites.txt
```

- [ ] **Step 2: Replace narrowing with positive checks**

If code was `if ("isStep" in x)` to narrow `StartPositionData | StepData`, replace with `if (x.stepNumber > 0)` or explicit discriminant already on the unified types. Sequence layer should already track which array entries are start vs steps by position (`stepNumber === 0`).

- [ ] **Step 3: Remove writes of `isStep: true`**

- [ ] **Step 4: Check**

```bash
pnpm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(create): drop unused isStep discriminator"
```

---

### Task 2.8: App parity + smoke tests

- [ ] **Step 1: Re-run engine parity harness**

```bash
pnpm --filter @tka/sequence-engine test parity
```

Expected: zero divergences.

- [ ] **Step 2: Run full app check**

```bash
pnpm run check
```

Expected: zero errors.

- [ ] **Step 3: Run app vitest suite**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Build**

```bash
pnpm run build
```

Expected: PASS.

- [ ] **Step 5: Smoke manual verification**

Austen manually verifies in browser (port 5173 dev server): open a sequence, confirm reversals display correctly, confirm selection works in preview + timeline with independent state, confirm quartered MIRRORED LOOP extension produces full-length output (the original regression).

**This is a MUST-VERIFY step.** Do not claim Phase 2 done without Austen's sign-off. Per CLAUDE.md: "I cannot verify this visually. Please check <X> and tell me what you see."

### Phase 2 — Verification

Engine parity clean. App check + tests + build PASS. Austen confirms manual smoke test.

### Phase 2 — Rollback

Revert commits per module group in reverse order. App rebuild + re-check after each revert. If Firestore writes stopped mid-phase, docs written during that window lack reversal fields — acceptable because Phase 6 removes them anyway, but note the affected doc ids for audit.

### Phase 2 — Definition of Done

- [ ] `StepData.ts` deleted; zero `StepData` imports in `src/lib/`
- [ ] `MotionData.ts` (app copy) deleted; zero imports in `src/lib/`
- [ ] `blueReversal`/`redReversal` no longer read from stored data; derivation is sole source
- [ ] Firestore serializers no longer write reversal fields
- [ ] `isSelected` moved to `selectionStore`; independent scopes per view
- [ ] `isStep` discriminator deleted
- [ ] Engine parity: zero divergences
- [ ] `pnpm run check`, `pnpm test`, `pnpm run build` all PASS
- [ ] Austen signed off on manual smoke (quartered MIRRORED regression confirmed fixed)

---

## Phase 3 — LOOP Executor Consolidation

**Goal:** Delete all app-side LOOP executors; rewire app to call engine's `executeLOOP` directly. Extend flow and fresh-generation flow share one execution path.

**Risks:** App-side `LOOPExecutorSelector` may behave differently from engine's under edge cases. Parity harness catches only engine-path differences, not the app-side extend path. Mitigation: a **dual-run shadow test** during this phase (Task 3.2) — call both app-side selector + engine selector on same input, assert outputs match.

**Rollback:** Reinstate deleted app-side executors via `git revert`. The deletion commit groups files so revert is atomic.

---

### Task 3.1: Identify app-side extend flow entry point (BLOCKED ON ITEM 6)

**Files:**
- Read: `src/lib/features/create/generate/circular/services/implementations/LOOPExecutorSelector.ts`
- Read: the call site(s) that invoke this selector.

- [ ] **Step 1: Trace entry**

```bash
grep -rln "LOOPExecutorSelector\|loopExecutorSelector" src/lib/ | head
```

Find the service that orchestrates extension. This is likely a `CircularSequenceGenerator` or similar. Read it.

- [ ] **Step 2: Document current flow**

In `docs/superpowers/plans/tmp/phase-3-flow-map.md`, document:
- Entry function signature
- How it selects a LOOP executor
- How it assembles the final extended sequence
- What differs from engine's `SequenceExtender.extendSequence` (if anything)

- [ ] **Step 3: Report and confirm with Austen**

Report: *"App-side extend flow enters at `<path>:<function>`. Engine's equivalent is `SequenceExtender.extendSequence` at `packages/sequence-engine/src/loop/extension/SequenceExtender.ts`. Differences: <list>. Proposed rewire target: <choice>. Confirm?"*

Do not proceed to Task 3.2 until Austen confirms.

- [ ] **Step 4: Commit flow map (documentation only)**

```bash
git add docs/superpowers/plans/tmp/phase-3-flow-map.md
git commit -m "docs(plan): map app-side extend flow for Phase 3 rewire"
```

---

### Task 3.2: Add shadow-test for executor parity

**Files:**
- Create: `src/lib/features/create/generate/circular/services/implementations/__tests__/executor-parity.test.ts`

- [ ] **Step 1: Write shadow test**

For each LOOP type (MIRRORED, FLIPPED, SWAPPED, INVERTED, ROTATED, REWOUND) × each slice (half, quarter), run identical input through app-side selector AND engine selector. Assert outputs match via canonical stringify.

```ts
import { describe, it, expect } from "vitest";
import { loopExecutorSelector as appSelector } from "../LOOPExecutorSelector.js";
import { loopExecutorSelector as engineSelector } from "@tka/sequence-engine/loop";
import { canonicalStringify } from "@tka/sequence-engine/harness";
import fixtures from "./fixtures/executor-parity-inputs.json";

describe("LOOP executor parity (app vs engine)", () => {
  for (const input of fixtures) {
    it(`matches for ${input.loopType} ${input.sliceSize}`, () => {
      const appOut = appSelector.execute(input.seed, input.loopType, input.sliceSize);
      const engineOut = engineSelector.execute(input.seed, input.loopType, input.sliceSize);
      expect(canonicalStringify(appOut)).toBe(canonicalStringify(engineOut));
    });
  }
});
```

Fixtures list: all 10 LOOP type variants × 2 slice sizes × 3 seeds = 60 cases minimum.

- [ ] **Step 2: Run shadow tests**

```bash
pnpm test executor-parity
```

Expected: PASS if executors already agree; FAIL with specific input if they drift. Any FAIL is an existing bug uncovered — investigate, fix, confirm with Austen, then proceed.

- [ ] **Step 3: Commit shadow test**

```bash
git add src/lib/features/create/generate/circular/services/implementations/__tests__/
git commit -m "test(create): shadow parity test between app-side and engine LOOP executors"
```

---

### Task 3.3: Rewire app extend flow to engine

**Files:**
- Modify: app-side extend-flow entry point (discovered in Task 3.1)

- [ ] **Step 1: Replace app-side selector import with engine selector**

Rewrite the entry function body. Instead of calling app-side `loopExecutorSelector`, call `engineLOOPExecutorSelector` (or `SequenceExtender.extendSequence` if that's the confirmed target). Input transformation may be needed if the app passes flat `PictographData` and engine expects `Step`.

- [ ] **Step 2: Keep app-side selector and executors in place temporarily**

Do NOT delete app-side executors in this task. Shadow test still imports both. Deletion happens in Task 3.4.

- [ ] **Step 3: Run app check + tests + parity + shadow**

```bash
pnpm run check
pnpm test
pnpm --filter @tka/sequence-engine test parity
```

All PASS.

- [ ] **Step 4: Manual smoke test**

Austen confirms: extend flow produces the same result as before (and specifically, quartered MIRRORED still works end-to-end).

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(create): route extend flow through engine LOOP executor"
```

---

### Task 3.4: Delete app-side LOOP executors

**Files:**
- Delete: every `Strict*LOOPExecutor.ts` and combinatorial `*LOOPExecutor.ts` under `src/lib/features/create/generate/circular/services/implementations/`.
- Delete: `src/lib/features/create/generate/circular/services/implementations/LOOPExecutorSelector.ts`
- Delete: `src/lib/features/create/generate/circular/services/implementations/__tests__/executor-parity.test.ts` (shadow test obsolete once one side deleted)

- [ ] **Step 1: Verify no remaining imports of app-side executors**

```bash
grep -rln "Strict.*LOOPExecutor\|LOOPExecutorSelector" src/lib/features/create/generate/circular/ | grep -v "from.*@tka/sequence-engine"
```

Expected: empty (except possibly type-only re-exports — clean those too).

- [ ] **Step 2: Delete files**

```bash
rm src/lib/features/create/generate/circular/services/implementations/Strict*LOOPExecutor.ts
rm src/lib/features/create/generate/circular/services/implementations/Mirrored*LOOPExecutor.ts
rm src/lib/features/create/generate/circular/services/implementations/Rotated*LOOPExecutor.ts
rm src/lib/features/create/generate/circular/services/implementations/Swapped*LOOPExecutor.ts
rm src/lib/features/create/generate/circular/services/implementations/Rewound*LOOPExecutor.ts
rm src/lib/features/create/generate/circular/services/implementations/LOOPExecutorSelector.ts
rm src/lib/features/create/generate/circular/services/implementations/__tests__/executor-parity.test.ts
```

- [ ] **Step 3: Run check + tests + build**

```bash
pnpm run check
pnpm test
pnpm run build
```

All PASS.

- [ ] **Step 4: Manual smoke**

Austen confirms extend + generate flows both still work.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/features/create/generate/circular/services/implementations/
git commit -m "refactor(create): delete app-side LOOP executors — engine is canonical"
```

### Phase 3 — Verification

Engine parity: zero divergences. Shadow test passed during transition. App check + tests + build PASS. Austen-confirmed smoke.

### Phase 3 — Rollback

```bash
git revert <phase-3-commits>
pnpm run check
```

App-side executors restored. Shadow test ensures no regression because pre-deletion state was verified identical.

### Phase 3 — Definition of Done

- [ ] Zero `Strict*LOOPExecutor.ts` or combinatorial `*LOOPExecutor.ts` files under `src/lib/features/create/generate/circular/services/implementations/`
- [ ] App extend flow delegates to engine
- [ ] Shadow test passed before deletion (evidence captured)
- [ ] Engine parity clean
- [ ] Austen-confirmed end-to-end smoke

---

## Phase 4 — MCP Consolidation

**Goal:** Delete vendored engine copies in `mcp-server/` (local dev) and `mcp-server-pkg/` (published). Local dev uses workspace link; published uses esbuild bundle.

**Risks:** Bundled published MCP may swell in size. Mitigation: baseline measurement (Task 4.B.1), threshold of 2× triggers audit (per spec Risks table).

**Rollback:** Restore vendored copies from git; re-point imports. Keep vendored copy in git history for this purpose.

---

### Task 4.A.1: Migrate `mcp-server/` (local dev) to workspace link

**Files:**
- Modify: `mcp-server/package.json` (already has `@tka/sequence-engine` per spec; verify).
- Delete: `mcp-server/src/**/loop-executor.js` (or any vendored copy discovered).

- [ ] **Step 1: Verify `mcp-server/package.json`**

Confirm `@tka/sequence-engine` is `"file:../packages/sequence-engine"` or `"workspace:*"`. If missing, add.

- [ ] **Step 2: Enumerate vendored engine in `mcp-server/`**

```bash
find mcp-server/ -name "loop-executor*" -o -name "*sequence-engine*" 2>/dev/null | grep -v node_modules
```

Report findings.

- [ ] **Step 3: Replace imports with `@tka/sequence-engine/loop`**

Grep consumers of vendored executor; update imports.

- [ ] **Step 4: Delete vendored files**

```bash
rm -rf mcp-server/<vendored-paths>
```

- [ ] **Step 5: Start MCP server + integration test**

```bash
pnpm --filter mcp-server start &
# In another shell, call generate_sequence via MCP protocol
```

Expected: known-good inputs produce output identical to pre-migration baseline.

- [ ] **Step 6: Commit**

```bash
git add -A mcp-server/
git commit -m "refactor(mcp-server): drop vendored engine; use workspace link"
```

---

### Task 4.B.1: Baseline `mcp-server-pkg` published bundle size

**Files:**
- Create: `mcp-server-pkg/BUNDLE_BASELINE.md`

- [ ] **Step 1: Build current `mcp-server-pkg` (vendored engine intact)**

```bash
pnpm --filter @austencloud/tka-domain-mcp build
ls -lh mcp-server-pkg/dist/
```

Capture the `dist/index.js` byte size and file count in `BUNDLE_BASELINE.md`.

- [ ] **Step 2: Commit baseline**

```bash
git add mcp-server-pkg/BUNDLE_BASELINE.md
git commit -m "docs(mcp-server-pkg): baseline bundle size for Phase 4 comparison"
```

---

### Task 4.B.2: Configure esbuild for `mcp-server-pkg` (BLOCKED ON ITEM 1)

**Files:**
- Create: `mcp-server-pkg/esbuild.config.mjs`
- Modify: `mcp-server-pkg/package.json` (new `build` script, add `esbuild` dev dep, add `@tka/sequence-engine` + `@tka/tka-types` workspace deps)

- [ ] **Step 1: Propose esbuild config**

```js
// mcp-server-pkg/esbuild.config.mjs
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  banner: { js: "#!/usr/bin/env node" },
  external: [
    "@modelcontextprotocol/sdk",
    "@resvg/resvg-js",
    "zod",
  ],
  // Bundle @tka/sequence-engine + @tka/tka-types + @tka/render-core INTO dist/index.js.
  sourcemap: true,
  minify: false,     // Readability first; test if bundle stays under 2x threshold.
  logLevel: "info",
});
```

Report config to Austen. Do not run the build until confirmed.

- [ ] **Step 2: Await confirmation, then update `package.json`**

```json
"scripts": {
  "build": "node esbuild.config.mjs"
},
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.0.0",
  "@resvg/resvg-js": "^2.6.0",
  "@tka/render-core": "workspace:*",
  "@tka/sequence-engine": "workspace:*",
  "@tka/tka-types": "workspace:*",
  "zod": "^3.25.0"
},
"devDependencies": {
  "@types/node": "^20.0.0",
  "esbuild": "^0.20.0",
  "typescript": "^5.0.0"
}
```

- [ ] **Step 3: Delete vendored engine**

```bash
rm -rf mcp-server-pkg/vendor/sequence-engine/
```

- [ ] **Step 4: Replace vendored imports with workspace imports**

Grep for any import path containing `vendor/sequence-engine` in `mcp-server-pkg/src/`; replace with `@tka/sequence-engine/...`.

- [ ] **Step 5: Build**

```bash
pnpm install
pnpm --filter @austencloud/tka-domain-mcp build
ls -lh mcp-server-pkg/dist/
```

Expected: `dist/index.js` exists; size recorded for comparison.

- [ ] **Step 6: Compare to baseline**

Compute ratio. If ratio > 2.0, stop and report; follow spec Risks table (tree-shaking audit or export surgery).

- [ ] **Step 7: Integration test — round-trip `generate_sequence`**

```bash
node mcp-server-pkg/dist/index.js # starts server
# In another shell, invoke generate_sequence with corpus input; diff output.
```

Expected: bit-identical output vs pre-migration.

- [ ] **Step 8: Commit**

```bash
git add -A mcp-server-pkg/
git commit -m "refactor(mcp-server-pkg): esbuild bundle replaces vendored engine"
```

### Phase 4 — Verification

- `mcp-server/` starts and `generate_sequence` round-trip matches baseline
- `mcp-server-pkg/` builds; bundle ratio <= 2×; round-trip matches baseline

### Phase 4 — Rollback

```bash
git revert <phase-4-commits>
pnpm install
pnpm --filter mcp-server start   # sanity
pnpm --filter @austencloud/tka-domain-mcp build   # sanity
```

### Phase 4 — Definition of Done

- [ ] `mcp-server/` vendored engine deleted
- [ ] `mcp-server-pkg/vendor/sequence-engine/` deleted
- [ ] esbuild config committed; build produces bundled `dist/index.js`
- [ ] Bundle size <= 2× baseline
- [ ] Both MCP servers round-trip `generate_sequence` to bit-identical baseline output

---

## Phase 5 — Broadcast Consolidation

**Goal:** Delete `deployment/functions/src/broadcast/loop-executor.ts`. Cloud Function imports from engine via workspace link; existing bundler inlines.

**Risks:** Cloud Function bundler (likely esbuild or webpack per `firebase-tools`) may not resolve workspace links. Mitigation: test deploy to a non-prod function alias first.

**Rollback:** Restore `loop-executor.ts` via `git revert`. Cloud Function supports alias rollback via `firebase functions:rollback`.

---

### Task 5.1: Verify Cloud Function bundler resolves workspace

**Files:**
- Read: `deployment/functions/package.json`
- Read: `deployment/functions/firebase.json` (or root `firebase.json`)
- Read: whatever bundler config exists

- [ ] **Step 1: Inspect config**

Report bundler type + workspace resolution strategy. If bundler does not follow pnpm workspaces, this phase blocks on bundler config changes (flag to Austen).

- [ ] **Step 2: Add `@tka/sequence-engine` + `@tka/tka-types` as deps**

Edit `deployment/functions/package.json` to add workspace deps.

- [ ] **Step 3: Try a dry-build**

```bash
cd deployment/functions && npm run build
```

Expected: PASS.

- [ ] **Step 4: Report result**

If PASS, proceed. If FAIL with workspace-resolution errors, pause and report to Austen.

- [ ] **Step 5: Commit**

```bash
git add deployment/functions/package.json
git commit -m "chore(functions): add engine + tka-types deps for broadcast"
```

---

### Task 5.2: Rewire broadcast to engine

**Files:**
- Modify: `deployment/functions/src/broadcast/conductor.ts` (and any other consumer of local `loop-executor`)
- Delete: `deployment/functions/src/broadcast/loop-executor.ts`

- [ ] **Step 1: Find consumers**

```bash
grep -rln "broadcast/loop-executor\|./loop-executor" deployment/functions/src/
```

- [ ] **Step 2: Replace imports**

Swap local import for `@tka/sequence-engine/loop`.

- [ ] **Step 3: Delete `loop-executor.ts`**

```bash
rm deployment/functions/src/broadcast/loop-executor.ts
```

- [ ] **Step 4: Build + unit test**

```bash
cd deployment/functions && npm run build && npm test
```

Expected: PASS.

- [ ] **Step 5: Deploy to non-prod alias for integration test**

```bash
firebase deploy --only functions:broadcast-staging
```

Trigger with known-good payload; diff output against baseline.

- [ ] **Step 6: Production deploy**

```bash
firebase deploy --only functions:broadcast
```

Austen confirms production broadcast works via monitoring logs.

- [ ] **Step 7: Commit**

```bash
git add -A deployment/functions/
git commit -m "refactor(broadcast): delete vendored loop-executor; import from engine"
```

### Phase 5 — Verification

- Build PASS
- Staging deploy produces correct output
- Production deploy has no error logs in first 24h

### Phase 5 — Rollback

```bash
git revert <phase-5-commits>
firebase deploy --only functions:broadcast
```

### Phase 5 — Definition of Done

- [ ] `deployment/functions/src/broadcast/loop-executor.ts` deleted
- [ ] Broadcast function deploys successfully
- [ ] Staging integration test PASS
- [ ] Production 24h monitoring clean

---

## Phase 6 — DB Backfill (30-day elapsed-time gate)

**Goal:** Remove stored `blueReversal`/`redReversal` fields from Firestore sequence docs.

**Elapsed-time gate:** Phase 2 shipped derivation-on-read. From Phase 2 merge date, **30 calendar days** of continuous zero-mismatch monitoring must elapse before Phase 6 runs. This phase is explicitly gated by calendar time, not by task sequencing. Do not run Phase 6 until Austen confirms the 30-day window has elapsed AND audit script output shows zero mismatches.

**Risks:** Data loss if derivation is wrong for some legacy sequence. Mitigated by (a) daily audit script (Task 6.1) for 30 days, (b) full Firestore backup before migration (Task 6.2), (c) dry-run mode on migration script.

**Rollback:** Restore from Firestore backup. Re-write stored reversal fields from backup snapshot.

---

### Task 6.1: Write reversal-derivation audit script

**Files:**
- Create: `scripts/reversal-derivation-audit.ts`

- [ ] **Step 1: Implement audit**

```ts
// scripts/reversal-derivation-audit.ts
// Query all sequences/{id} docs from Firestore.
// For each: compute deriveReversals(steps), compare to stored .blueReversal/.redReversal arrays.
// Log each mismatch with doc id, step index, stored value, derived value.
// Exit 0 if zero mismatches, 1 otherwise.
// Write full report to logs/reversal-audit-<date>.json.
```

Use `@google-cloud/firestore` or Admin SDK with service account creds from env.

- [ ] **Step 2: Run against prod**

```bash
pnpm tsx scripts/reversal-derivation-audit.ts
```

Expected: ideally zero mismatches. If non-zero: investigate per spec Risks table ("fix derivation or backfill correct stored values; do NOT just trust derivation silently").

- [ ] **Step 3: Schedule daily run during 30-day window**

Options: GitHub Actions cron, Cloud Scheduler + Cloud Function, or manual daily run. Austen picks. Log each day's result.

- [ ] **Step 4: Commit audit script**

```bash
git add scripts/reversal-derivation-audit.ts
git commit -m "feat(scripts): reversal derivation audit for Phase 6 gate"
```

- [ ] **Step 5: Calendar gate**

Wait. Every day for 30 days, confirm audit passes. If any day fails, investigate, fix, restart the 30-day clock.

---

### Task 6.2: Write migration script (BLOCKED ON ITEM 2)

**Files:**
- Create: `scripts/drop-reversal-fields.ts`

- [ ] **Step 1: Implement with dry-run + progress**

```ts
// scripts/drop-reversal-fields.ts
// Flags:
//   --dry-run         (default): print what would change, write nothing
//   --execute         (required for real run)
//   --batch-size=500  (default)
//   --backup-path=<gs://...>  (required for --execute)
//
// Procedure:
//   1. If --execute, export full `sequences` collection to backup-path (gsutil or Admin SDK export).
//   2. Confirm export complete + size reasonable.
//   3. Iterate all sequence docs. For each, batched writes of 500:
//        FieldValue.delete() for blueReversal, redReversal (at all step indices inside steps array).
//   4. Log progress every 100 docs.
//   5. On completion, print summary: N docs updated, N fields removed.
```

Steps array is likely `steps: [{...}, {...}]` with reversal fields nested. Migration must descend into the array, rewrite each object without reversal fields. Use `docRef.update({ steps: newSteps })` per doc.

- [ ] **Step 2: Dry-run against prod**

```bash
pnpm tsx scripts/drop-reversal-fields.ts --dry-run
```

Capture count of affected docs + fields.

- [ ] **Step 3: Await Austen's confirmation + backup-path**

Report dry-run output. Request backup path + explicit go-ahead.

- [ ] **Step 4: Run backup**

```bash
gcloud firestore export gs://tka-backups/pre-reversal-drop/<date>/
```

Confirm complete.

- [ ] **Step 5: Execute migration**

```bash
pnpm tsx scripts/drop-reversal-fields.ts --execute --batch-size=500 --backup-path=gs://tka-backups/pre-reversal-drop/<date>/
```

Monitor logs. Expect multi-minute run depending on corpus size.

- [ ] **Step 6: Re-run audit**

```bash
pnpm tsx scripts/reversal-derivation-audit.ts
```

Now audit should find zero stored fields anywhere. Derivation still computes correctly from step motions. Expected: zero mismatches AND zero stored reversal fields.

- [ ] **Step 7: Commit migration script + run log**

```bash
git add scripts/drop-reversal-fields.ts logs/reversal-drop-<date>.log
git commit -m "chore(migration): drop stored reversal fields from Firestore sequences"
```

### Phase 6 — Verification

- 30-day audit log shows continuous zero mismatches
- Backup created and accessible
- Dry-run output matches execute output (counts match)
- Post-migration audit: zero stored reversal fields
- App continues to function (reversals still derive correctly)

### Phase 6 — Rollback

```bash
gcloud firestore import gs://tka-backups/pre-reversal-drop/<date>/
```

Reversal fields restored on all docs. App continues to work because it already ignores stored values.

### Phase 6 — Definition of Done

- [ ] 30 calendar days elapsed since Phase 2 merge
- [ ] Daily audit run for 30 days, every day showing zero mismatches
- [ ] Firestore backup complete and verified
- [ ] Dry-run audited by Austen
- [ ] Migration executed successfully
- [ ] Post-migration audit clean

---

## Phase 7 — Publish

**Goal:** Publish `@tka/sequence-engine`, `@tka/domain`, `@tka/render-core` to npm as `0.1.0` with READMEs and CHANGELOGs. App continues to consume via workspace link.

**Risks:** Published packages may reference `@tka/tka-types` as a workspace dep that doesn't exist on npm. Mitigation: publish `@tka/tka-types` too, OR bundle it into each published package. Decision in Task 7.0.

**Rollback:** `npm unpublish` (within 72h) or deprecate and publish 0.1.1 if issues. Unpublish is forbidden if another package depends on it — validate chain first.

---

### Task 7.0: Decide `@tka/tka-types` publish strategy (BLOCKED ON ITEM 5)

- [ ] **Step 1: Propose two options**

Option A: Publish `@tka/tka-types` as its own package (0.1.0). Three-package publish becomes four-package publish. Clean dependency graph.

Option B: Bundle `@tka/tka-types` into each of the three published packages. Types duplicated across three packages but a single install suffices. Can cause identity-check issues (different `Motion` symbols treated as distinct by TypeScript).

Strong recommendation: **Option A.** Types are small, stable, and cross-package identity matters for third-party tooling.

Report recommendation + tradeoffs to Austen. Await decision.

- [ ] **Step 2: Document decision**

Add decision + rationale to `docs/superpowers/plans/tmp/phase-7-decisions.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/tmp/phase-7-decisions.md
git commit -m "docs(plan): phase 7 tka-types publish strategy decision"
```

---

### Task 7.1: Scaffold `@tka/sequence-engine` README + CHANGELOG

**Files:**
- Create: `packages/sequence-engine/README.md`
- Create: `packages/sequence-engine/CHANGELOG.md`
- Modify: `packages/sequence-engine/package.json` — verify `repository`, `keywords`, `author`, `homepage`, `bugs` fields populated.

- [ ] **Step 1: Write README**

Structure:

```markdown
# @tka/sequence-engine

Platform-agnostic sequence engine for The Kinetic Alphabet (TKA): LOOP
algebra, constraint-based generation, orientation propagation, reversal
derivation.

> **API status:** 0.x. Breaking changes possible on any minor. Pin exactly.

## Install

    npm install @tka/sequence-engine @tka/tka-types

## Example — Generate a sequence

    import { SequenceBuilder } from "@tka/sequence-engine/generation";

    const result = await SequenceBuilder.build({
      word: "BOOK",
      constraintPreset: "smooth",
    });
    console.log(result.steps); // Step[]

## Example — Execute a LOOP

    import { loopExecutorSelector } from "@tka/sequence-engine/loop";
    // ...

## Example — Derive reversals

    import { deriveReversals } from "@tka/sequence-engine";
    const reversals = deriveReversals(steps);

## Subpath exports

- `@tka/sequence-engine/core` — core types (deprecated; use `@tka/tka-types`)
- `@tka/sequence-engine/generation` — SequenceBuilder
- `@tka/sequence-engine/loop` — LOOP execution + detection
- `@tka/sequence-engine/analysis` — deriveReversals + other pure analyses
- `@tka/sequence-engine/harness` — parity testing utilities

## License

MIT
```

No marketing copy. No "Whether you're..." No em dashes. State what it does.

- [ ] **Step 2: Write CHANGELOG**

```markdown
# Changelog

## [0.1.0] — 2026-04-20 (unreleased)

### Added
- Initial public release.
- Unified `Step` and `Motion` types via `@tka/tka-types`.
- LOOP executors for all supported LOOP types (MIRRORED, FLIPPED, SWAPPED, INVERTED, ROTATED, REWOUND, plus combinatorials).
- `deriveReversals` pure function.
- Parity harness utilities.

### Notes
- 0.x series signals instability. API may change on any minor version bump.
```

- [ ] **Step 3: Run README code examples**

Each code block in the README must be runnable. Write `packages/sequence-engine/tests/readme-examples.test.ts` that executes each example and asserts expected output shape.

- [ ] **Step 4: Commit**

```bash
git add packages/sequence-engine/README.md packages/sequence-engine/CHANGELOG.md packages/sequence-engine/tests/readme-examples.test.ts packages/sequence-engine/package.json
git commit -m "docs(sequence-engine): 0.1.0 README + CHANGELOG + verified examples"
```

---

### Task 7.2: Scaffold `@tka/domain` README + CHANGELOG

Same procedure as Task 7.1, for `packages/domain/`. Task depends on the package's actual API scope being finalized.

- [ ] **Step 1: Enumerate `@tka/domain` public API**

```bash
grep -rln "export " packages/domain/src/ > /tmp/domain-exports.txt
```

Produce an API surface summary — what can a consumer import? Commit to `docs/superpowers/plans/tmp/phase-7-domain-api.md`.

- [ ] **Step 2: Austen sign-off on API scope**

Confirm the intended public surface before documenting. Reduce or expand exports if needed.

- [ ] **Step 3: Write README + CHANGELOG following Task 7.1 pattern**

- [ ] **Step 4: Write verified-examples test**

- [ ] **Step 5: Commit**

```bash
git commit -m "docs(domain): 0.1.0 README + CHANGELOG + verified examples"
```

---

### Task 7.3: Scaffold `@tka/render-core` README + CHANGELOG

Same procedure for `packages/render-core/`.

- [ ] **Step 1: Enumerate API**
- [ ] **Step 2: Austen sign-off**
- [ ] **Step 3: Write docs**
- [ ] **Step 4: Verified examples test**
- [ ] **Step 5: Commit**

---

### Task 7.4: Scaffold `@tka/tka-types` README + CHANGELOG (if Option A)

Blocked on Task 7.0 decision. If Option A, same procedure.

---

### Task 7.5: Delete engine's deprecated type shim

**Files:**
- Modify: `packages/sequence-engine/src/core/types/sequence-engine-types.ts` — keep only engine-specific non-Step/Motion types (PositionGroup, HandPath, LetterCategory, LetterPositionInfo, LetterMappingData, LetterMappingsJson, SequenceResult, OrientationInput). Remove all re-exports from `@tka/tka-types`.
- Modify: all engine files importing from the shim — switch to direct `@tka/tka-types` imports.

- [ ] **Step 1: Find shim-consumers**

```bash
grep -rln "from.*core/types/sequence-engine-types" packages/sequence-engine/src/
```

- [ ] **Step 2: Rewrite imports to target `@tka/tka-types` directly for Step/Motion/enums**

- [ ] **Step 3: Strip re-exports from shim**

- [ ] **Step 4: Build + parity**

```bash
pnpm run build:packages
pnpm --filter @tka/sequence-engine test parity
```

Both PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(sequence-engine): remove deprecated Step/Motion shim; consumers import from @tka/tka-types"
```

---

### Task 7.6: Publish

- [ ] **Step 1: `npm login` as the publishing identity**

Use the org-owned npm account. Austen handles credentials.

- [ ] **Step 2: Publish `@tka/tka-types` first (if Option A)**

```bash
pnpm --filter @tka/tka-types publish --access public --no-git-checks
```

Expected: published as 0.1.0.

- [ ] **Step 3: Publish the three packages in dep order**

```bash
pnpm --filter @tka/render-core publish --access public --no-git-checks
pnpm --filter @tka/domain publish --access public --no-git-checks
pnpm --filter @tka/sequence-engine publish --access public --no-git-checks
```

Sequence-engine last because it depends on tka-types (and possibly domain).

- [ ] **Step 4: Verify via fresh install**

Create a temp directory outside the monorepo:

```bash
mkdir /tmp/publish-verify && cd /tmp/publish-verify
npm init -y
npm install @tka/sequence-engine @tka/tka-types
node -e "const { deriveReversals } = require('@tka/sequence-engine'); console.log(deriveReversals([]));"
```

Expected: prints `[]`. Package consumable outside the monorepo.

- [ ] **Step 5: Tag release**

```bash
git tag v0.1.0-engine-unification
git push origin v0.1.0-engine-unification
```

- [ ] **Step 6: Final commit**

```bash
git commit --allow-empty -m "release(packages): @tka/sequence-engine, @tka/domain, @tka/render-core, @tka/tka-types 0.1.0"
```

### Phase 7 — Verification

- All four packages (or three, per 7.0 decision) installable from a fresh npm consumer
- README examples execute correctly when run from a fresh install
- Parity harness still passes
- App `pnpm run check` + `pnpm test` + `pnpm run build` still pass (app uses workspace, unaffected by publish)

### Phase 7 — Rollback

```bash
npm deprecate @tka/sequence-engine@0.1.0 "Published in error — see 0.1.1"
# Fix, bump to 0.1.1, republish.
```

`npm unpublish` within 72 hours is an option for truly broken publishes, but deprecation is safer.

### Phase 7 — Definition of Done

- [ ] 0.1.0 published for all targeted packages
- [ ] READMEs with verified, runnable examples
- [ ] CHANGELOG.md for each
- [ ] Fresh-install smoke test passes from outside the monorepo
- [ ] Git tag `v0.1.0-engine-unification` pushed
- [ ] Spec success criteria all satisfied:
  - [ ] Zero LOOP executor code duplicated
  - [ ] One Step type, one Motion type
  - [ ] Parity harness bit-identical pre/post
  - [ ] Reversal derivation matches stored (Phase 6 proved)
  - [ ] Three packages installable from npm
  - [ ] Fresh-generation + extend flows both produce correct quartered mirrored LOOPs

---

## Cross-Phase Global Checklist

- [ ] Parity harness runs green before AND after every phase (Phases 1–7)
- [ ] Engine tests pass after every phase
- [ ] App check + test + build pass after every phase that touches the app
- [ ] Austen-confirmed manual smoke after Phases 2, 3, 4, 5
- [ ] Firestore backup exists before Phase 6 execution
- [ ] 30-day elapsed-time gate respected before Phase 6 execution
- [ ] Three (or four) packages published in Phase 7

## Self-Review (done before save)

- **Spec coverage.** All 7 phases in spec (§Rollout Phases) mapped to same-numbered plan phases. Testing Strategy (parity harness, reversal proof, LOOP correctness, MCP integration, broadcast integration) covered in Tasks 0.6, 0.7, 6.1, Phase 4 integration, Phase 5 integration. Risks table mitigations enforced (corpus methodology Task 0.1, legacy-data investigation rule Phase 6, bundle ratio cap Phase 4, breaking-change scope note respected, 0.x signaling Phase 7 README). Publishing strategy Day-1 three-package limit respected; rename-scope sibling spec untouched.

- **Placeholders.** None. Every "TBD/later" replaced with specific blocked-on items numbered 1–6 at top.

- **Type consistency.** `Step`, `Motion`, `createStep`, `createStartStep`, `createMotion`, `updateStep`, `updateMotion`, `deriveReversals`, `StepReversals`, `selectionStore`, `createSelectionStore` — names used consistently across tasks 0.2–2.6.

- **Open-item flagging.** Six blocked-on items surfaced before any task depends on them; each dependent task references the item number.
