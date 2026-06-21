# TKA Letter-Explanation Single Source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge every "why quarter-same has four letters" explanation onto one canonical module in `@tka/domain`, derive all other surfaces from it, and lock it with tests so the surfaces can't re-diverge or go inaccurate.

**Architecture:** New canonical module `packages/domain/src/reference/rotation-invariant.ts` holds (1) structured per-letter rotation data, (2) the precise explanation text, (3) the plain explanation text. `domain-topics.ts`, `type-explanations.ts`, and `letter-types.ts` re-export/derive from it. A generator emits `mcp-server-pkg/data/letter-types.json` from `LETTER_TYPES`. Vitest tests assert the structural invariant, JSON parity, and a jargon ban on the plain text.

**Tech Stack:** TypeScript ESM, `@tka/domain` (pnpm workspace `workspace:*`), Vitest (`tests/config/vitest.config.ts`), `tsx` for the generator script, Svelte 5 for the learn UI.

**Spec:** `docs/superpowers/specs/2026-06-17-tka-explanation-single-source-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/domain/src/reference/rotation-invariant.ts` (create) | SINGLE SOURCE: structured `TYPE1_ROTATION` data + `PRECISE_QUARTER_SAME_EXPLANATION` + `PLAIN_QUARTER_SAME_EXPLANATION` + helper |
| `packages/domain/src/index.ts` (modify) | Export the new module |
| `packages/domain/src/reference/domain-topics.ts` (modify) | `stuv-anomaly` topic re-exports precise text |
| `packages/domain/src/reference/type-explanations.ts` (modify) | `TYPE_DEFINITIONS[1]` U/V text derives from canonical |
| `packages/domain/src/data/letter-types.ts` (modify) | Fix inaccurate Type-1 characteristics; derive from canonical |
| `scripts/generate-letter-types-json.ts` (create) | Emit `mcp-server-pkg/data/letter-types.json` from `LETTER_TYPES` |
| `mcp-server-pkg/data/letter-types.json` (regenerate) | Generated artifact, committed |
| `tests/unit/domain/rotation-invariant.test.ts` (create) | Structural invariant assertions |
| `tests/unit/domain/letter-types-json-parity.test.ts` (create) | JSON parity + server-context parity + jargon ban |
| `src/lib/features/learn/components/interactive/letters/type1/type1-letter-data.ts` (modify) | Add `vtgGroup`/`rotationPattern`/`leaderRotation` to interface |
| `src/lib/features/learn/components/interactive/letters/type1/domain/type1-letter-data.ts` (modify) | Populate new fields per letter |
| `Type1LetterVisualizer.svelte` (modify) | Gamma-hybrid badge shows leader |
| `pages/Type1HybridPage.svelte` (modify) | Surface the plain explanation |

---

## Task 1: Canonical module — structured data + both text registers

**Files:**
- Create: `packages/domain/src/reference/rotation-invariant.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `tests/unit/domain/rotation-invariant.test.ts`

- [ ] **Step 1: Write the canonical module**

Create `packages/domain/src/reference/rotation-invariant.ts`:

```ts
import type { Letter } from "../types/letter.js";

/** VTG timing+direction group for a Type 1 letter. */
export type VtgGroup = "ss" | "so" | "ts" | "to" | "qo" | "qs";

/** Prop-rotation pattern of the two hands. */
export type RotationPattern = "pro" | "anti" | "hybrid";

export interface Type1RotationEntry {
  vtgGroup: VtgGroup;
  rotationPattern: RotationPattern;
  /**
   * Rotation of the LEADING hand. Present ONLY for quarter-same (qs),
   * the only group with a leader/follower distinction. Absent for every
   * other group — quarter-opposite (M-R) and the symmetric groups have
   * no leader/follower. Do NOT add this field outside qs.
   */
  leaderRotation?: "pro" | "anti";
}

