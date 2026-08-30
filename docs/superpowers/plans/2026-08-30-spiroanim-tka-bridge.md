# SpiroAnim → Flow Arts Composer Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the cell-identity bridge route `/from/spiroanim/<cellKey>` in the Composer, and a finished SpiroAnim PR branch adding a TKA chip next to the animation player, an upgraded Kinetic Alphabet pane, and a docs-menu link.

**Architecture:** Composer side: a route-scoped resolver turns a cellKey into an in-memory `SequenceData` from the vendored transcription (no Firestore), then renders it through the existing `SequenceViewerShell` as a thin third host. SpiroAnim side: a pure `buildComposerUrl` module plus an additive matched-cell event chain (panes → ConceptsPane → SpiroAnim.vue → AnimPlayer prop) that lights the chip. Return links are pre-generated with HIS codec and vendored — no codec reimplementation anywhere.

**Tech Stack:** SvelteKit + Svelte 5 (tka-platform), Vue 3 + Pinia + Vitest (spiroanim), vitest unit tests both sides.

**Spec:** `docs/superpowers/specs/2026-08-30-spiroanim-tka-bridge-design.md` (committed `b68f5113b9`).

**Worktrees:**
- Composer half: `E:/worktrees/tka-platform/spiroanim-bridge`, branch `claude/spiroanim-bridge`
- SpiroAnim half: `E:/worktrees/spiroanim/tka-bridge`, branch `claude/tka-bridge` (npm install done)

**Authority ordering for executors:** Code blocks in this plan are normative for *structure, naming, and behavior*. The named reference files are authoritative for *exact signatures and data shapes* — read them before writing the corresponding task and adapt the code here to what they actually export. Do not invent signatures. If a reference file contradicts this plan, follow the reference file and note the deviation in your report.

**Commit discipline (every commit):** explicit pathspec (`git commit -m "..." -- <paths>`), never broad staging. End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## The cellKey contract (both halves depend on this — do not drift)

```
<concept>.<reference>.<ratio>.<shape>.<variant>
```

- `concept`: `vtg` | `qtr` | `8stp`
- `reference`: vtg/qtr `^[1-6]-[1-6]$`; 8stp `^[1-8]-(aa|ae|ai|ea|ee|ei|ia|ie|ii)$` (LOWERCASE in the key; his data uses uppercase rows like `1-AA` — lowercase at the boundary)
- `ratio`: `1x1` | `1x3` | `1x5` (`x` replaces `:`). 8stp has no speed-ratio axis: always `1x1` in the key; the resolver treats a missing `speedRatio` on an 8stp transcription entry as `1:1`.
- `shape`: `diamond` | `box`
- `variant`: `base` | `anti` (`anti` ⇔ `isAnti: true` in the transcription)

Example: `vtg.1-1.1x1.diamond.base`. Parser rules: all-lowercase; **extra dot-separated fields beyond the fifth are ignored** (forward compat); anything malformed → `null` (never a guess). Both repos document this grammar (tka: `docs/research/spiroanim/bridge.md`; spiroanim: the PR adds it to `docs/`).

---

# Part A — Composer half (`E:/worktrees/tka-platform/spiroanim-bridge`)

Reference files (read FIRST, in this order):
1. `tests/unit/spiroanim-72-validate.test.ts` — the proven recipe for turning transcription steps into full motion data (`calculateEndOrientation` chaining from `@tka/sequence-engine/core`).
2. `scripts/import-spiroanim-eight-step.cjs` — the importer that already built real `SequenceData` from this exact transcription shape (72 8stp cells shipped to the library). Mirror its field construction.
3. `src/routes/sequence/[id]/SequenceViewerPage.svelte` (+ its `+page.ts`) — the existing thin standalone host; the new route mirrors its inline-encoded branch (resolve `SequenceData` first, then mount `SequenceViewerOrchestrator` → `SequenceViewerShell`).
4. `src/lib/shared/navigation/services/sequence-hydrator.ts` — `hydrateSequence(decoded, { loopDetector })`, pure, derives letters/positions/LOOP/placement/gridMode.
5. `src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte` — the host prop seam (`onClose`, `navigation`, `contextContent` snippet, `openAppHref`, …).
6. `tests/unit/sequence-viewer-shell-contract.test.ts` — HOSTS map + scan-exclusion arrays to EXTEND (never loosen).
7. `docs/research/spiroanim/tka-transcription.json` — 1,584 entries: `{concept, reference, speedRatio, isAnti, shape, word, steps: [{letter, startPosition, endPosition, swapped, blueTurns, redTurns}]}`.
8. `src/lib/shared/foundation/utils/word-simplifier.ts` — `simplifyRepeatedWord`.

