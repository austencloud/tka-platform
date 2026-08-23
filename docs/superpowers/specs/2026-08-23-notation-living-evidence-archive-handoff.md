# Notation Living Evidence Archive — Handoff (2026-08-23)

## Mission

Continue the `/notation` playable archive as a one-screen, sourced record of
how flow artists name, organize, record, and teach movement. The current
uncommitted prototype replaced an ambiguous carousel with a proportional
four-lane chronology and persistent record detail. Austen's latest decision
changes the archive's editorial premise: it must present **documented traces**,
not claim to be the definitive history or rank entries by importance. Start
with the existing
[design spec](./shipped/2026-07-27-notation-playable-archive-design.md), but add
a 2026-08-23 amendment before further UI implementation because its current
top amendment still says “chronological overview” and does not yet encode the
living-evidence model.

## Done — verified

No notation implementation is committed, so no implementation item qualifies
as shipped. Before this handoff was written, the repository was on `main` at
`2613cdcea50c95bf551d46d37b46537258c3d038` (`docs: hand off Blossom scene
rebuild`). `git status --short` proves that every notation change listed below
is still modified, deleted, or untracked. Treat the prototype as in-flight
work even though its focused verification is green.

## Believed done — unverified

- The current presentation was visually inspected during the 2026-08-22
  session at 1440×900, 1920×1080, 2560×1440, 3840×2160, 820×1180, 960×412,
  and 375×667. The session measured zero horizontal overflow at every size and
  checked the 2009–2011 cluster disclosure without layout shift. Those
  screenshots were emitted in the Codex conversation but were not persisted
  as repository evidence. Repeat the full Chrome DevTools screenshot sweep
  after the editorial/model amendment.
- Direct `#archive-record-<id>` links, browser Back/Forward restoration, the
  compact Drawer, Drawer focus return, named previous/next controls, and a
  clean console reload were exercised in the browser on 2026-08-22. Repeat
  after changing activity representation or hierarchy.
- All fifteen entries have structurally complete citation arrays and claim
  descriptions. The tests prove structural presence, not historical truth.
  The full editorial ledger has **not** received a human fact-check of every
  claim and source.
- The artifact-specific responsive changes in `LorqMatrixSheet.svelte`,
  `PoiNotationCartridge.svelte`, `QftLiveArtifact.svelte`,
  `TkaLiveArtifact.svelte`, and `VtgChapterStepper.svelte` looked correct in
  the previous visual sweep but have no persisted screenshot evidence.

## In flight

### Branch and worktree

- Branch: `main`; no task branch or worktree was created.
- Starting HEAD before this handoff doc: `2613cdcea50c95bf551d46d37b46537258c3d038`.
- The shared checkout and Git index contain a very large amount of unrelated
  work from other agents. Never reset, stash, stage broadly, or commit without
  an explicit pathspec. Own only `src/routes/(public)/notation/**`,
  `src/routes/test/notation-playable/**`, the existing notation design spec,
  notation-focused tests, and this handoff. Do not edit shared landing
  navigation.

### Current prototype implementation

Modified:

- `docs/superpowers/specs/shipped/2026-07-27-notation-playable-archive-design.md`
  has a 2026-08-22 overview/detail amendment, the research basis, the
  four-lane contract, failure ledger, citation rules, responsive contract,
  and viewport targets. Its curated/overview framing is now partly stale.
- `src/routes/(public)/notation/+page.svelte` now builds metadata and JSON-LD
  from all archive entries instead of the old eight-item notation catalog and
  has compact-height reflow.
- `src/routes/(public)/notation/_components/archive/PlayableArchive.svelte`
  is the current behavior owner. It removed Embla/discovery state, uses
  SvelteKit `pushState`, renders the overview with persistent selected detail,
  and switches to a chronological index plus the shared Drawer on compact
  screens. It composes existing PanelButton, Drawer, modal, haptic, press,
  magnetic, tilt, and cursor-glow capabilities.
- `src/routes/test/notation-playable/+page.svelte` hosts the production
  component without landing chrome.
- `tests/unit/notation-playable-archive-contract.test.ts` now asserts the
  overview/detail, native-link, deep-link, compact-index, shared-primitive,
  and no-carousel contract.
