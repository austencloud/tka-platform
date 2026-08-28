# Unified Learn and Atlas - Handoff (2026-08-28)

## Mission

Unify Interactive Lessons, Play, the written Guide, the Kinetic Atlas, the
Letter Codex, TIKA, and Composer handoffs around one concept graph. The Atlas is
the bird's-eye map of the same journey the lessons teach. The governing design
is [`active/2026-08-28-unified-learn-atlas-design.md`](active/2026-08-28-unified-learn-atlas-design.md).

## Done - verified

- The governing design is committed in `b2cb81c741`. It defines the Atlas as
  the bird's-eye map, lessons as the guided journey, one concept-place contract,
  official TKA level vocabulary, and human confirmation gates.
- Game-local progression was renamed from levels to challenges in
  `6edf5e581c`. Current games are explicitly `unclassified` against TKA levels;
  legacy local and Firestore progress still migrates without data loss.
- The first official Level 1 concept map was implemented in `69c34007ec`.
  Stable `?place=1.x` routes select official knowledge-graph nodes and compose
  the real lesson, Guide, Letter Atlas, and Composer owners where evidence
  exists. Unmapped and partial places say so instead of inventing coverage.
- Focused verification is green: six test files, 49 tests, plus
  `svelte-check` with 0 errors and 0 warnings. Source-copy tests also guard
  against reintroducing game-local Level labels.
- The three implementation commits were merged into `main` as `38bdf03b22`
  without changing Austen's existing `pnpm-lock.yaml` edit.
- The broken primary dependency install was repaired from the existing frozen
  lock without changing its hash: `@ai-sdk/svelte@4.0.70` and `zod@4.3.6` now
  resolve correctly from a fresh Node process.
- The first live Atlas correction is committed in `7c8d41a42f`. The Level 1
  concepts now read as one connected route, including the truthful 1.5/1.6
  prerequisite branch, instead of eight generic cards. The selected 1.1 place
  uses the real shared Diamond and Box grid renderer. Compact layouts use a
  scrollable stop rail; the public landing uses normal page flow instead of a
  viewport-height inner scroller.
- The Atlas-to-lesson return contract is verified in `7c8d41a42f`: selecting
  1.5 produced `?place=1.5`, opening its lesson produced
  `/learn/concepts/type1-abc-ghi?place=1.5`, and Back plus reload both returned
  to the Atlas with 1.5 selected. Type 1, Motions, and Positions now return to
  the Atlas when their internal lesson navigation is already at the first step.
- Follow-up verification for `7c8d41a42f` is green: `svelte-check` reported 0
  errors and 0 warnings; the focused concept-place suite passed 6/6; live
  in-app browser checks covered 375x667, 960x412, 820x1180, 1440x900,
  1920x1080, 2560x1440, and 3840x2160 with no page-width overflow and no
  console errors. The only console messages were the expected local PostHog
  no-key warnings.

## Believed done - unverified

- The revised route has objective responsive and interaction proof, but Austen
  has not yet completed the required human confidence pass. Do not mark any
  lesson `CONFIRMED` from the automated checks.

## In flight

- Branch: `codex/unified-learn-atlas`
- Worktree: `E:/tka-platform-unified-learn-atlas`
- Latest implementation commit: `7c8d41a42f`
- Live proof tab: in-app browser at
  `http://127.0.0.1:5187/learn/concepts?place=1.1`
- The task-owned 5187 Vite process exists only for verification and must be
  stopped before worktree cleanup. The primary 5173 dev server was not running
  at the end of this slice; do not start or restart it from a shell.

## Loose ends (ranked)

1. Have Austen physically test the landing route and the existing 1.1, 1.2,
   1.3, and 1.5 lessons before changing any status to `CONFIRMED`.
2. Give 1.4 Rotation Direction its own grounded concept-place experience. It is
   the next missing prerequisite before Letter Types and Orientations; do not
   jump ahead to styling all nine TKA levels.
3. Connect 1.6, 1.7, and 1.8 one at a time through the same registry and route
   contract. Each needs a real lesson/reference owner or an honest map-only
   state.
4. Add higher-level Atlas navigation only when the official knowledge graph and
   available resources can support a useful destination without pretending the
   material is taught.
5. Classify games against official TKA levels only after the concept and level
   evidence exists; keep unknown games `unclassified`.
6. Extend the same concept-place contract beyond the first Level 1 slice rather
   than creating another navigation system.

## Decisions already made

- On 2026-08-28, Austen approved unifying Learn, games, Atlas, Guide, Codex, and
  related tools into one interwoven product.
- On 2026-08-28, Austen required that "Level 2" mean TKA Level 2. Game-local
  progression must use distinct language so it cannot be confused with TKA
  curriculum levels.
- On 2026-08-28, Austen approved reliable human approval gates and requested a
  durable handoff so deep lesson polish cannot erase the bird's-eye goal.
- The Atlas is a map and review layer, not a prose glossary or a second lesson
  path.
- The Guide owns the linear journey and authored reference; concept places link
  to it contextually.
- Games are concept practice. Their global arcade can remain as an alternate
  entry point, but it is not a separate curriculum.
- Real artifacts and existing capability owners replace invented decorative
  diagrams.

## Gotchas

- `src/lib/features/learn/domain/concepts.ts` and
  `packages/domain/src/curriculum/knowledge-graph.ts` define different ID
  vocabularies. Do not merge them by string inference.
- `ConceptProgressTracker` and `PlayProgressStore` persist different progress
  shapes. Do not call either one unified mastery without a tested projection.
- Historical persisted game fields such as `levelNumber`, `starsByLevel`, and
  `levelsUnlocked` are migration inputs only. New UI and state use challenge
  vocabulary.
- The public Atlas currently groups glossary categories and must not be treated
  as curriculum truth.
- Only six lesson experiences are registered today. `docs/learn/concept-status.md`
  is the status authority, and `CONFIRMED` requires human interaction.
- The primary checkout at `E:/tka-platform` has an unrelated modified
  `pnpm-lock.yaml`. Do not touch or overwrite it.
- The public Learn route pulls a large client graph on a cold Vite start. The
  task-owned preview required one dependency-optimization reload before the
  interactive course replaced its prerendered fallback. Do not mistake that
  local cold-start cost for a missing Atlas render without checking the server
  and browser logs.