File layout (route-support feature, NOT an app tab — no module scaffold, no nav registration):

```
src/lib/features/spiroanim-bridge/
  domain/cell-key.ts            # parse/format, pure
  domain/return-links.ts        # cellKey -> spiroanim /player URL (vendored data)
  services/resolve-cell.ts      # cellKey -> hydrated SequenceData | null
src/routes/from/spiroanim/[cellKey]/
  +page.ts                      # dynamic-import data, resolve, never throw
  +page.svelte                  # thin third shell host + honest error state
tests/unit/spiroanim-bridge-cell-key.test.ts
tests/unit/spiroanim-bridge-resolver.test.ts
```

### Task A1: cellKey domain module

**Files:** Create `src/lib/features/spiroanim-bridge/domain/cell-key.ts`, `tests/unit/spiroanim-bridge-cell-key.test.ts`

- [ ] **Step 1: Write the failing tests** — round-trip every transcription entry's identity into a key and back; malformed keys (`""`, `vtg.9-9.1x1.diamond.base`, `vtg.1-1.2x1.diamond.base`, `poi.1-1.1x1.diamond.base`, uppercase input, missing fields) return `null`; a key with a SIXTH dot-field still parses (forward compat).

```ts
import { describe, expect, it } from "vitest";
import { formatCellKey, parseCellKey } from "$lib/features/spiroanim-bridge/domain/cell-key";
import transcription from "../../docs/research/spiroanim/tka-transcription.json";

describe("spiroanim bridge cell keys", () => {
  it("round-trips every transcription entry", () => {
    for (const entry of transcription as any[]) {
      const key = formatCellKey({
        concept: entry.concept,
        reference: entry.reference,
        speedRatio: entry.speedRatio ?? "1:1",
        shape: entry.shape,
        isAnti: entry.isAnti === true,
      });
      const parsed = parseCellKey(key);
      expect(parsed, key).not.toBeNull();
      expect(parsed!.concept).toBe(entry.concept);
      expect(parsed!.reference.toLowerCase()).toBe(String(entry.reference).toLowerCase());
    }
  });
  it("rejects malformed keys", () => {
    for (const bad of ["", "vtg.9-9.1x1.diamond.base", "vtg.1-1.2x1.diamond.base",
      "poi.1-1.1x1.diamond.base", "VTG.1-1.1x1.diamond.base", "vtg.1-1.1x1.diamond",
      "vtg.1-1.1x1.pyramid.base", "vtg.1-1.1x1.diamond.wild"]) {
      expect(parseCellKey(bad), bad).toBeNull();
    }
  });
  it("ignores unknown trailing fields", () => {
    expect(parseCellKey("vtg.1-1.1x1.diamond.base.future-field")).not.toBeNull();
  });
});
```

(Adjust the JSON import path/mechanics to match how existing unit tests in `tests/unit/` load `docs/research/spiroanim/*.json` — `spiroanim-72-validate.test.ts` shows the working pattern.)

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/unit/spiroanim-bridge-cell-key.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement**