- The five artifact files named under “Believed done” contain responsive type,
  fitting, or layout corrections made during the redesign.

New and untracked:

- `ArchiveTimeMap.svelte` — proportional 2004–2026 four-lane map, native record
  links, collision tracks, and the explicit 2009–2011 cluster tray.
- `ArchiveChronologicalIndex.svelte` — all fifteen records in year order for
  phone and short-wide screens.
- `ArchiveEntryDetail.svelte` — attribution, summary, evidence note, and
  claim-specific sources.
- `ArchiveRecordVisual.svelte` — routes each ledger record to the appropriate
  existing/live artifact or honest unillustrated source record.
- `ResearchSubmissionGuide.svelte` — current contribution guidance.
- `_lib/archive-ledger.ts` — fifteen-entry ledger, four lanes, citations,
  evidence labels, chronological helpers, and collision placement.
- `_lib/archive-appearance.ts` — record accent mapping.
- `tests/unit/notation-archive-ledger.test.ts` — citation, chronology, cluster,
  lane, and placement contracts.

Deleted but not committed:

- `_lib/archive-state.ts` and
  `tests/unit/notation-playable-archive-state.test.ts`. They owned the rejected
  visited/discovered/completion-flourish model and had no runtime consumer.

### Verification run on 2026-08-23

```text
pnpm exec vitest run --config tests/config/vitest.config.ts \
  tests/unit/notation-playable-archive-contract.test.ts \
  tests/unit/notation-archive-ledger.test.ts

Test Files  2 passed (2)
Tests       17 passed (17)
Duration    767ms
```

```text
pnpm exec svelte-check --output machine

COMPLETED 83 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
```

`curl -k https://localhost:5173/test/notation-playable` returned HTTP 200 on
2026-08-23. The earlier isolated preview on port 5174 is no longer running,
even though a user browser tab may still show its stale URL.

## Loose ends (ranked)

1. **Amend the spec before touching the interface.** Add the 2026-08-23 living
   evidence decision as the new authority. The archive is a revisable index of
   sources we can verify, not “the history,” a canon, or Austen's ranking of
   importance. Suggested public premise: “This is a living index of the
   sources we have been able to verify. It is incomplete, revisable, and open
   to correction.” Run the final wording through the `ai-bust` skill.
2. **Replace the misleading activity model.** `ArchiveEntry` currently has
   `startYear`, optional `endYear`, and `ongoing?: boolean`. PLAYPOI,
   Flow Arts Institute, and DrexFactor are marked ongoing in data, but the map
   shows only a point at their first documented year, visually making them
   look short-lived. Model separate facts such as `firstDocumentedYear`,
   `lastVerifiedYear`, `activityStatus`, and claim-specific activity evidence.
   Show “active, verified 2026.” Do not draw a solid duration bar unless the
   evidence supports uninterrupted activity; a dotted observation connector
   or two verified endpoints is more honest.
3. **Replace the coarse evidence taxonomy.** Current statuses are
   `source-audited`, `creator-source`, and `open`. Austen approved a clearer
   claim model: `directly observed`, `creator's account`,
   `community attested`, `independently corroborated`, and `unresolved`.
   Evidence belongs to individual claims where necessary; one record-level
   badge must not overstate every sentence.
4. **Make inclusion neutral and explicit.** Inclusion should mean that the
   archive can point to an identifiable artifact, dated public trace, or named
   testimony. It must not imply influence, invention, priority, endorsement,
   or equal importance. Instagram posts are valid primary evidence for narrow
   statements such as “this account publicly showed or named this by this
   date”; they are not proof of invention or significance. Add correction and
   counter-evidence paths to the contribution flow.
5. **Rework hierarchy and copy around “Documented traces.”** Preserve the
   proportional chronology, four lanes, 2009–2011 density cluster, selected
   artifact, and compact chronological index unless the new model reveals a
   concrete conflict. Replace language that implies a definitive historical
   overview. Keep the full source ledger available; do not split it into a
   privileged canon and a lesser dump.
6. **Update tests before implementation.** Add contracts for verified activity
   endpoints, the expanded evidence states, neutral inclusion copy, uncertainty,
   and correction affordances. Keep the silent-bug focus: chronology math,
   collision tracks, hash restoration, and source completeness.
