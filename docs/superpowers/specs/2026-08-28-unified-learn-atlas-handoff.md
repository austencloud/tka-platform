# Unified Learn and Atlas - Handoff (2026-08-28)

## Mission

Unify Interactive Lessons, Play, the written Guide, the Kinetic Atlas, the
Letter Codex, TIKA, and Composer handoffs around one concept graph. The Atlas is
the bird's-eye map of the same journey the lessons teach. The governing design
is [`active/2026-08-28-unified-learn-atlas-design.md`](active/2026-08-28-unified-learn-atlas-design.md).

## Done - verified

Nothing is claimed complete yet. This handoff was created at the start of the
approved implementation so the broad goal survives deep lesson work.

## Believed done - unverified

None.

## In flight

- Branch: `codex/unified-learn-atlas`
- Worktree: `E:/tka-platform-unified-learn-atlas`
- Governing design: written, not yet committed or contract-tested
- Implementation: not started

## Loose ends (ranked)

1. Establish the canonical concept-resource registry and its first four concept
   mappings.
2. Add the terminology gate that reserves Level 1 through Level 9 for TKA and
   removes game-local Level labels from presentation.
3. Build the concept-centered Learn map/place shell by composing existing
   owners rather than duplicating them.
4. Connect Guide, practice, Letter Atlas, and Composer paths to the first slice.
5. Verify navigation confidence, progress truth, and the full viewport matrix.
6. Have Austen physically test each lesson before changing its status to
   `CONFIRMED`.

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
- The game registry's `levelNumber` means game difficulty, not TKA level.
- The public Atlas currently groups glossary categories and must not be treated
  as curriculum truth.
- Only six lesson experiences are registered today. `docs/learn/concept-status.md`
  is the status authority, and `CONFIRMED` requires human interaction.
- The primary checkout at `E:/tka-platform` has an unrelated modified
  `pnpm-lock.yaml`. Do not touch or overwrite it.