```ts
export type BridgeConcept = "vtg" | "qtr" | "8stp";
export interface ParsedCellKey {
  concept: BridgeConcept;
  reference: string;      // lowercase, e.g. "1-1" or "1-aa"
  speedRatio: "1:1" | "1:3" | "1:5";
  shape: "diamond" | "box";
  isAnti: boolean;
}

const VTG_REF = /^[1-6]-[1-6]$/;
const EIGHT_STEP_REF = /^[1-8]-(aa|ae|ai|ea|ee|ei|ia|ie|ii)$/;
const RATIOS: Record<string, ParsedCellKey["speedRatio"]> = { "1x1": "1:1", "1x3": "1:3", "1x5": "1:5" };

export function parseCellKey(raw: string): ParsedCellKey | null {
  if (typeof raw !== "string" || raw !== raw.toLowerCase()) return null;
  const parts = raw.split(".");
  if (parts.length < 5) return null;
  const [concept, reference, ratio, shape, variant] = parts; // extra fields ignored
  if (concept !== "vtg" && concept !== "qtr" && concept !== "8stp") return null;
  const refOk = concept === "8stp" ? EIGHT_STEP_REF.test(reference) : VTG_REF.test(reference);
  if (!refOk) return null;
  const speedRatio = RATIOS[ratio];
  if (!speedRatio) return null;
  if (concept === "8stp" && ratio !== "1x1") return null;
  if (shape !== "diamond" && shape !== "box") return null;
  if (variant !== "base" && variant !== "anti") return null;
  return { concept, reference, speedRatio, shape, isAnti: variant === "anti" };
}

export function formatCellKey(cell: {
  concept: BridgeConcept; reference: string;
  speedRatio: string; shape: string; isAnti: boolean;
}): string {
  const ratio = cell.concept === "8stp" ? "1x1" : cell.speedRatio.replace(":", "x");
  return [cell.concept, cell.reference.toLowerCase(), ratio, cell.shape, cell.isAnti ? "anti" : "base"].join(".");
}
```

- [ ] **Step 4: Run to verify pass**, then **Step 5: Commit** — `git commit -m "feat(spiroanim-bridge): cellKey parse/format domain" -- src/lib/features/spiroanim-bridge/domain/cell-key.ts tests/unit/spiroanim-bridge-cell-key.test.ts`

### Task A2: Resolver — cellKey → hydrated SequenceData

**Files:** Create `src/lib/features/spiroanim-bridge/services/resolve-cell.ts`, `tests/unit/spiroanim-bridge-resolver.test.ts`

- [ ] **Step 1: Read references 1, 2, 4** (validate test, importer, hydrator) end to end. The importer is the ground truth for constructing steps (motionType, rotation direction, per-hand attributes) from `{letter, startPosition, endPosition, blueTurns, redTurns, swapped}`; the validate test is the ground truth for orientation chaining.
- [ ] **Step 2: Write the failing test** — for ALL 1,584 transcription entries: `resolveCell(formatCellKey(entry))` returns a sequence whose `word` equals `entry.word`, whose step count equals `entry.steps.length`, and whose per-step orientation chain is continuous (each step's start orientation equals the previous step's `calculateEndOrientation` result — same assertion style as `spiroanim-72-validate.test.ts`). Also: `resolveCell("vtg.9-9.1x1.diamond.base")` → null; a well-formed key absent from the transcription → null.
- [ ] **Step 3: Run to verify failure.**
- [ ] **Step 4: Implement** `resolveCell(key: string)`:
  1. `parseCellKey`; null → null.
  2. Find the transcription entry matching `(concept, reference case-insensitively, speedRatio (default "1:1" for 8stp), shape, isAnti)`. None → null.
  3. Build `SequenceData` exactly the way `scripts/import-spiroanim-eight-step.cjs` does (adapted to TS + current factories: `createSequenceData()` from the sequence-data module, steps with derived orientations via `calculateEndOrientation` from `@tka/sequence-engine/core`).
  4. Run the result through `hydrateSequence(built, { loopDetector })` per `sequence-hydrator.ts` so letters/positions/LOOP/placement/gridMode are derived by the canonical owner — do NOT hand-derive what the hydrator owns.
  5. Return `{ sequence, entry }` (the entry powers provenance labels).
  The transcription JSON must be imported by the CALLER (route `+page.ts` via dynamic `import()`) and passed in, so the 1,584-entry JSON stays out of the main bundle (`reference_bundle_size_levers`: static JSON imports bloat the app chunk). Signature: `resolveCell(key: string, transcription: TranscriptionEntry[])`.
- [ ] **Step 5: Run to verify pass** (this is the heavyweight proof — 1,584 round-trips). **Step 6: Commit** with pathspec.

### Task A3: Return-links module

**Files:** Create `src/lib/features/spiroanim-bridge/domain/return-links.ts`; vendored data `docs/research/spiroanim/vtg-qtr-deep-links.json` arrives from Part B Task B1 (keyed by cellKey, values are full `https://spiroanim.com/player?...` URLs).

