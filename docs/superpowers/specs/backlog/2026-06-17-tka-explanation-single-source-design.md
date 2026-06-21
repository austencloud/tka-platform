# TKA Letter-Explanation Single Source of Truth

**Date:** 2026-06-17
**Status:** Design — approved direction, pending spec review
**Author:** Austen (with Claude)

## Problem

The explanation for why Type 1's quarter-same group has four letters (S, T, U, V)
while every other group has three currently lives in **at least four places**, in
**three different framings**, and some of them are **inaccurate**:

| Location | Framing | Accurate? |
|---|---|---|
| `packages/domain/src/reference/domain-topics.ts` (`stuv-anomaly`, `symmetry-invariance`, `position-symmetry`) | Symmetry-invariance; leader/follower scoped to same-direction shifts | **Yes** |
| `packages/domain/src/reference/type-explanations.ts` (`TYPE_DEFINITIONS[1].rotationPattern`) | "Pro spin inside the right angle," groups-of-three | Partial — no symmetry grounding |
| `packages/domain/src/data/letter-types.ts` (`LETTER_TYPES["1"].characteristics`) | "Leader/follower at gamma" (unscoped) | **No** — implies quarter-opposite has a leader/follower |
| `mcp-server-pkg/src/shared/server-context.ts` (`TKA_LETTER_TYPES`, hardcoded) + `mcp-server-pkg/data/letter-types.json` (runtime-loaded) | Hand-maintained copies, disconnected from `packages/domain` | Drift risk |

The learn module (`src/lib/features/learn/components/interactive/letters/type1/`)
carries **none** of the explanation — its `Type1LetterVisualizer` shows a bare
"Hybrid" badge and never explains the doubling.

A cold reader (human or AI) gets a different — sometimes wrong — story depending on
which file or MCP tool they hit first. That fork is what makes a reasonable person
conclude the count is a mistake. Two specific inaccuracies confirmed against the
Flow Arts Knowledge MCP:

1. **"Each rotation pattern is one letter"** is wrong. Letters are half-cycles, not
   atomic performed units; in continuous spinning the unit is the **compound**
   (DJ, EK, FL; MP, NQ, OR; Phi-Psi). VTG timing applies to the compound.
   `[compound-letters]`
2. **"Gamma has a leader/follower"** is wrong/incomplete. Leader/follower applies
   **only to same-direction shifts** (quarter-same). Quarter-**opposite** hands
   (M–R) diverge/converge symmetrically — no leader, no follower.
   `[position-symmetry, get_position_info gamma]`

## Goal

Converge every explanation onto **one canonical source** in `packages/domain`.
Every other surface — the other domain reference files, the MCP data, and the learn
UI — derives from or cites that source. Add a test that fails if any surface
diverges or if the friendly version stops matching the precise version.

## Non-Goals

- Changing the alphabet, the letter count, or any motion data. The system is
  correct; only its **documentation** is forked.
- Rewriting the MCP server architecture. We add a generation step, not a rewrite.
- Touching positions/letters outside the Type 1 quarter-same explanation, except
  where a file already mixes this content with adjacent type prose.

## The Canonical Statement — Precise Register (fact-checked)

This is the authoritative text. Every clause is grounded in an MCP source.

**Organizing axis — VTG timing + direction.** Type 1 (dual-shift, 22 letters) is
grouped by timing + direction `[list_vtg_categories, stuv-anomaly]`:

| Group | Letters | Position |
|---|---|---|
| Split-Same | A B C | symmetric (α/β) |
| Together-Opposite | D E F | symmetric |
| Together-Same | G H I | symmetric |
| Split-Opposite | J K L | symmetric |
| Quarter-Opposite | M N O **and** P Q R | gamma (asymmetric) |
| Quarter-Same | **S T U V** | gamma (asymmetric) |

3+3+3+3+6+4 = 22. Each group is two pure members (pro\|pro, anti\|anti) + one hybrid
(pro\|anti). Quarter-opposite is two such triples (M–R), pairing into compounds
MP/NQ/OR `[quarter-opp category, compound-letters]`.

**Why quarter-same has four.** A letter is an equivalence class under **rotation,
reflection, and color-swap** `[symmetry-invariance]`. That invariance holds for
(a) symmetric positions and (b) opposite-direction motion anywhere (color-swap =
mirror, covered by reflection). It breaks **only for same-direction motion in an
asymmetric position** = quarter-same `[symmetry-invariance, position-symmetry]`.