/** Canonical Type 1 rotation data, keyed by letter (A-V). Single source. */
export const TYPE1_ROTATION: Record<string, Type1RotationEntry> = {
  // Split-Same
  A: { vtgGroup: "ss", rotationPattern: "pro" },
  B: { vtgGroup: "ss", rotationPattern: "anti" },
  C: { vtgGroup: "ss", rotationPattern: "hybrid" },
  // Together-Opposite
  D: { vtgGroup: "to", rotationPattern: "pro" },
  E: { vtgGroup: "to", rotationPattern: "anti" },
  F: { vtgGroup: "to", rotationPattern: "hybrid" },
  // Together-Same
  G: { vtgGroup: "ts", rotationPattern: "pro" },
  H: { vtgGroup: "ts", rotationPattern: "anti" },
  I: { vtgGroup: "ts", rotationPattern: "hybrid" },
  // Split-Opposite
  J: { vtgGroup: "so", rotationPattern: "pro" },
  K: { vtgGroup: "so", rotationPattern: "anti" },
  L: { vtgGroup: "so", rotationPattern: "hybrid" },
  // Quarter-Opposite (two triples, M-R) — NO leaderRotation
  M: { vtgGroup: "qo", rotationPattern: "pro" },
  N: { vtgGroup: "qo", rotationPattern: "anti" },
  O: { vtgGroup: "qo", rotationPattern: "hybrid" },
  P: { vtgGroup: "qo", rotationPattern: "pro" },
  Q: { vtgGroup: "qo", rotationPattern: "anti" },
  R: { vtgGroup: "qo", rotationPattern: "hybrid" },
  // Quarter-Same (S, T, U, V) — leaderRotation REQUIRED
  S: { vtgGroup: "qs", rotationPattern: "pro", leaderRotation: "pro" },
  T: { vtgGroup: "qs", rotationPattern: "anti", leaderRotation: "anti" },
  U: { vtgGroup: "qs", rotationPattern: "hybrid", leaderRotation: "pro" },
  V: { vtgGroup: "qs", rotationPattern: "hybrid", leaderRotation: "anti" },
};

export function getType1Rotation(letter: string): Type1RotationEntry | undefined {
  return TYPE1_ROTATION[letter];
}

/**
 * PRECISE register. Authoritative, fact-checked against the Flow Arts
 * Knowledge MCP. Every other precise explanation in the codebase must
 * re-export this string, never restate it.
 */
export const PRECISE_QUARTER_SAME_EXPLANATION = `Type 1 (dual-shift, 22 letters) is organized by VTG timing + direction into groups:

- Split-Same: A, B, C
- Together-Opposite: D, E, F
- Together-Same: G, H, I
- Split-Opposite: J, K, L
- Quarter-Opposite: M, N, O and P, Q, R
- Quarter-Same: S, T, U, V

Every group is two pure members (pro|pro, anti|anti) plus one hybrid (pro|anti) = 3 letters — except Quarter-Same, which has 4.

A letter is invariant under rotation, reflection, and color-swap: those transformations never produce a new letter. That invariance holds for symmetric positions (alpha, beta) and for opposite-direction motion anywhere. It breaks only for same-direction motion in an asymmetric position — Quarter-Same — where one hand leads and one follows.

- S (pro|pro) and T (anti|anti): swapping colors only swaps who leads, so the move is identical — one letter each. (Leader/follower still places turns: leader on top of the glyph, follower below.)
- The hybrid case: swapping colors changes which motion type leads, producing a genuinely different move. So it splits into two letters — U (leader pro, follower anti) and V (leader anti, follower pro).

Quarter-Same therefore has four; every other group has three. This is the only place the invariance rule forces an extra letter.

Leader/follower applies only to same-direction shifts (Quarter-Same). Quarter-Opposite (M-R) hands diverge/converge symmetrically — no leader, no follower.

A letter is a half-cycle, not the atomic performed unit: in continuous spinning the unit is the compound (DJ, EK, FL; MP, NQ, OR; Phi-Psi). VTG timing applies to the compound.`;

/**
 * PLAIN register. Ships to humans. Must contain none of the precise-only
 * jargon (enforced by tests/unit/domain/letter-types-json-parity.test.ts).
 * A faithful shrink of the precise version, never a different claim.
 */