- [ ] **Step 1:** Implement `getReturnLink(key: ParsedCellKey): string | null`:
  - vtg/qtr: look up `formatCellKey(key)` in `vtg-qtr-deep-links.json`.
  - 8stp: look up the legacy `eightstep-deep-links.json` (keyed `"1-AA"` uppercase): `key.reference.toUpperCase()` → URL. Only diamond/base 8stp links exist; anything else → null.
  - Missing entry → null (the route simply omits the return link — graceful absence, never a guessed URL).
  Both JSONs are dynamic-imported by the route and passed in (same bundle rule as A2).
- [ ] **Step 2:** Unit test inside the resolver test file: every diamond/base catalog cell yields a non-null return link once B1's artifact lands (skip-with-reason if the file is not yet present so A-side work isn't blocked); URLs must start `https://spiroanim.com/player?`.
- [ ] **Step 3: Commit** with pathspec.

### Task A4: The route — thin third shell host

**Files:** Create `src/routes/from/spiroanim/[cellKey]/+page.ts`, `+page.svelte`

- [ ] **Step 1: Read references 3, 5, 6.** The `/sequence/[id]` host is the template: it resolves `SequenceData` BEFORE mounting `SequenceViewerOrchestrator` (children snippet receives ctx) wrapping `SequenceViewerShell`.
- [ ] **Step 2: `+page.ts`** — `export const load`: dynamic-import the two JSON artifacts + resolver, call `resolveCell`. NEVER throw for unknown keys: return `{ status: "resolved", sequence, entry, returnLink }` or `{ status: "unknown", cellKey }`. Set `export const prerender = false`.
- [ ] **Step 3: `+page.svelte`** — mirror `SequenceViewerPage.svelte`'s host wiring:
  - `<svelte:head>`: `<meta name="robots" content="noindex" />` and a title using `simplifyRepeatedWord(entry.word)`.
  - Resolved state: mount the orchestrator + `SequenceViewerShell` with `onClose` → `goto("/")`, `navigation` back-to-home, `openAppHref`, and a `contextContent` snippet rendering provenance: `Opened from SpiroAnim · <concept label> cell <reference> · <ratio>` plus (when non-null) an anchor styled as a button (per `clickables-look-like-buttons.md` — reuse the shell-adjacent button styles the `/sequence` host uses, no new primitive) labeled "View in SpiroAnim" with `href={returnLink}` `target="_blank"` `rel="noopener"`.
  - Unknown state: an honest centered card — "No bridge entry for `<cellKey>`. This link may come from a newer SpiroAnim version." with two button-styled links: `https://spiroanim.com` and `/` home. No redirect, no fallback sequence.
  - The host declares NO `--theme-*`/`--semantic-*` CSS variables and imports NO shell chrome internals (contract).
  - Displayed words go through `simplifyRepeatedWord` (grep the diff for `.word` before committing).
- [ ] **Step 4: Extend the shell contract test** — add the new host file path to the `HOSTS` map in `tests/unit/sequence-viewer-shell-contract.test.ts` and to the scan-exclusion array, per the structure already there. Do not touch `CHROME_INTERNALS`/`SHELL_MARKUP_MARKERS`. Run it: `npx vitest run tests/unit/sequence-viewer-shell-contract.test.ts` → PASS.
- [ ] **Step 5: Full unit suite for touched areas + `npm run check:fast`** (one pass; capture to a log and grep for errors — do not run repeated full checks). Fix everything yours.
- [ ] **Step 6: Commit** route + contract-test edit with pathspec.

### Task A5: bridge.md documentation update

- [ ] Append a "Cell-identity bridge route" section to `docs/research/spiroanim/bridge.md`: the grammar table from the top of this plan, the forward-compat rule, the return-link vendoring note (v11 links for vtg/qtr, legacy v6 for 8stp — his decoder is version-aware), and the route's error behavior. Commit with pathspec.

---

# Part B — SpiroAnim half (`E:/worktrees/spiroanim/tka-bridge`)

His AGENTS.md binds everything here: Composition API, `<script setup lang="ts">`, setup-style Pinia, no `any`, semantic color tokens only, tests in `__tests__/` under the owning module, explicit vitest imports, `data-role` selectors in tests. Validation before done: `npm run format`, `npm run lint`, `npm run test:unit`, `npm run type-check`, `npm run build`.

