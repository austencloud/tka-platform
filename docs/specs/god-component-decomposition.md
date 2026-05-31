# God Component Decomposition (Ceremony Refactor v2.0)

Date: 2026-05-31
Status: Draft — pending brainstorming pass
Scope: Codebase-wide decomposition of oversized `.svelte` components into focused
subcomponents + extracted `*.svelte.ts` state factories, gated by a ratcheting
line-count lint rule.

## Why this is "v2.0"

The enterprise-ceremony retirement (v1) made **services** legible to AI agents:
the killer metric was "3 files to understand a service (contract + impl + getter)
→ 1." It paid compounding rent because every future edit and every parallel agent
loads less and risks less.

God components are the inverse problem at the **component** layer. A 1,654-line
single-file Svelte component owns its template, its state, its data fetching, its
derived logic, and its inline `<style>` all at once. Any edit has the whole file
as its blast radius. No agent (and no human) can hold it in working memory, so
every change is slower, riskier, and more expensive than it should be.

This is also the truest *architectural* tell of AI-authored code. Verbose JSDoc
says "an AI typed this." A 1,600-line component says something worse: *nobody
decided where the boundaries go.* That is a planning failure, not a typing habit,
and it is the thing a senior reviewer forgives last.

Distinct from the comment-noise retirement (which is textual and cosmetic) and
from the ceremony retirement (which was service-layer structural). This is
component-layer structural.

## Problem (measured 2026-05-31, against the live tree)

| Threshold | `.svelte` files over it |
|---|---|
| > 400 lines | 441 |
| > 600 lines | 187 |
| > 800 lines | 66 (62 in production, 4 in `routes/test` scratch) |

Top offenders (production, excluding `routes/test`):

| Lines | File |
|---|---|
| 1654 | `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` |
| 1322 | `src/lib/features/lab/tabs/PathMandalaLab.svelte` |
| 1262 | `src/lib/features/museum/components/game/Museum3DScene.svelte` |
| 1193 | `src/lib/features/create/shared/components/sequence-actions/SequenceActionsPanel.svelte` |
| 1187 | `src/lib/features/tika/components/TikaReviewPanel.svelte` |
| 1179 | `src/lib/features/background-builder/components/OceanLab.svelte` |
| 1178 | `src/lib/shared/navigation/components/desktop-sidebar/ModuleQuickToggle.svelte` |
| 1157 | `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` |
| 1153 | `src/lib/shared/3d/components/controls/PerformerHubDetail.svelte` |
| 1140 | `src/lib/features/choreo-card/components/CatalogBrowser.svelte` |
| 1127 | `src/lib/features/mandala/MandalaModule.svelte` |
| 1114 | `src/lib/features/browse/creators/components/profile/ProfileAdminSection.svelte` |
| 1111 | `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte` |

(Full >800 list lives in the inventory script output, Phase 0.)

These are precisely the files that predate the state-management factory rule and
the primitive-discovery / never-hand-roll rules. The patterns to decompose *onto*
already exist and are enforced everywhere else.

## The target pattern already exists

This is not inventing new architecture. It is pushing the monoliths onto patterns
the codebase already establishes and enforces:

- **State extraction:** 300 `*.svelte.ts` state-factory modules already exist
  (`state-management` skill: factory + context). A god component's `$state` /
  `$derived` / `$effect` blocks move into a colocated `*.svelte.ts` factory.
- **Subcomponent extraction:** the primitive library is deep
  (`never-hand-roll.md`, chip consolidation, `FilterChipBase`,
  `SegmentedControl`). Repeated template regions become focused children, reusing
  existing primitives rather than re-inlining markup.
- **No new interaction patterns.** Decomposition is structural; it must not change
  rendered output or behavior.

## Goals

1. No production `.svelte` component over a target line budget (final target TBD in
   brainstorming; candidate ratchet 800 → 600 → 400).
2. State logic lives in `*.svelte.ts` factories, not inline in 1,000-line templates.
3. Repeated template regions become focused subcomponents that reuse existing
   primitives.
4. A lint gate that ratchets the ceiling down and never regresses (the
   `import-case-scan.cjs` / `worker-url-scan.cjs` guard model).
5. Zero behavior or visual change — pure structural decomposition.