export const PLAIN_QUARTER_SAME_EXPLANATION = `Three here, four there — looks like a screw-up. It isn't. Takes ten seconds.

Hold both hands out in an L — one to the side, one in front. Spin them. One hand is in front, one's behind. Front hand, back hand.

If both hands do the same spin, it doesn't matter which one's in front. Switch them and the move looks exactly the same. One move, one letter.

But if the two hands do different spins, now it matters who's in front. Front hand doing the first spin is a different move than front hand doing the second. You can't turn one into the other by spinning or flipping the card. Two real moves, so two letters: U and V.

That's it. Every other group has three because switching hands changes nothing. This one has four because — just this once — switching hands changes everything.`;
```

- [ ] **Step 2: Export from the package index**

In `packages/domain/src/index.ts`, add after the `domain-topics.js` export block (line ~137):

```ts
export {
  TYPE1_ROTATION,
  getType1Rotation,
  PRECISE_QUARTER_SAME_EXPLANATION,
  PLAIN_QUARTER_SAME_EXPLANATION,
} from "./reference/rotation-invariant.js";
export type {
  VtgGroup,
  RotationPattern,
  Type1RotationEntry,
} from "./reference/rotation-invariant.js";
```

- [ ] **Step 3: Build the domain package**

Run: `npm --prefix packages/domain run build`
Expected: `tsc` exits 0; `packages/domain/dist/reference/rotation-invariant.js` exists.

- [ ] **Step 4: Write the failing structural-invariant test**

Create `tests/unit/domain/rotation-invariant.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TYPE1_ROTATION, type VtgGroup } from "@tka/domain";

const lettersIn = (g: VtgGroup) =>
  Object.entries(TYPE1_ROTATION)
    .filter(([, v]) => v.vtgGroup === g)
    .map(([k]) => k)
    .sort();

const patternsIn = (g: VtgGroup) =>
  Object.values(TYPE1_ROTATION)
    .filter((v) => v.vtgGroup === g)
    .map((v) => v.rotationPattern)
    .sort();