7. **Repeat full verification.** Run the two focused Vitest files and
   `svelte-check`, then use the project-mandated Chrome DevTools flow at
   1440×900, 1920×1080, 2560×1440, 3840×2160, 820×1180, 960×412, and 375×667.
   Verify pointer, keyboard, named previous/next context, direct hash,
   Back/Forward, Drawer focus return, disclosure stability, font floors,
   horizontal overflow, and console output.
8. **Only after editorial and visual approval, decide what to commit.** The
   implementation currently spans modified, deleted, and untracked files.
   Commit only explicit notation paths; never absorb unrelated shared-index
   changes.

## Decisions already made

- **2026-08-22 — chronology, not carousel:** The archive communicates elapsed
  time. Dates and proportional spacing must be visible. Narrative carousel
  semantics, unlabeled ticks, icon-only arrows, and discovery counters were
  rejected.
- **2026-08-22 — four named lanes:** Notation Systems, Movement Languages,
  Teaching & Transmission, and Current Research. The lanes classify
  contribution type; they do not rank importance.
- **2026-08-22 — dense years:** The overloaded 2009–2011 movement-language
  period must be explicitly grouped without moving its calendar position or
  omitting CAPs, the trochoid model, 9-Square Theory, or VTG.
- **2026-08-22 — scope:** PLAYPOI, Flow Arts Institute, and DrexFactor belong
  under teaching/transmission, not notation. Fan Alphabet, Staff Science, and
  other prop systems may be included when their claims have sources.
  PoiNotation may remain as a public repository artifact but must not be
  described as broadly adopted or historically influential without evidence.
- **2026-08-22 — citations:** Everything published must be cited and fact
  checked. AI-assisted discovery is never itself a source. Each citation must
  say exactly what claim it supports; uncertainty stays visible.
- **2026-08-22 — visual language:** Preserve the one-screen artifact experience
  and use the app's existing primitives, transitions, theme tokens, and AAA
  contrast work. Austen explicitly rejected tiny text, dead space, rigid
  square geometry, brown-tinted copy, generic AI-looking ornament, fake
  clickability, and navigation that requires curiosity to decode.
- **2026-08-23 — no curated canon:** Sparse documentation, especially the move
  from articles to Instagram, makes “most important historical records” a
  documentation-bias trap. Austen does not want to appoint himself sole teller
  of the story. The archive documents traces, attributes claims, shows
  uncertainty, invites corrections, and never confuses inclusion with
  importance. Austen explicitly said he loved this direction.
- **2026-08-23 — social evidence:** A dated Instagram post can support a narrow
  publication claim. A creator caption can support the creator's own account.
  Independent posts can demonstrate circulation. None alone proves invention,
  priority, or broad historical significance.

## Gotchas

- The spec contains older amendments and a detailed failure ledger. Its newest
  applicable amendment must always be authoritative. Append the 2026-08-23
  living-evidence amendment at the top; do not rewrite history or let the older
  carousel/lane-tab proposals regain authority.
- Primary-source evidence found on 2026-08-22 supports current activity:
  PLAYPOI advertises a 2026 Leviathan camp
  (`https://playpoi.com/2025/01/08/leviathan-flow-camp-2025/`), DrexFactor has a
  2026 event calendar (`https://drexfactor.com/calendar/2026`), and FAI lists
  2026 festivals (`https://flowartsinstitute.com/`). These support “active,
  verified 2026,” not uninterrupted year-by-year activity.
- `PlayableArchive.svelte` must use SvelteKit's `pushState` import. Native
  `history.pushState` produced a router warning earlier in the session and was
  replaced.
- Port 5173 is Austen's shared HTTPS server. Do not start, stop, restart, or
  kill it. If an isolated server is needed, use a free port such as 5174 and
  leave 5173 alone.
- The existing user browser may still point at
  `https://localhost:5174/test/notation-playable#archive-record-flowgoesapien`,
  but port 5174 was confirmed offline on 2026-08-23. Port 5173 returned HTTP
  200 for the same route.
- The worktree and Git index are shared with many live tasks. `git status` is
  extremely dirty. Never use `git add -A`, `git add .`, a bare `git commit`,
  reset, checkout, or stash. Scope every operation to explicit notation paths.
- Shared landing navigation was explicitly out of scope and has not been
  touched by this task.