### Task B1: Generate VTG/QTR return links with HIS codec (scratch — not part of the PR)

- [ ] **Step 1:** In the spiroanim worktree, create a THROWAWAY spec `src/__scratch__/generate-links.spec.ts` (any path vitest picks up) that:
  - loads the codec at CURRENT version: `loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)` (v11) from `src/services/query/versions`, `useBaseQS`, `useSpiroAnimQS` (see `src/stores/useQSMainStore.ts` for the exact composition);
  - enumerates `row 1-6 × col 1-6 × speedRatio ∈ {"1:1","1:3","1:5"} × isAnti ∈ {false,true}`;
  - builds `createVtgPreviewAnimation({ reference, speedRatio, isAnti })` from `src/features/vtg/createVtgAnimation.ts` and `createQtrPreviewAnimation({ reference, speedRatio, isAnti, quarters: 1 })` from `src/features/vtg/qtr/createQtrAnimation.ts`;
  - for each non-undefined animation: `const query = qs.encodeQS(animation, false)`; `const url = \`https://spiroanim.com/player?\${new URLSearchParams(query)}\``; round-trip through `decodeQS` and re-encode — assert byte-identical;
  - keys each URL by the tka cellKey (`<concept>.<row>-<col>.<ratioWithX>.diamond.<base|anti>` — his VTG/QTR catalog is diamond-only; skip box) and writes the map with `fs.writeFileSync` to `C:/Users/Austen/AppData/Local/Temp/claude/E--tka-platform/2f43c332-9a5a-4945-9784-8283346857f0/scratchpad/vtg-qtr-deep-links.json`.
- [ ] **Step 2:** `npx vitest run <that spec>` → PASS; confirm the JSON has 216 vtg + 216 qtr entries MINUS any combos his builders return `undefined` for (log the skipped count — no silent truncation).
- [ ] **Step 3:** Copy the artifact to `E:/worktrees/tka-platform/spiroanim-bridge/docs/research/spiroanim/vtg-qtr-deep-links.json`, commit it THERE (pathspec), then DELETE the scratch spec and verify `git status --short` in the spiroanim worktree is clean.

### Task B2: `buildComposerUrl` pure module + snapshot test

**Files:** Create `src/features/kinetic-alphabet/composerBridge.ts`, `src/features/kinetic-alphabet/__tests__/composerBridge.spec.ts`

- [ ] **Step 1:**

```ts
export interface ComposerCell {
  concept: "vtg" | "qtr" | "8stp";
  reference: string;            // e.g. "1-1" or "1-AA"
  speedRatio?: "1:1" | "1:3" | "1:5"; // absent for 8stp
  shape?: "diamond" | "box";    // defaults to "diamond"
  isAnti?: boolean;
}

const COMPOSER_ORIGIN = "https://tkaflowarts.com";

export const buildComposerUrl = (cell: ComposerCell): string => {
  const ratio = cell.concept === "8stp" ? "1x1" : (cell.speedRatio ?? "1:1").replace(":", "x");
  const key = [
    cell.concept,
    cell.reference.toLowerCase(),
    ratio,
    cell.shape ?? "diamond",
    cell.isAnti ? "anti" : "base",
  ].join(".");
  return `${COMPOSER_ORIGIN}/from/spiroanim/${key}`;
};
```

- [ ] **Step 2:** Spec enumerates EVERY catalog cell (vtg 6×6×3, qtr 6×6×3, 8stp 8×9, plus anti variants) and pins each emitted URL via `expect(urls).toMatchInlineSnapshot()` or an exhaustive literal expectation table — key drift must fail his CI, not a user's click. Explicit vitest imports, no globals. Run → PASS.
- [ ] **Step 3: Commit** with pathspec.

### Task B3: Matched-cell plumbing (panes → SpiroAnim.vue → AnimPlayer prop)

**Files:** Modify `src/features/concepts/components/PatternMatrixPane.vue`, `src/features/eight-step/components/EightStepPane.vue`, `src/features/vtg/components/VtgPane.vue`, `src/features/concepts/components/ConceptsPane.vue`, `src/components/SpiroAnim/SpiroAnim.vue`, `src/components/SpiroAnim/AnimPlayer.vue`

