# Codebase-Quality Audit Operation — Rolling Spec / Resume Doc

**Date:** 2026-06-16
**Status:** IN PROGRESS — 6 waves complete. Coverage **32.4% (77/238 targets)**.
Grade distribution: **A+ 31 · A 39 · B 7 · C 0 · F 0**. Resume from "How to run
the next wave" below.
**Owner of this doc:** the rolling audit operation (not a feature). Update the
numbers + wave log after each wave.

## What this is

A rolling, wave-based pass over the whole codebase that grades every target on
**8 dimensions**, fixes the real findings, verifies with a full typecheck, lands
scoped per-module commits, and re-grades. Each wave takes ~10-14 audit-sized
targets (one feature module or one `*/components` leaf each), runs parallel
evaluator subagents to grade, parallel fixer subagents to repair, then one
verification gate and one commit per scope.

The 8 dimensions, in the **canonical order** the tracker expects:
`Architecture, Code Quality, Svelte 5, Accessibility, UX States, UI Consistency, Performance, Security`.

Grade scale per dimension: `A+` = 0 real violations · `A` = 1-2 minor · `B` =
3-5 minor OR 1 moderate · `C` = multiple moderate OR 1 serious · `F` = systemic.

## The pipeline (one wave)

1. **Pick the batch.** `node scripts/audit-tracker.cjs --json` (top-20 prioritized;
   it caps at 20). Or `node scripts/audit-tracker.cjs targets | grep "Not audited"`.
   Pick NEW, non-overlapping, audit-sized targets — never a module AND its
   `*/components` (the module covers the components). Route oversized modules
   (`tooLarge`, >~40 files) to a `*/components` or other sub-scope. `campground`
   (1 file) and similar are trivial.
2. **Collect evidence (per target).** `node scripts/collect-evidence.cjs "<bare-target>" --out .audit-evidence/wave<N>-<safe>.json`.
   **CRITICAL: bare target paths** — `"features/store"`, NOT `"src/lib/features/store"`
   (the collector prepends `src/lib/`; a prefixed path double-prefixes and fails).
   `safe` = the target with `/`→`-`. The evidence JSON has `meta.fileCount` and a
   `summary` of raw regex match counts per dimension (these OVER-report).
