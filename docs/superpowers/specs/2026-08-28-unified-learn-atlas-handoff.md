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

## Believed done - unverified

- Responsive composition of the new Learn map. Static checks are green, but the
  required live viewport sweep is still blocked by the long-running 5173
  process retaining the earlier failed dependency import in memory.
- Stable place selection, lesson entry, in-product return, and browser
  back/forward behavior. These have focused route/contract tests but still need
  the live interaction pass.

## In flight

- Branch: `codex/unified-learn-atlas`
- Worktree: `E:/tka-platform-unified-learn-atlas`
- Integrated main commit: `38bdf03b22`
- Live proof tab: in-app browser at
  `https://dev.tkaflowarts.com/learn/concepts?place=1.1`
- Blocker: restart Austen's 5173 dev process through Agent Hub so its Node ESM
  cache releases the already-repaired `zod/v4` failure. Do not kill or restart
  the process from a shell.
- After restart: complete the required viewport, interaction, and console sweep;
  fix any visual defects in this worktree; commit and merge only the follow-up.

## Loose ends (ranked)

1. Restart the 5173 dev process through Agent Hub, then verify navigation
   confidence and the full viewport matrix in the in-app browser.
2. Fix any issues that the visual/interaction sweep exposes and merge that
   focused follow-up into `main`.
3. Have Austen physically test each lesson before changing its status to
   `CONFIRMED`.
4. Classify games against official TKA levels only after the concept and level
   evidence exists; keep unknown games `unclassified`.
5. Extend the same concept-place contract beyond the first Level 1 slice rather
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
- Port 5173 cannot prove the merged UI until its existing Node process is
  restarted. The filesystem dependency repair is complete; repeated browser
  retries alone will keep returning the cached `zod/v4` import failure.
