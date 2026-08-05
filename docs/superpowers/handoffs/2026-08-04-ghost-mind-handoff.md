# Ghost Mind + Taco Cat Handoff

- **Date:** 2026-08-04
- **Status (updated 2026-08-04):** Tasks 0–5 BUILT and verified in the browser.
  Task 6 (Taco Cat) still blocked on the two blockers below. The remaining work
  is not a rebuild — it is annotating more surfaces (`data-ghost="safe"` +
  `data-ghost-kind`) so more of the app is in the tour, and adding intentions.
  Read §As built in the ghost-mind spec before touching anything.
- **Branch:** `main`
- **HEAD when written:** `4bf7311209e2e54542b2d1e56356d186ece969ce`
- **Specs:**
  - `docs/superpowers/specs/2026-08-04-ghost-mind-design.md` (build this first)
  - `docs/superpowers/specs/2026-08-04-taco-cat-presence-design.md` (blocked on art + permission)
- **Estimate from Austen:** about a week.

## Mission

Austen wants to prop a laptop open at Taco Tuesday Flow Jam and have the app
demonstrate itself for hours, unattended, without repeating itself — then have
passersby scan a QR and sign up. This handoff covers the presenter. The QR
funnel is a separate, unwritten spec.

The presenter is a **utility-scored intention loop**: a bag of ~22 curiosities,
each with a precondition, an appeal score, a visible thought, and a small piece
of choreography. One loop scores, picks, performs, remembers, re-scores. The
intention *sequence* is never authored, so the tour is emergent and never the
same twice.

Read both specs before touching code. The reasoning behind the architecture
choice is in the ghost-mind spec's opening sections and it is load-bearing — a
future agent who skims will reach for per-module scripts, which was explicitly
considered and rejected.

## What already exists (do not rebuild)

The motor layer is done and it is good. Read it before writing anything:

| File | What it gives you |
|---|---|
| `src/routes/(public)/composer/_sections/attract-ghost.svelte.ts` (483 lines) | Human motor model: bowed bezier glides, distance-scaled durations, off-center landings, browse-before-pick, micro-drift dwell, hidden-tab-proof frame loop, park/resume lifecycle. **And `fingertipOn()`** — the `elementFromPoint` press gate that makes whole-app safe: the ghost cannot click what it is not visibly touching. |
| `construct-attract-act.svelte.ts` (304 lines) | The reference act. Its `fiddleTurns`, `fiddleFilter`, `pageSections`, `glanceAtWorkspace` are already the exact size and shape of intentions and lift over nearly as-is. |
| `generate-attract-act.svelte.ts` (128 lines) | Second act, same pattern. |
| `GhostPointer.svelte` | The dot body + the parked "watch again" button. |
| `src/lib/shared/navigation/config/module-definitions.ts` | **The map.** 26 modules, each with a `sections` tab array from `tab-definitions.ts`. Navigation needs no new authoring. |

## Build order

**Task 0 — move the core.** `attract-ghost.svelte.ts` →
`src/lib/shared/attract/services/attract-ghost.svelte.ts`. Pure move, no
behavior change, update the two composer act imports. It is whole-app infra now
and cannot stay in a marketing route folder. Everything else imports from the
new home, so do this first or you will redo imports twice.

**Task 1 — the mind, headless.** `intention.ts`, `mind.svelte.ts`, `rng.ts`,
`trail.ts`. Scorer, momentum, fatigue, novelty, weighted-random-over-top-5.
This is pure logic with no DOM and it is where the unit tests live. You can
prove boredom emerges before any intention exists, using fake intentions.

**Task 2 — sensors.** `GhostContext` construction. **This is the real
engineering, not the scorer.** Sensors read the DOM only — never import feature
code. Where the DOM cannot answer, add one `data-ghost-state` attribute to the
component rather than an import. A lying precondition is what makes the ghost
look broken, and it is the only part of this that will rot.

**Task 3 — the bag.** All 22 intentions, grouped by category into
`intentions/*.ts`. Start with the `build` and `playback` groups — they run on
the composer surfaces the existing acts already prove out, so you get a working
loop early.

**Task 4 — the thought caption.** `ThoughtCaption.svelte`. Ghost-sizer against
layout shift, `Crossfade` with `fill` for thought changes, minimum hold
duration. Austen's own words are the source copy — his brainstorm message lists
about eleven of the thoughts verbatim and they are better than anything
rewritten.

**Task 5 — safety + presentation mode entry.** `data-ghost="safe"` annotation
pass, route denylist, the opt-in toggle. Default-deny throughout.

**Task 6 — Taco Cat.** Only after the mind is proven and only after the two
blockers below clear.

## Blockers on the Taco Cat spec

1. **Permission.** `flowtacocat` is a real creator handle in
   `creators-data-state.svelte.ts:30` — a real person in the community, not an
   existing mascot. There is no art or lore in the repo. Austen should ask
   before this ships at their jam. Flagged in the brainstorm, not yet resolved.
2. **Art.** Nine SVG poses, requirements in the spec. Can be produced in
   parallel with Tasks 1-5. If it slips, the dot ships — the body is behind a
   one-prop seam precisely so that is not a rollback.

## Things a future agent will get wrong

- **Reaching for per-module scripts.** Considered and rejected with reasons.
  26 scripts is a permanent treadmill and a broken script is a ghost frozen in
  front of strangers. Crawl-plus-annotate degrades quietly instead.
- **Making the scorer clever.** Mood models, planners, an LLM. All invisible
  from fifteen feet. Spend on more intentions.
- **Treating the visible thought as decoration.** It is the feature. Without it
  a stranger sees a dot clicking around and reads it as random no matter how
  good the reasoning underneath is.
- **Skipping the seeded RNG** because it seems like debugging scaffolding.
  It is two lines now and impossible to retrofit later.
- **Using `argmax` to pick the winning intention.** Deterministic, retraces the
  identical tour every session, defeats the entire design.
- **Building the crossfade wrong.** `crossfade-primitive.md` documents that
  AI-written crossfades fail the same way every first attempt: variable-height
  content in content-sized mode inside a framed box. Use `fill`, and keep the
  bubble chrome outside the crossfade.
- **Shipping without screenshots.** New visual surface. 1920 / 2560 / 3840 /
  1440, and the small end is skipped-and-recorded because the target is a
  laptop.

## Verification bar

Unit tests carry the mind. The honest acceptance test is behavioral: **run it
for twenty minutes and watch it.** If two consecutive five-minute windows look
like the same tour, momentum or the weighted pick is wrong. If it stalls
anywhere, a precondition is lying — check the trail for `ok: false`.

## Not in scope

- **The docent** — "oh hi, I was waiting for you," guided walkthrough, offer to
  reset. Different interaction model, branching written dialogue. Deferred past
  the first jam by Austen's agreement. It hooks the existing `pause()`/park
  seam when it comes.
- **The park QR funnel** — scan → sign up → in the app. Unwritten. Note for
  whoever specs it: `guest-identity.ts` (`signInAnonymously`) and
  `anonymous-upgrade.ts` (`linkWithCredential`, preserves Dexie drafts, fires
  `guest_upgraded_to_account`) are already built, and auth is modal-only with
  no standalone signup route. Austen wants an immediate signup wall; the
  counter-argument that a guest-first flow converts better was raised and
  deliberately left unsettled for that spec.
- **Monkey-test / bug-hunting mode.** Explicitly out. The mind spec pays only
  the two cheap taxes (seeded RNG, action trail) that keep it buildable later.