- **S (pro\|pro), T (anti\|anti)** — color-swap just swaps who leads → geometrically
  equivalent → one letter each. Leader/follower still drives turn placement (leader's
  turn on top of the glyph, follower's below), doubling their variation space.
- **Hybrid** — color-swap changes *which motion type leads* → genuinely different →
  two letters: **U** (leader pro / follower anti), **V** (leader anti / follower pro).
- Net: quarter-same = 4, every other group = 3. The only place the invariance
  principle forces an extra letter. `[stuv-anomaly]`

**Leader/follower scope.** Present only in same-direction shifts (quarter-same).
Quarter-opposite (M–R) has none `[position-symmetry]`.

**Compound caveat.** A letter is a half-cycle; the performed unit in continuous
spinning is the compound `[compound-letters]`.

## The Canonical Statement — Plain Register (ships to humans)

> **Three here, four there — looks like a screw-up. It isn't. Takes ten seconds.**
>
> Hold both hands out in an L — one to the side, one in front. Spin them. One hand
> is in front, one's behind. Front hand, back hand.
>
> If both hands do the **same spin**, it doesn't matter which one's in front. Switch
> them and the move looks exactly the same. One move, one letter.
>
> But if the two hands do **different spins**, now it matters who's in front. Front
> hand doing the first spin is a different move than front hand doing the second. You
> can't turn one into the other by spinning or flipping the card. Two real moves, so
> two letters: U and V.
>
> That's it. Every other group has three because switching hands changes nothing.
> This one has four because — just this once — switching hands changes everything.

Plain → precise mapping (so the friendly version never invents a claim):
front/back hand = leader/follower · same spin vs different spins = pure vs hybrid ·
switch hands = color-swap · "can't turn one into the other by spinning/flipping" =
the invariance rule.

## Architecture — One Source, Many Derivations

```
packages/domain/src/reference/<canonical>.ts   ← SINGLE SOURCE
  ├─ structured invariant data (per-letter vtgGroup, rotationPattern, role)
  ├─ PRECISE explanation text
  └─ PLAIN explanation text
        │
        ├── domain-topics.ts (stuv-anomaly / symmetry-invariance) — re-export, no restating
        ├── type-explanations.ts (TYPE_DEFINITIONS[1]) — derive rotationPattern prose
        ├── letter-types.ts (LETTER_TYPES["1"].characteristics) — derive, fix the inaccurate line
        ├── [build] → mcp-server-pkg/data/letter-types.json  (generated, committed)
        │       └── server-context.ts drops hardcoded TKA_LETTER_TYPES, consumes generated data
        └── learn/type1 — imports PLAIN text + structured data for the Hybrid page
```

The accurate text already exists in `domain-topics.ts`. Rather than write new prose,
**extract it into the canonical module and have `domain-topics.ts` re-export**, so
there is exactly one copy. The structured per-letter fields are new; the precise text
is moved, not rewritten.

### Structured fields (new)

Per Type 1 letter, the canonical data carries:

- `vtgGroup`: `'ss' | 'so' | 'ts' | 'to' | 'qo' | 'qs'`
- `rotationPattern`: `'pro' | 'anti' | 'hybrid'`
- `role`: `'leader' | 'follower'` — **present only when `vtgGroup === 'qs'`**. Omitted
  for quarter-opposite and symmetric groups. A blanket gamma `leader` field is
  explicitly rejected: it would falsely imply M–R have a leader/follower.

U = `{ vtgGroup: 'qs', rotationPattern: 'hybrid', leaderRotation: 'pro' }`,
V = `{ vtgGroup: 'qs', rotationPattern: 'hybrid', leaderRotation: 'anti' }`.

## Files

**Create:**
- `packages/domain/src/reference/<canonical>.ts` — single source (structured data +
  precise text + plain text). *Grep: no existing module unifies these; the text is
  currently split across `domain-topics.ts`, `type-explanations.ts`, `letter-types.ts`.*
- Generator script (emits `mcp-server-pkg/data/letter-types.json` from canonical).
  *Grep: no existing letter-types.json generator found — the JSON and the
  `server-context.ts` const are both hand-maintained.*
- Lock test in `packages/domain`.

**Edit:**
- `packages/domain/src/reference/domain-topics.ts` — `stuv-anomaly` /
  `symmetry-invariance` re-export canonical text instead of holding their own copy.
- `packages/domain/src/reference/type-explanations.ts` — `TYPE_DEFINITIONS[1]`
  derives from canonical; drop the divergent "inside the right angle" wording.
- `packages/domain/src/data/letter-types.ts` — fix the inaccurate "leader/follower at
  gamma" characteristic; derive from canonical.
- `mcp-server-pkg/src/shared/server-context.ts` — delete hardcoded `TKA_LETTER_TYPES`
  (line ~247); consume generated data.
- `src/lib/features/learn/components/interactive/letters/type1/type1-letter-data.ts`
  (+ `domain/type1-letter-data.ts`) — add `vtgGroup` / `rotationPattern` /
  `leaderRotation` fields. *Plan pins which of the two files holds U/V values.*
- `Type1LetterVisualizer.svelte` — gamma-hybrid badge reads "Hybrid · leads pro/anti".
- `pages/Type1HybridPage.svelte` — teach the doubling via the PLAIN register; reuse
  `PictographContainer` (no hand-rolled SVG).

## Lock Test (the self-documenting guarantee)

Assertions:

1. Every Type 1 VTG group has exactly 3 letters **except** quarter-same, which has 4.
2. `role` / `leaderRotation` is present only for quarter-same letters; absent for
   quarter-opposite (M–R) and all symmetric groups.
3. The generated `mcp-server-pkg/data/letter-types.json` byte-matches what the
   generator produces from canonical — a hand-edit that re-diverges fails CI.
4. The plain register contains no precise-only jargon ("anomaly", "symmetry",
   "invariance", "asymmetric", "color-swap", "gamma") — keeps the friendly version
   friendly, and forces edits to go through the canonical mapping.

## Open Questions (resolve in plan phase)

- Exact canonical module name/path and whether structured fields live alongside the
  existing letter registry or in a dedicated rotation module.
- Which of the two `type1-letter-data.ts` files holds the U/V data values vs the
  interface.
- Generator wiring: standalone script in `scripts/` vs a `packages/domain` build
  step, and where it hooks into the existing build.