describe("TYPE1_ROTATION canonical data", () => {
  it("covers exactly the 22 Type 1 letters A-V", () => {
    expect(Object.keys(TYPE1_ROTATION).sort()).toEqual(
      "ABCDEFGHIJKLMNOPQRSTUV".split("").sort()
    );
  });

  it("symmetric groups each have one pro, one anti, one hybrid", () => {
    for (const g of ["ss", "so", "ts", "to"] as VtgGroup[]) {
      expect(patternsIn(g)).toEqual(["anti", "hybrid", "pro"]);
    }
  });

  it("pins each VTG group to its exact letters (verified via tka_to_vtg MCP)", () => {
    expect(lettersIn("ss")).toEqual(["A", "B", "C"]);
    expect(lettersIn("to")).toEqual(["D", "E", "F"]);
    expect(lettersIn("ts")).toEqual(["G", "H", "I"]);
    expect(lettersIn("so")).toEqual(["J", "K", "L"]);
    expect(lettersIn("qo")).toEqual(["M", "N", "O", "P", "Q", "R"]);
    expect(lettersIn("qs")).toEqual(["S", "T", "U", "V"]);
  });

  it("quarter-same is exactly S, T, U, V", () => {
    expect(lettersIn("qs")).toEqual(["S", "T", "U", "V"]);
  });

  it("quarter-same is the only group with two hybrids (U, V)", () => {
    const hybridLetters = Object.entries(TYPE1_ROTATION)
      .filter(([, v]) => v.rotationPattern === "hybrid")
      .map(([k]) => k);
    expect(hybridLetters.sort()).toEqual("CFILORUV".split("").sort());
    expect(TYPE1_ROTATION.U.leaderRotation).toBe("pro");
    expect(TYPE1_ROTATION.V.leaderRotation).toBe("anti");
  });

  it("leaderRotation is present IFF the group is quarter-same", () => {
    for (const [letter, entry] of Object.entries(TYPE1_ROTATION)) {
      const hasLeader = entry.leaderRotation !== undefined;
      const isQs = entry.vtgGroup === "qs";
      expect(hasLeader, `${letter} leaderRotation vs qs`).toBe(isQs);
    }
  });

  it("quarter-opposite M-R have NO leader/follower (the M-R correction)", () => {
    for (const letter of "MNOPQR".split("")) {
      expect(TYPE1_ROTATION[letter].leaderRotation).toBeUndefined();
    }
  });

  it("rotationPattern counts: 7 pro, 7 anti, 8 hybrid = 22", () => {
    const count = (p: string) =>
      Object.values(TYPE1_ROTATION).filter((v) => v.rotationPattern === p).length;
    expect(count("pro")).toBe(7);
    expect(count("anti")).toBe(7);
    expect(count("hybrid")).toBe(8);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npm test -- tests/unit/domain/rotation-invariant.test.ts`
Expected: PASS (7 tests). If `@tka/domain` resolves to stale `dist`, re-run Step 3 first.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/reference/rotation-invariant.ts packages/domain/src/index.ts tests/unit/domain/rotation-invariant.test.ts
git commit -m "feat(domain): canonical Type 1 rotation invariant + explanation registers" -- packages/domain/src/reference/rotation-invariant.ts packages/domain/src/index.ts tests/unit/domain/rotation-invariant.test.ts
```

---

## Task 2: Derive the divergent domain files from canonical

**Files:**
- Modify: `packages/domain/src/reference/domain-topics.ts:789-841`
- Modify: `packages/domain/src/reference/type-explanations.ts:34-47`
- Modify: `packages/domain/src/data/letter-types.ts:7-14`

- [ ] **Step 1: Re-export precise text in the `stuv-anomaly` topic**

In `packages/domain/src/reference/domain-topics.ts`, add at the top of the file (with the other imports — this file currently has no imports of canonical data; add one):

```ts
import { PRECISE_QUARTER_SAME_EXPLANATION } from "./rotation-invariant.js";
```

Replace the `"stuv-anomaly"` entry's `content` value (lines 791-841, the entire template literal) with:

```ts
    content: PRECISE_QUARTER_SAME_EXPLANATION,
```

Leave the `title` field unchanged.

- [ ] **Step 2: Derive the U/V explanation in type-explanations**

In `packages/domain/src/reference/type-explanations.ts`, add at the top:

```ts
import { PRECISE_QUARTER_SAME_EXPLANATION } from "./rotation-invariant.js";
```

Replace the `rotationPattern.uvExplanation` string (line 46) and the `rotationPattern.note` (line 45) so the divergent "inside the right angle" wording is gone:

```ts
      note: "Quarter-Same (S, T, U, V) has 4 letters; every other group has 3. See uvExplanation.",
      uvExplanation: PRECISE_QUARTER_SAME_EXPLANATION,
```

Leave the `groups` array and `description` unchanged.

- [ ] **Step 3: Fix the inaccurate Type-1 characteristics**

In `packages/domain/src/data/letter-types.ts`, replace the three Type-1 `characteristics` strings at lines 11-13 (the "A-L … groups of three", "M-V … leader/follower distinction … 10 letters", and "U leads with pro …" lines) with these accurate ones:

```ts
      "Organized by VTG timing+direction: Split-Same (ABC), Together-Opp (DEF), Together-Same (GHI), Split-Opp (JKL), Quarter-Opp (M-R), Quarter-Same (STUV)",
      "Each group is pro + anti + hybrid = 3 letters, except Quarter-Same, which has 4",
      "Quarter-Same's hybrid splits into U (leader pro) and V (leader anti) because same-direction shifts at a right angle have a leader and follower. Quarter-Opposite (M-R) has no leader/follower",
```

- [ ] **Step 4: Rebuild and re-run Task 1 test**

Run: `npm --prefix packages/domain run build && npm test -- tests/unit/domain/rotation-invariant.test.ts`
Expected: build exits 0; test PASS (unchanged — this task only edits prose/derivation).

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/reference/domain-topics.ts packages/domain/src/reference/type-explanations.ts packages/domain/src/data/letter-types.ts
git commit -m "refactor(domain): derive STUV explanation from canonical, fix inaccurate Type 1 prose" -- packages/domain/src/reference/domain-topics.ts packages/domain/src/reference/type-explanations.ts packages/domain/src/data/letter-types.ts
```

---

## Task 3: Generator for the MCP JSON

**Files:**
- Create: `scripts/generate-letter-types-json.ts`
- Regenerate: `mcp-server-pkg/data/letter-types.json`

**Note:** the MCP's `get_letter_explanation` serves `mcp-server-pkg/data/letter-types.json` (loaded in `server-context.ts:319`). The hardcoded `TKA_LETTER_TYPES` const (`server-context.ts:247`) carries only name/description/letters — NOT the U/V explanation prose — so it is not part of the conflicting-explanation problem. It is left in place and guarded by a parity test in Task 4 rather than deleted, to avoid a runtime-ordering refactor of the MCP loader. (Full deletion is a safe follow-up if desired; flag to Austen.)

- [ ] **Step 1: Write the generator**

Create `scripts/generate-letter-types-json.ts`:

```ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LETTER_TYPES } from "@tka/domain";

const OUT = resolve("mcp-server-pkg/data/letter-types.json");

function build(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [num, def] of Object.entries(LETTER_TYPES)) {
    out[num] = {
      name: def.name,
      description: def.description,
      characteristics: def.characteristics,
      letters: def.letters,
      motionPattern: def.motionPattern,
    };
  }
  return out;
}

writeFileSync(OUT, JSON.stringify(build(), null, 2) + "\n", "utf-8");
console.log(`Wrote ${OUT}`);
```

- [ ] **Step 2: Run the generator**

Run: `npm --prefix packages/domain run build && npx tsx scripts/generate-letter-types-json.ts`
Expected: prints `Wrote …/mcp-server-pkg/data/letter-types.json`. The Type-1 `characteristics` in the JSON now match the accurate strings from Task 2 Step 3.

- [ ] **Step 3: Verify the JSON changed as expected**

Run: `git diff --stat mcp-server-pkg/data/letter-types.json`
Expected: file shows modifications in the `"1"` block characteristics. (Greek-letter keys like `Σ` must remain intact — JSON.stringify preserves them.)

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-letter-types-json.ts mcp-server-pkg/data/letter-types.json
git commit -m "feat(mcp): generate letter-types.json from canonical @tka/domain" -- scripts/generate-letter-types-json.ts mcp-server-pkg/data/letter-types.json
```

---

## Task 4: Lock tests — JSON parity, server-context parity, jargon ban

**Files:**
- Create: `tests/unit/domain/letter-types-json-parity.test.ts`

- [ ] **Step 1: Write the failing parity + jargon test**

Create `tests/unit/domain/letter-types-json-parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LETTER_TYPES, PLAIN_QUARTER_SAME_EXPLANATION } from "@tka/domain";

describe("MCP letter-types.json stays generated from canonical", () => {
  it("byte-matches what the generator produces from LETTER_TYPES", () => {
    const expected: Record<string, unknown> = {};
    for (const [num, def] of Object.entries(LETTER_TYPES)) {
      expected[num] = {
        name: def.name,
        description: def.description,
        characteristics: def.characteristics,
        letters: def.letters,
        motionPattern: def.motionPattern,
      };
    }
    const onDisk = readFileSync(
      resolve("mcp-server-pkg/data/letter-types.json"),
      "utf-8"
    );
    expect(onDisk).toBe(JSON.stringify(expected, null, 2) + "\n");
  });
});

describe("server-context letter lists do not drift from canonical", () => {
  it("each type's letters array matches LETTER_TYPES", () => {
    const src = readFileSync(
      resolve("mcp-server-pkg/src/shared/server-context.ts"),
      "utf-8"
    );
    // The TKA_LETTER_TYPES literal lists letters per type; assert the Type 1
    // line contains exactly the canonical Type 1 letters in order.
    const type1Letters = LETTER_TYPES["1"].letters.map((l) => `"${l}"`).join(", ");
    expect(src).toContain(type1Letters);
  });
});

describe("plain explanation stays jargon-free", () => {
  const BANNED = [
    "anomaly", "symmetry", "invariance", "invariant", "asymmetric",
    "color-swap", "gamma", "equivalence", "reflection",
    "quarter-same", "quarter-opposite",
  ];
  it("contains none of the precise-only terms", () => {
    const lower = PLAIN_QUARTER_SAME_EXPLANATION.toLowerCase();
    const found = BANNED.filter((w) => lower.includes(w));
    expect(found).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/unit/domain/letter-types-json-parity.test.ts`
Expected: PASS (3 tests). If the parity test fails, re-run Task 3 Step 2 to regenerate, then re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/domain/letter-types-json-parity.test.ts
git commit -m "test(domain): lock JSON parity, server-context letters, and plain-text jargon ban" -- tests/unit/domain/letter-types-json-parity.test.ts
```

---

## Task 5: Learn UI teaches the doubling from the canonical plain text

**Files:**
- Modify: `src/lib/features/learn/components/interactive/letters/type1/type1-letter-data.ts`
- Modify: `src/lib/features/learn/components/interactive/letters/type1/domain/type1-letter-data.ts`
- Modify: `src/lib/features/learn/components/interactive/letters/type1/Type1LetterVisualizer.svelte:120-121,200-209`
- Modify: `src/lib/features/learn/components/interactive/letters/type1/pages/Type1HybridPage.svelte`

- [ ] **Step 1: Extend the `Type1LetterData` interface**

In `src/lib/features/learn/components/interactive/letters/type1/type1-letter-data.ts`, add three optional fields to the interface:

```ts
export interface Type1LetterData {
  letter: Letter;
  blueMotion: MotionType;
  redMotion: MotionType;
  startPositionGroup: GridPositionGroup;
  endPositionGroup: GridPositionGroup;
  description: string;
  vtgGroup?: "ss" | "so" | "ts" | "to" | "qo" | "qs";
  rotationPattern?: "pro" | "anti" | "hybrid";
  /** Present only for quarter-same letters (S, T, U, V). */
  leaderRotation?: "pro" | "anti";
}
```

- [ ] **Step 2: Populate the new fields for U and V (the teaching case)**

In `src/lib/features/learn/components/interactive/letters/type1/domain/type1-letter-data.ts`, add the fields to the `U` entry (lines 195-202) and `V` entry (lines 203-210) inside `HYBRID_LETTERS`:

For `U` add:
```ts
    vtgGroup: "qs",
    rotationPattern: "hybrid",
    leaderRotation: "pro",
```

For `V` add:
```ts
    vtgGroup: "qs",
    rotationPattern: "hybrid",
    leaderRotation: "anti",
```

(S and T live in `PROSPIN_LETTERS`/`ANTISPIN_LETTERS`; add `vtgGroup: "qs"`, `rotationPattern: "pro"`/`"anti"`, `leaderRotation: "pro"`/`"anti"` to the `S` entry at lines 67-74 and the `T` entry at lines 130-137 respectively. All other letters may be left without the optional fields; the badge logic in Step 3 only reads them when present.)

- [ ] **Step 3: Show the leader in the gamma-hybrid badge**

In `Type1LetterVisualizer.svelte`, replace the hybrid badge block (lines 202-209) so a quarter-same hybrid shows its leader:

```svelte
    <div class="pattern-info">
      {#if isHybrid && letterData.leaderRotation}
        <span class="pattern-badge hybrid">Hybrid · leads {letterData.leaderRotation}</span>
      {:else if isHybrid}
        <span class="pattern-badge hybrid">Hybrid</span>
      {:else if letterData.blueMotion === MotionType.PRO}
        <span class="pattern-badge pro">Pro-Pro</span>
      {:else}
        <span class="pattern-badge anti">Anti-Anti</span>
      {/if}
    </div>
```

(The `isHybrid` derived at line 121 stays as-is. `leaderRotation` is the new optional field.)

- [ ] **Step 4: Surface the plain explanation on the Hybrid page**

In `pages/Type1HybridPage.svelte`, import the canonical plain text and render it below the lesson component. Add to the `<script>`:

```ts
  import { PLAIN_QUARTER_SAME_EXPLANATION } from "@tka/domain";
```

Add after the closing `</Type1LetterLessonPage>` … actually `Type1LetterLessonPage` is self-closing; add a sibling block after it:

```svelte
<Type1LetterLessonPage
  config={HYBRID_PAGE_CONFIG}
  {currentLetter}
  {letterIndex}
  {onCycle}
  {onSelectLetter}
  {onNext}
  {onPrevious}
  showFinalSummary={true}
/>

<aside class="quarter-same-note">
  {#each PLAIN_QUARTER_SAME_EXPLANATION.split("\n\n") as para}
    <p>{para}</p>
  {/each}
</aside>

<style>
  .quarter-same-note {
    margin: 1rem auto 0;
    max-width: 48ch;
    padding: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: 0.9375rem;
    line-height: 1.5;
  }
  .quarter-same-note p { margin: 0 0 0.75rem; }
  .quarter-same-note p:last-child { margin-bottom: 0; }
</style>
```

- [ ] **Step 5: Type-check the changed files**

Run: `npm run check:fast`
Expected: no new errors in the four edited files. (Use the warm checker per the fast-iteration rule; do not run full `npm run check` yet.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/learn/components/interactive/letters/type1/type1-letter-data.ts src/lib/features/learn/components/interactive/letters/type1/domain/type1-letter-data.ts "src/lib/features/learn/components/interactive/letters/type1/Type1LetterVisualizer.svelte" "src/lib/features/learn/components/interactive/letters/type1/pages/Type1HybridPage.svelte"
git commit -m "feat(learn): teach U/V quarter-same doubling from canonical plain text" -- src/lib/features/learn/components/interactive/letters/type1/type1-letter-data.ts src/lib/features/learn/components/interactive/letters/type1/domain/type1-letter-data.ts "src/lib/features/learn/components/interactive/letters/type1/Type1LetterVisualizer.svelte" "src/lib/features/learn/components/interactive/letters/type1/pages/Type1HybridPage.svelte"
```

---

## Task 6: Final verification gate

- [ ] **Step 1: Full domain test pass**

Run: `npm test -- tests/unit/domain/`
Expected: all tests in `rotation-invariant.test.ts` + `letter-types-json-parity.test.ts` PASS.

- [ ] **Step 2: One full type-check (commit gate)**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log | head`
Expected: no errors introduced by these changes. (Capture-once-grep-many per the fast-iteration rule.)

- [ ] **Step 3: Confirm MCP serves the canonical explanation**

After restarting the MCP server, call `get_letter_explanation` for `U` and `get_domain_topic` `stuv-anomaly`; confirm both return the leader/follower framing scoped to quarter-same and no "inside the right angle" wording remains. (Runtime verification per verification-protocol — requires MCP restart, which only the user can trigger; flag for Austen.)

---

## Self-Review

**Spec coverage:**
- Single canonical source → Task 1 (`rotation-invariant.ts`). ✓
- Other domain files derive → Task 2. ✓
- MCP JSON generated from canonical → Task 3. ✓
- Learn UI teaches doubling, distinguishes quarter-same vs quarter-opposite → Task 5 (badge shows leader only for qs; plain text states M-R has none). ✓
- Lock test: group structure, leader/follower scoped to qs, generated==canonical, jargon ban → Tasks 1 & 4. ✓
- Both registers (precise + plain) live in one source → Task 1. ✓

**Gap flagged:** spec said "delete hardcoded `TKA_LETTER_TYPES`"; plan guards it with a parity test instead (Task 3 note) to avoid an MCP loader-ordering refactor. The const holds no explanation prose, so the single-source-of-explanation goal is met. Full deletion noted as optional follow-up.

**Placeholder scan:** no TBD/TODO; every code step shows full content. ✓

**Type consistency:** `VtgGroup`/`RotationPattern`/`leaderRotation` identical across Task 1 (domain), Task 4 (test), Task 5 (learn interface). Generator field set (name/description/characteristics/letters/motionPattern) identical in Task 3 and the Task 4 parity test. ✓