3. **Evaluate (parallel subagents, model: `sonnet`).** One agent per target.
   Each reads its evidence JSON + the actual flagged lines IN CONTEXT, applies
   the calibration FP classes (below), grades 8 dims, and **writes**
   `.audit-evidence/wave<N>-result-<safe>.json` =
   `{"scope","grades":[8 in order],"issues":[{dimension,severity,file,line,description}],"notes"}`.
   (Sonnet is correct for rubric grading with pre-collected evidence. Have the
   agent WRITE the result file — don't parse free text.)
4. **Consolidate** the 11-12 result files into `.audit-evidence/wave<N>-issues.json`
   (a node one-liner; normalize any agent that emitted grades as objects instead
   of a flat array — festivals did this in wave 6).
5. **Triage.** Separate auto-fixable from must-flag: Blender-first geometry
   (needs GLB authoring, not a code fix), `{@html}` on internal-trusted SVG
   (accepted risk), genuine security that needs design work. Correct evaluator
   over-flags (see "Standing corrections").
6. **Fix (parallel subagents, OMIT model → inherits Opus 4.8).** One agent per
   target. Each reads its result JSON, fixes against the established patterns
   (below). Constrain each to edit ONLY its scope dir; no `npm check`/`build`;
   no `git add`/commit (the controller owns verification + commits).
7. **Verify (the gate).** ONE full `npm run check > /tmp/wave<N>check.log 2>&1`
   (cold, 2-3 min). Grep the log; fix any regressions the fixers introduced
   (common: a fixer using legacy `ComponentType` instead of Svelte 5 `Component`;
   through-`unknown` casts needed for schema/domain type divergence). Re-run
   until clean OR the only remaining error is a parallel-session file you didn't
   touch (leave + flag those — see Standing flags).
8. **Commit (scoped, per-module).** `git commit -m "fix(<scope>): ..." -- <dir-or-explicit-paths>`.
   These feature dirs are exclusive to the audit; the parallel refactor session
   works on effects/camera/fire/auth/api/sequence-viewer/browse-creators — never
   commit those. Shared files (`messages/en.json`) go with the owning scope.
   Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
9. **Re-grade + record.** `node scripts/audit-tracker.cjs record "<target>" --grades "A+,A,..." --notes "..."`
   (8 grades, canonical order). A dimension only improves if its issues were
   actually fixed; deferred items keep their grade. Then
   `node scripts/audit-tracker.cjs stats` for the new distribution.

## Calibration — false-positive classes (do NOT count as violations)

The scanner over-reports ~80%. These are NOT violations:
- `var(--token, #hex)` and `color-mix(in srgb, var(--token,#hex) N%, transparent)`
  — the PRESCRIBED token pattern. Hex inside a `var()` fallback is fine.
- A scoped / `:root` `--foo: #hex;` DEFINITION — that's defining a token.
- `aria-label` "missing" on an element that already has visible text.
- A timer cleared by the `$effect` cleanup return / `onDestroy`.
- `console.error`/`warn` paired with a toast, a rendered error state, or a throw.
- "secret"/"key"/"token" in a log string or var name — only flag a genuine
  credential exposure. (Stripe **price IDs are client-public** — not secrets.)
- JS data color values: palettes, Three.js material colors, brand colors,
  difficulty-tier tables, generative color math.
- Sub-12px font-size on FontAwesome / icon glyphs (`<i>`, chevrons) — EXEMPT.
  Only flag sub-12px on real TEXT.
- A `utils/` directory of PURE, stateless functions named for their contents
  (e.g. `seeded-rng.ts`) — NOT an architecture violation (see rule revision).
- Service-naming: `Orchestrator`/`Manager`/`Loader`/`Repository`/`Detector` etc.
  are SANCTIONED verb suffixes. Only the literal `Service` suffix is banned.

## Fixer patterns (use these — never hand-roll)

- Sub-12px TEXT → `font-size: var(--font-size-compact, 12px)` (icon glyphs exempt).
- Hardcoded accent/status color → `var(--token, #hex)` fallback; tints →
  `color-mix(in srgb, var(--token) N%, transparent)`. Confirm the token exists
  (`grep src/app.css`/`src/app.html`); scoped custom property if none.
  Tokens in play: `--theme-accent`, `--semantic-error/success/warning/info`,
  `--theme-panel-bg`, `--theme-text`, `--theme-stroke`, `--text-on-accent`,
  `--min-touch-target`, `--font-size-compact`.
- Single-select bar (exactly one active) → `SegmentedControl`
  (`src/lib/shared/3d/components/controls/SegmentedControl.svelte`).
- Multi-toggle independent booleans → `FilterChipBase` `mode="toggle"`
  (`src/lib/shared/browse/components/filter-chips/FilterChipBase.svelte`).
- <44px interactive target → `min-height: var(--min-touch-target)` or a
  `::before` hit-area overlay (don't grow the visual).
- Icon-only button → `aria-label`. Non-submit `<button>` → `type="button"`.
- CSS motion → `@media (prefers-reduced-motion: reduce)` guard.
- Swallowed error → `toast` (`$lib/shared/toast/state/toast-state.svelte`) or a
  rendered error state; keep return contracts.
- `as any`/`as unknown as` → proper type / union narrowing / `in`-guard. Through-
  `unknown` cast (with a comment) only for genuine schema↔domain divergence.
- `$derived(() => fn)` → `$derived.by(() => { ... })` (returns the value).
- Lazy component type → Svelte 5 `Component` from `"svelte"` (NOT legacy
  `ComponentType` — that fails the typecheck).
- NO `<input type="checkbox">` — button + `aria-pressed`/`role="switch"` + indicator.

## The utils/ rule revision (committed this operation, `faf09b5939`)

The blanket "no `utils/` directories, everything is a singleton service" rule was
dead letter (31 utils dirs existed; CLAUDE.md itself said to check
`src/lib/utils/`; a backlog spec proposed new `shared/utils/{math,format}.ts`).
Wrapping a stateless pure function in `getThingService().doThing()` is ceremony
that loses tree-shaking. **Revised** the `code-style` skill, `audit-rubric.md`,
and `module-auditor.md` to ban only the real anti-patterns: (1) junk-drawer
`utils.ts`/`helpers.ts` grab-bags, (2) stateful logic (cache/lifecycle/deps/
coordination) shipped as loose functions. Pure-function modules named for their
contents are explicitly fine. This re-graded create/browse/inbox Architecture
B→A+ (and others) since their `utils/` were pure-function modules.

## Wave log

- **Waves 1-4 (prior sessions):** shared/* + several feature modules. ~22.7%
  coverage reached. 25+ fixers, ~21 commits. (Targets incl. shared/audio, arena,
  application, create, effects, community, background, skewlab, browse, foundation,
  train, inbox, museum, 3d.)
- **Wave 5 (2026-06-13/14):** admin/components, archive, arena, assemble-lab,
  background-builder/components, campground, choreo-card/components, community,
  compose/components, compose/tabs/browse, connect. 122 issues, 13 commits.
  Every C climbed out. Coverage → 27.3%.
- **Wave 6 (2026-06-15/16):** coven-hub, festivals/components, fuse,
  gallery-generator, hall-of-shame, hand-paths, landing, mandala, premium,
  social, store, write. 108 issues (3 serious: gallery-generator 71 hardcoded
  colors, hall-of-shame banned `<input type=checkbox>` age gate, premium silent
  checkout-error swallow). 12 commits. Coverage → 32.4%.

## Standing flags (deferred, NOT yet fixed)

- **Blender-first set dressing** (code-fix can't resolve — needs `.blend`→GLB):
  `archive/TabletExhibit.svelte` (procedural pedestal); `coven-hub/CovenStation.svelte`
  fallback platform (degradation behind an existing GLB path — acceptable).
- **store** Code Quality stays **B**: 3 missing factory return types + `as Product`
  Firestore casts were outside the wave-6 fix scope.
- **assemble-lab** Code Quality stays **B**: `deriveMotionType` duplicates the
  shared `hand-path-motion-calculator` but is not a clean drop-in (different enum,
  needs gridMode, throws on out-of-set) — left with a rationale comment.
- **assemble-lab** `{@html}` prop SVG: internal trusted `propSvgLoader` — accepted
  risk, no sanitization lib forced.
- Several fixers minted token names not yet defined globally
  (`--semantic-success-strong`, `--color-gold`, `--fuse-gradient`, etc.). Harmless
  (resolve to the hex fallback today; become theme hooks if defined). A cleanup
  could define or normalize them.

## Standing corrections (evaluator over-flags to NOT action)

- `LocationSharingOrchestrator` — "Orchestrator" is sanctioned, not a banned suffix.
- Hardcoded Stripe **price IDs** — client-public by design, not a credential leak.
- Pure-function `utils/` dirs — not an Architecture violation (post rule revision).

## Parallel-session boundary

Another session runs a large refactor on `main` concurrently (zap effects, camera
`UnifiedCameraController`, fire effects, ceremony kebab-rename, auth, api routes,
sequence-viewer footers, browse/creators). **Never commit those files.** Their
in-flight typecheck errors are not the audit's to fix — flag with the one-line
fix and leave (e.g. wave-4 `UnifiedCameraController:426` `$effect` return; wave-5
`canvas2d-translator.test.ts` ZapIntent `style`, both since resolved upstream).
Always `git commit -- <explicit scope paths>`, never a bare commit (shared index).

## How to run the next wave (resume here)

1. `node scripts/audit-tracker.cjs --json` → pick ~12 new non-overlapping targets.
   Wave-7 candidates visible in the queue (verify sizes via collect-evidence):
   `features/levels`, `features/learn`, `features/lab/*` (constraint-layout-lab,
   disassemble-lab, phrase-effort-lab, trigrid-lab, vtg-lab), `features/poi`,
   `features/stage`, `features/store` (re-do CQ), `features/themes-lab`,
   `features/sticker-lab`, `features/promo-generator`, `features/voice-sessions`,
   `features/watch`, `features/village`, `features/retro/*`, `shared/analytics`,
   `shared/admin`. Skip already-audited modules and their `*/components`.
2. Run the pipeline above (steps 2-9).
3. Update this doc's coverage line + wave log after committing.

## Key files

- Tracker CLI: `scripts/audit-tracker.cjs` (`record`/`stats`/`targets`/`claim`/`--json`).
- Evidence collector: `scripts/collect-evidence.cjs` (BARE target paths).
- Rubric: `docs/reference/audit-rubric.md`. Auditor agent: `.claude/agents/module-auditor.md`.
- Per-wave ledgers + results: `.audit-evidence/wave<N>-issues.json`,
  `.audit-evidence/wave<N>-result-<safe>.json` (gitignored working data).
- Verification gate: `npm run check` (full svelte-check; the pre-commit gate).