Today "the loaded animation matches a catalog cell" exists only as private pane state (`selectedCell`/`selectedCellReference` refs), deliberately not re-emitted during hydration. Add an ADDITIVE event — never touch the existing `patternSelect` contract or its suppression:

- [ ] **Step 1:** In `PatternMatrixPane.vue`: a `watch` over `[selectedCellReference, isAnti, speedRatio]` (and whatever the pane's "matched vs manual" computed is) that emits `composerCellChange` with a `ComposerCell | null` payload — null whenever there is no selected/matched cell for the current animation. Emit OUTSIDE the pattern-emit suppression (this event describes state, it does not apply a pattern; hydration-driven matches MUST fire it). VTG emits `concept: "vtg"` or `"qtr"` per the pane's qtr mode.
- [ ] **Step 2:** Same in `EightStepPane.vue` (`concept: "8stp"`, include its local `shape` ref).
- [ ] **Step 3:** Forward the event: `VtgPane.vue` (pass-through like `forwardSelection`) → `ConceptsPane.vue` (re-emit; emit `null` when the active concept switches to one with no cell state, e.g. `to`/`tka` keeps last known — see B5) → `SpiroAnim.vue` holds `const composerCell = ref<ComposerCell | null>(null)` and passes `:composer-cell="composerCell"` into `AnimPlayer`.
- [ ] **Step 4:** Component test at the `ConceptsPane` level (their convention: real children, `data-role` selectors, `flushPromises`/`vi.waitFor` for the matching worker): selecting a VTG tile emits `composerCellChange` with the right reference; switching animation to an unmatched one emits null. Follow `ConceptsPane.spec.ts` setup patterns exactly (fresh Pinia, `localStorage.clear()`).

### Task B4: The TKA chip in `AnimPlayer.vue`

- [ ] **Step 1:** Add to the non-minimal template, sibling of `.fps`/`.aspect-tooltip`, using their exact conventions:

```vue
<AppTooltip v-if="!minimal && composerCell" class="tka-chip-tooltip" placement="bottom">
  <template #activator="{ props: tooltipProps }">
    <a
      v-bind="tooltipProps"
      class="tka-chip"
      :href="composerUrl"
      target="_blank"
      rel="noopener"
      aria-label="Open in Flow Arts Composer"
      data-role="tka-chip"
    >TKA</a>
  </template>
  <template #html>Open in Flow Arts Composer</template>
</AppTooltip>
```

with `const composerUrl = computed(() => (props.composerCell ? buildComposerUrl(props.composerCell) : undefined))`. Styling: positioned `top: 46px; right: calc(34px + 2px);` (preserve their comment: `/* Clear the 34px-wide side controls and their 2px right inset. */`), lit state uses the existing semantic pair `--color-pattern-mode-active` / `--color-pattern-mode-active-border` with `color: var(--color-on-action-primary)`, `border-radius: var(--radius-sm)`, `transition: var(--transition-fast)`, hover raises to `--color-action-primary`. No raw colors, no new tokens. The chip renders only when a cell is matched (`v-if`), so there is no unlit state to design.
- [ ] **Step 2:** Component test: mounting `AnimPlayer` with `composerCell` set shows `[data-role="tka-chip"]` with the correct `href`; without it, absent; `minimal` mode never shows it.
- [ ] **Step 3:** Run his validation ladder for the touched files; commit B3+B4 together with pathspec (they are one behavior).

### Task B5: KineticAlphabetPane upgrade

**Files:** Modify `src/features/kinetic-alphabet/components/KineticAlphabetPane.vue`; create `src/features/kinetic-alphabet/components/__tests__/KineticAlphabetPane.spec.ts`; update the pinned placeholder assertions in `src/features/concepts/components/__tests__/ConceptsPane.spec.ts`

- [ ] **Step 1:** Replace the placeholder copy. Keep the card layout, mark, container queries, and token usage he already wrote (his design, his pane). New content, exactly this copy (MCP-grounded this session; **flagged for Austen's verbatim approval before the PR opens** — if he edits a word, the component changes before the PR does):
  - Eyebrow: `Notation bridge`
  - H1: `The Kinetic Alphabet`
  - Lede: `TKA writes prop motion as letters. Every pattern in this app's concept catalogs corresponds to a TKA letter sequence.`
  - Body: `VTG patterns land in letters A–L, quarter patterns in M–V. Hands at opposite points is alpha, hands at the same point is beta, and a right angle between them is gamma.`
  - Action row: when a cell is matched (prop `composerCell`, threaded from `ConceptsPane` the same way as B3), a button-styled external link `Open <label> in Flow Arts Composer` via `buildComposerUrl`; always a second link `About TKA → https://tkaflowarts.com/guide` (`target="_blank"` `rel="noopener"`).
  - Remove the `tka-development-note` block ("Austin might be working on something for us...") — it is superseded by the real content.
- [ ] **Step 2:** New dedicated spec asserting: title renders, action link appears with correct href when `composerCell` is provided, guide link always present, no `patternSelect` emitted. Update `ConceptsPane.spec.ts`'s placeholder test to the new copy (it currently pins "Possibly coming soon" and the note verbatim — those assertions must change WITH this diff, not be deleted).
- [ ] **Step 3:** Validation ladder; commit with pathspec.

### Task B6: ConceptDocsMenu entry

- [ ] **Step 1:** In `src/features/concepts/components/ConceptDocsMenu.vue`, add a third `role="menuitem"` anchor after VTG3, following the exact modifier-class pattern:

```vue
<a
  class="concept-docs-menu__link concept-docs-menu__link--tka"
  href="https://tkaflowarts.com/guide"
  target="_blank"
  rel="noopener"
  role="menuitem"
>
  The Kinetic Alphabet
</a>
```

with `--tka`'s `border-inline-start-color: var(--color-element-water);` and the same scoped hover/focus rules as its siblings. External URL is a literal (no `returnQuery` — no round-trip needed).
- [ ] **Step 2:** Extend `ConceptDocsMenu.spec.ts` (their existing spec) with the new entry's presence + href + `rel`. Validation ladder. Commit with pathspec.

### Task B7: Full validation + PR body draft

- [ ] `npm run format`, `npm run lint`, `npm run test:unit`, `npm run type-check`, `npm run build` — ALL green, output captured.
- [ ] `git status --short` — only task-owned files.
- [ ] Write the PR body to `E:/worktrees/spiroanim/tka-bridge/.git/PR_BODY.md` (kept out of the tree): what the bridge does, the cellKey grammar, screenshots placeholder markers to be filled by the orchestrator's visual pass, test evidence, and a note that the Composer route is already live. **Do NOT push and do NOT open a PR** — the orchestrator handles the fork push; the PR itself waits for Austen's DM to Mentive.

---

# Part C — Orchestrator-only (visual verification, integration, delivery)

NOT delegated (`visual-verification-mandatory.md` forbids delegating visual judgment).

- [ ] **C1:** Composer route: own vite server from the tka worktree on a free port (resource-budget gates first; reap the server the same turn). Chrome DevTools MCP via `scripts/launch-chrome-debug.ps1`; `emulate` all seven viewports (3840×2160, 2560×1440, 1920×1080, 1440×900, 820×1180, 960×412, 375×667) on both the resolved state (one vtg, one qtr, one 8stp cell) and the error state; webp/70 screenshots, read them.
- [ ] **C2:** SpiroAnim: `npm run dev` from HIS worktree (his repo, his port — not :5173; reap after), verify chip lit/unlit, pane, docs menu at phone-portrait through desktop-wide; screenshots for the PR body.
- [ ] **C3:** E2E: click the chip in the local SpiroAnim build → local Composer route renders the same cell (production URL swap verified by code reading + the live check after deploy).
- [ ] **C4:** Integrate: merge `claude/spiroanim-bridge` → `main` in the primary checkout (check `git status` overlap first), push (push = CF Pages deploy), verify the live route at `https://tkaflowarts.com/from/spiroanim/vtg.1-1.1x1.diamond.base`, then remove the tka worktree.
- [ ] **C5:** Push `claude/tka-bridge` to the `austencloud/spiroanim` fork (no PR). Keep the spiroanim worktree for the morning.
- [ ] **C6:** Morning report: browser pane on the live route, clickable links, screenshots, the pane copy verbatim for approval, and the two follow-up gates (DM to Mentive → open PR).