## Non-Goals

- Rewriting component logic or changing rendered output.
- Touching inherently-complex components that are large for a real reason (3D
  scene graphs, shader hosts, full-canvas labs) without a decomposition that
  genuinely improves them — these get classified "keeper" with a stated reason,
  not force-split.
- Decomposing `routes/test/*` scratch/prototype pages (exempt; they are throwaway
  harnesses).
- The comment-noise retirement (separate, already specced) or any naming work.

## Phases

### Phase 0: Inventory + auto-classification (script)

Write `scripts/component-inventory.mjs` that, per `.svelte` file over the
threshold, reports:
- line count, and the split across `<script>` / template / `<style>`
- responsibility signals: count of `$state` / `$derived` / `$effect`, number of
  data-fetch calls (repository/getter calls), number of distinct top-level
  template regions, inline `<style>` line count
- a proposed classification:
  - **decompose** — mixed responsibilities, extractable state + repeated regions
  - **state-extract-only** — logic-heavy, template is already lean
  - **keeper** — inherently complex (3D/shader/canvas), large for a real reason

Deliverable: `scripts/component-manifest.json` + a human-readable dry-run list.
This manifest drives every subsequent phase, exactly as `ceremony-manifest.json`
drove v1.

### Phase 1: State extraction (lowest risk)

For "state-extract-only" + the state portion of "decompose": move `$state` /
`$derived` / `$effect` and their helpers into a colocated `*.svelte.ts` factory
per the `state-management` skill. Template keeps referencing the same names via
the factory's returned API. No template changes.

### Phase 2: Subcomponent extraction

For "decompose": pull repeated / self-contained template regions into focused
child components, reusing existing primitives (`primitive-discovery` first —
grep before creating). Smallest-blast-radius components first to build the
patterns, exactly like v1's smallest-module-first ordering.

### Phase 3: The ratcheting lint gate

Add an ESLint / custom check that fails CI when a production `.svelte` exceeds the
current ceiling (with an enumerated keeper allowlist). Ratchet: land at 800, then
lower to 600, then 400 as phases complete. Never regress — same lock-in model as
the v1 case-sensitivity guards.

### Phase 4: Validation

Per-batch: `npm run check` error count == baseline, scoped tests green, and a
visual spot-check on the decomposed component (it must render identically).
Final: full check + test suite + the gate passing at its target ceiling.

## Execution strategy

Parallel-agentic, same as v1: the work is mechanical-with-judgment and has clear
success criteria (renders identically, check stays green, gate passes). Each
component is independent. Smallest-first per phase. Per-batch rebase onto moving
`main`. Commit with explicit pathspec (shared-index safety rule).

## Expected outcomes

| Metric | Before | After (target) |
|---|---|---|
| `.svelte` > 800 lines (production) | 62 | 0 |
| `.svelte` > 600 lines | 187 | enumerated keepers only |
| `.svelte` > 400 lines | 441 | enumerated keepers only |
| Inline state in 1k-line templates | widespread | extracted to `*.svelte.ts` |
| Largest editable blast radius | 1,654 lines | bounded by the gate |
| Agent context cost per component edit | whole monolith | one focused file |

## Risks

1. **Forced-splitting an inherently-complex component** produces worse code than
   leaving it. Mitigated by the "keeper" classification with a stated reason.
2. **Behavior/visual drift** during extraction. Mitigated by zero-logic-change
   discipline + visual spot-check per batch.
3. **Prop-drilling explosion** if state is pushed down naively instead of into a
   context-provided factory. Mitigated by following the `state-management`
   factory + context pattern, not raw props.
4. **Reactivity subtleties** moving `$effect` out of a component into a
   `*.svelte.ts` module (cleanup, ordering). Needs care; the 300 existing
   factories are the reference.

## Open questions for brainstorming

- Final line ceiling: 400, 600, or a per-area budget?
- Does the gate apply to `routes/` page components or only `lib/` components?
- Keeper criteria: is "3D/shader/canvas" the only exemption, or are large
  data/config components (e.g. `tab-definitions.ts`-style) also exempt?
- Sequencing against in-flight feature work (the sequence-viewer + create
  subtrees have the most god components AND the most active development).
