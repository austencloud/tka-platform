# Learning Letters Concept Lesson — Fable Handoff (2026-08-23)

## Mission

Replace the rejected `words-alpha-beta` Learn experience with a canonical,
useful lesson based on the actual **TKA 1: Learning Letters** deck. Austen
rejected the current result on 2026-08-23 and asked Fable to take over. Treat
the current implementation as evidence and salvage material, not as an
approved design.

## Done — verified

- Commit `26b150097b40e41852d579603d52ec0326fd4c5b` rebuilt the route and is an
  ancestor of both local `main` and `origin/main`. Verified on 2026-08-23 with
  `git merge-base --is-ancestor` against both refs.
- The commit added a focused loader contract test and updated the Learn lesson
  composition test. On 2026-08-22,
  `pnpm exec vitest run tests/unit/learn/canonical-concept-lessons.test.ts tests/unit/learn/learning-letters-loader.test.ts`
  passed 2 files and 7 tests.
- On 2026-08-22, `pnpm check` completed with 0 errors and 0 warnings.
- The current challenge renders actual `ChoreoCard` instances for all choices
  before selection and uses `TKAWordGlyph` for target identities. Screenshots
  from the rejected build still exist at:
  `C:/Users/Austen/AppData/Local/Temp/words-explore-3840-r2.webp`,
  `C:/Users/Austen/AppData/Local/Temp/words-challenge-1920.webp`, and
  `C:/Users/Austen/AppData/Local/Temp/words-challenge-375-four.webp`.
- A Lighthouse snapshot on 2026-08-22 scored 100 for accessibility and 100 for
  best practices. This is technical evidence only. It is not evidence that the
  experience is good or accepted.

## Believed done — unverified

- `loadCanonicalLearningLettersSequences()` returns the expected 19-word
  roster in family order. The unit test proves the behavior with a mocked
  family resolver, but the implementation does **not** load the named deck
  itself. It reconstructs the roster from each family's `0|0` card. Verify the
  actual deck owner and replace this reconstruction if a deck-backed source is
  available.
- The answer layouts showed 3-up on tablet/desktop and 2-by-2 on a 375px phone
  during the 2026-08-22 viewport pass. Austen nevertheless rejected the result,
  so do not treat responsive screenshots as product approval.
- The live UI avoids new explanatory domain prose. The copy review remains
  closed, but the routine labels have not received explicit line-by-line
  approval from Austen.

## In flight

- No uncommitted changes remain in the nine files from commit `26b150097b`.
- Work is on shared `main` in `E:/tka-platform`; there is no feature branch or
  worktree.
- The repository has hundreds of unrelated modified, untracked, deleted, and
  staged files from other sessions. Do not reset, stash, stage, or commit them.
  Every commit must use explicit pathspecs.
- At handoff-writing time, local `HEAD` was
  `1e6b57453e95c25c11d1cc822b05fa1de1cb88b6`; `origin/main` was
  `fca6c4a2b75f77fba4fe5e23ad26c8de12610ccc`. Those refs may move while other
  agents work.

## Loose ends (ranked)

1. **Find and use the actual `TKA 1: Learning Letters` deck owner.** The current
   loader in
   `src/lib/features/browse/gallery-home/canonical-tnd-pool.ts` rebuilds a
   matching roster from the T&D resolver. Austen explicitly named the deck,
   so search the deck/catalog/Firestore path and make that source authoritative.
2. **Audit the route cold before editing.** Open
   `/learn/concepts/words-alpha-beta`, inspect all three phases at the required
   viewport matrix, and write down what feels unlike the canonical TKA app.
   Do not preserve the current composition just because it passes tests.
3. **Fix persistence migration.** The old saved state can contain
   `{ step: 3, phaseData: { questionIndex: 2 } }`. The new component reads the
   `step` but not the old `questionIndex`, so returning users can land directly
   on the completion screen. Detect obsolete phase data and reset or migrate it.
4. **Rework phase-one information density.** On phone and tablet, the selected
   animation/card stage consumes roughly a full viewport before the deck
   choices begin. On wide desktop, the challenge has large unused vertical
   areas. Recompose with existing app primitives and canonical spacing rather
   than adding decorative panels.
5. **Reassess the learning interaction.** The current challenge asks one
   recognition question per family. Establish what the Learning Letters deck
   is supposed to teach in the Guide, then propose the interaction and exact
   copy to Austen before implementing explanatory text.
6. **Remove the legacy trap if safe.** Dormant files under
   `src/lib/features/learn/components/interactive/words/pages/` and
   `domain/demo-words.ts` still contain handwritten `AABB` text and bespoke
   letter styling. They are no longer imported by the live experience, but
   they make it easy for a future agent to restore the rejected design.
7. **Revisit status documentation.** `docs/learn/concept-status.md` currently
   says `BUILT`. Austen rejected the result on 2026-08-23, so the honest status
   is likely `REDESIGN` until he approves a replacement.
8. After implementation, rerun focused tests and `pnpm check`, then perform the
   full visual matrix. Do not call the lesson fixed until Austen accepts it.

## Decisions already made

- On 2026-08-22, Austen said the examples must come from the
  **TKA 1: Learning Letters** deck and that those are the 19 words.
- The roster used in the rejected build was:
  `AAAA`, `BBBB`, `CCCC`; `GGGG`, `HHHH`, `IIII`; `SSSS`, `TTTT`, `UUUU`,
  `VVVV`; `JDJD`, `KEKE`, `LFLF`; `DJDJ`, `EKEK`, `FLFL`; `MPMP`, `NQNQ`,
  `OROR`. Reverify this from the actual deck/MCP before relying on it.
- Every visible TKA letter must use the canonical glyph/component. Plain text
  Latin letters and constructions such as `A>A>B>B` are rejected.
- Use existing production pictographs, cards, animations, and viewers. Do not
  hand-roll substitute notation or switch between hiding the card and hiding
  the animation when both can be shown together.
- Answer choices must be inspectable before selection. The user must not click
  a word just to discover what its pictograph looks like.
- Asymmetric thick-edge highlights and inset accent bars are rejected as
  AI-looking styling. Use full-perimeter focus/selection treatment and existing
  application primitives.
- Do not invent TKA explanations. Ground every domain statement through the
  Flow Arts MCP and the Guide, then bring explanatory wording to Austen for
  approval before placing it in the UI.
- On 2026-08-23, Austen rejected the current implementation and explicitly
  assigned the correction to Fable.

## Gotchas

- The live route currently imports
  `WordsConceptExperience.svelte`; the old `pages/` implementation is dead but
  still present.
- `loadCanonicalLearningLettersSequences()` caches its promise and asks
  `resolveTnDFamilyCards()` for pattern `0|0` in each of the six families. Its
  count of 19 depends on resolver deduplication of mirrored gamma entries.
- The route's persisted state key is `tka_experience_state`, concept key
  `words-alpha-beta`.
- Port 5173 is Austen's HTTPS/2 dev server. Never start, stop, or restart it.
  Browser testing must use the shared debug Chrome launcher and a task-owned
  tab, following `AGENTS.md`.
- TKA facts and rendering are MCP-grounded. If the `flow-arts` MCP is
  unavailable, stop instead of substituting memory or handwritten rendering.
- The copy gate is documented in
  `docs/learn/copy-reviews/words-alpha-beta.md`. Do not interpret the previous
  `fix it` authorization as approval for new instructional prose.
