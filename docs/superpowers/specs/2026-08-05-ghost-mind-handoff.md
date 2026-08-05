# Ghost Mind presenter — Handoff (2026-08-05)

## Mission

Austen wants to prop a laptop open at Taco Tuesday Flow Jam and have the app
demonstrate itself to passersby for hours, unattended, without repeating
itself. The presenter is a **utility-scored intention loop**: a bag of small
curiosities, each with a precondition, an appeal score, a visible thought, and
a piece of choreography. One loop scores, picks, performs, remembers, re-scores.
The intention *sequence* is never authored, so the tour is emergent.

- Design spec: `docs/superpowers/specs/2026-08-04-ghost-mind-design.md`
  (read §As built before touching anything — it records the deltas the browser
  forced and why per-module scripts were rejected)
- Prior handoff: `docs/superpowers/handoffs/2026-08-04-ghost-mind-handoff.md`
- Companion spec (NOT built): `docs/superpowers/specs/2026-08-04-taco-cat-presence-design.md`

Tasks 0–5 of that spec are built. Task 6 (Taco Cat body) is untouched and still
blocked. **Everything below is on `main` in the primary checkout, unpushed.**

## Done — verified

**Task 0 — attract core moved out of the route folder.** `50a88c6754`.
`attract-ghost.svelte.ts` and `GhostPointer.svelte` now live in
`src/lib/shared/attract/`; the two composer acts import from the new home.
Evidence: `npx vitest run --config tests/config/vitest.config.ts "src/routes/(public)/composer/_sections/__tests__/construct-attract-act.test.ts"` → **3 passed**
(that suite reads the act source off disk, so it fails loudly on a bad move).

**Tasks 1–5 — the mind, sensors, bag, caption, safety.** `50a88c6754`.
Evidence: `npx vitest run --config tests/config/vitest.config.ts tests/unit/attract/` → **19 passed**
across two files. Those tests prove, without a DOM: a fixed seed reproduces an
identical 25-step tour and a different seed does not; fatigue drives a category
switch (boredom emerges) and then decays back; novelty strictly decreases on
repeat; momentum only applies to natural successors; selection is not argmax;
every intention's `can` is false against an empty world **except `overwhelmed`,
which is deliberate** (it presses nothing); denied routes unreachable by module
id and path; no raw selectors in the bag; no programmatic navigation in the bag
or host.

**Annotation pass.** `95348b05a9`. Start positions, option cards (both
layouts), turns, the All/Continuous filter, step cells, the view/play button,
effect chips, prop tiles, BPM presets, gallery cards, the 2D/3D toggle.
`SegmentedControl` gained a `ghostKind` prop (only UNSELECTED segments get
annotated). Evidence: `npm run check` → **0 errors, 0 warnings**.

**It actually demonstrates the app.** Live run at
`https://localhost:5174/create/construct?present=20260804`, trail read from
`window.__ghost.trail()`:
`add-step → fiddle-turns → play-it → reject-effect → reject-effect`, **0
failures**. It built the sequence `Y-EBΩ-`, opened the viewer, applied Goo,
rejected Fire. Screenshots taken at 1440×900, 1920×1080, 2560×1440, 3840×2160.

**Caption has zero layout shift.** Measured, not eyeballed: the box was
`300x68` at 1440, `380x84` at 1920 and 2560, `620x132` at 3840 — and identical
across every thought change at each width (sampled 60× per viewport). Small
viewports skipped and recorded: the target is a laptop.

**Takeover lifecycle.** A trusted keypress parked the ghost as the "Watch the
demo again" button and hid the caption; clicking `.resume-hit` un-parked it and
the trail continued 6 → 7 entries rather than resetting, i.e. memory survives
takeover as the spec requires.

**Navigation fix.** `8624b62e8d`. `goto()` and `history.back()` moved the URL
while the module system believed it was elsewhere, leaving the shell blank until
a human clicked a module. Both now route through `handleModuleChange`. Evidence:
60-second run sampling `document.body.innerText.length` every 1.5s across
create → browse → browse/library → creators → lab — **zero blank samples**,
zero trail failures. Static test added; suite is the 19 above.

## Believed done — unverified

- **`escape-room` has never fired in a real trap.** It is gated on nothing
  pressable anywhere plus 45s dwell. I saw the trap it exists for (the museum
  hides the sidebar) but only under the earlier, looser gate. Needs: load an
  immersive module with `?present=1`, wait 45s+, confirm it leaves via a real
  module switch and the shell is not blank afterward.
- **The `?present=0` disarm path and the sessionStorage latch** are written and
  typecheck, but I only exercised the latch incidentally. Needs a deliberate
  test: arm, hard-reload without the param (should keep running), then
  `?present=0` (should stop and stay stopped).
- **Multi-hour behavior.** Longest continuous observation was ~2 minutes. The
  spec's honest acceptance test is *run it twenty minutes and watch*. Thermals,
  Firestore read cost, and whether two five-minute windows look like the same
  tour are all unmeasured.
- **`prefers-reduced-motion` suppression.** Code path exists
  (`isPresentationRequested` returns false); never exercised.

## In flight

**One uncommitted file, deliberately:**
`src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` — 10 added
lines, of which mine are the `data-ghost="safe"`, `data-ghost-kind="stage"`,
`data-ghost-state={isPlaying ? "playing" : undefined}` and
`data-ghost-word={word}` attributes plus `data-ghost-kind="play"` on the corner
toggle. **The presenter needs these** — without them nothing publishes the
playing state or the stage. It is uncommitted because that file also carries
another session's in-flight `elementalGlyphVisible` work, and committing it
would sweep that in (`commit-only-your-own-changes.md`). Whoever lands that
session's work should carry these 10 lines with it.

**Branch/worktree:** everything is on `main` in the primary checkout
`E:/tka-platform`. No worktree. **Nothing is pushed** — `main` is 79 commits
ahead of `origin/main` with several sessions' work in it, and per
`reference_cf_pages_deploy_topology` pushing main deploys production. That is
Austen's call, not mine.

## Loose ends (ranked)

1. **Land the `AnimatorCanvas.svelte` annotation.** Until it lands, a fresh
   clone's presenter cannot sense playback at all — `play-it`, `pause-to-look`
   and every `watchKind` beat silently score zero. This is the one piece of the
   built system that is not in git.
2. **Run it for twenty minutes and watch it.** The spec's real acceptance test,
   still unpaid. Watch for: two five-minute windows that look like the same
   tour (momentum/weighted-pick wrong), and any stall (read
   `window.__ghost.failures()` and `.trail()` — `ok: false` means a lying
   precondition).
3. **Annotate more surfaces.** This is the growth path and it is not code.
   `curio`, `clear` and `option-pager` have **no annotated element anywhere**,
   so `what-is-this-button`, `clear-and-restart`, `tune-effect`, `open-mandala`
   and `page-families` can never fire. Add `data-ghost="safe"` +
   `data-ghost-kind` per `src/lib/shared/attract/domain/annotations.ts`.
4. **Museum, Learn, Lab, Choreo have nothing annotated.** The ghost reaches them
   and can only be `overwhelmed` there. Fine for a first jam; thin as a demo.
5. **Verify the four items under "Believed done — unverified".**
6. **Taco Cat (Task 6).** Still blocked on both: permission from the real
   `flowtacocat` creator (a real person in
   `creators-data-state.svelte.ts`, not a mascot), and nine SVG poses. The dot
   ships without it — the body sits behind a one-prop seam.

## Decisions already made

- **Entry is `?present=1` only** (Austen, 2026-08-04, chose it over a Settings
  toggle): the park laptop gets a bookmark, nothing in the shipped UI can trip
  it. `?present=<seed>` replays a tour; `?present=0` disarms.
- **Navigation presses real nav DOM only** (Austen, 2026-08-04, chose it over a
  programmatic fallback): "a viewer sees the app being driven." The ghost never
  calls `switchModule` to get around. The only sanctioned programmatic move is
  the safety/escape hatch, which uses `handleModuleChange`.
- **Per-module scripts were considered and rejected** in the design (26 scripts
  is a permanent treadmill; a broken script is a ghost frozen in front of
  strangers). Do not reach for them.
- **The scorer stays dumb.** Mood models, planners, an LLM — all invisible from
  fifteen feet. Budget goes to more intentions.
- **The docent and the QR funnel are out of scope** and deferred past the first
  jam by Austen's agreement.

## Gotchas

- **`/create/generate` takes ~14s to paint on a cold deep link, and that is NOT
  the ghost.** Austen reported it as a presenter bug on 2026-08-05. Reproduced
  identically with presentation mode off (`len=33` at 0.8s → `len=294` at
  14.2s, no console errors). It is `project_create_module_load_perf` (T4). Do
  not go looking for it in the attract code.
- **Never `goto()` or `history.back()` from the presenter.** They move the URL
  while the module system believes it is elsewhere and the shell renders empty
  until a human clicks a module. This bit once (`8624b62e8d`) and a static test
  now guards it. Use `handleModuleChange`.
- **The overlay must sit above everything** (`z-index: 2147483000`). The
  fullscreen viewer covered the ghost precisely while it was doing its most
  interesting work. Safe because the layer is inert — it never occludes the
  `elementFromPoint` probe that gates every press.
- **`window.innerWidth` inside a `$derived` is not reactive.** It computes once
  at mount and then lies; that is how 4K got 24px type in the laptop-tier box.
  `ThoughtCaption` uses `<svelte:window bind:innerWidth>` now.
- **Chrome DevTools `emulate` applies dpr 1.1** — multiply target CSS widths by
  1.1 or every viewport sweep lands a tier low (`reference_devtools_emulate_dpr`).
  1920 CSS = `emulate 2112x1188x1`.
- **Debug seam:** `window.__ghost` in the browser console gives `seed`,
  `trail()`, `failures()`, `scores()` (what it is weighing right now, best
  first), `world()`, `pause()`, `resume()`, `stop()`. `scores()` is how I found
  that build intentions were losing to the navigator.
- **A module's controls mount asynchronously.** For the first second or two the
  DOM honestly has nothing annotated, and an undamped navigator wins that gap
  and leaves before the page it asked for arrives. That is what `settled()` in
  `intentions/helpers.ts` exists for — do not remove it.
- **Editing any attract file while a tour is running triggers an HMR reload**
  that wipes `window.__ghost` and the mind's memory. Observed runs and edits do
  not mix; finish the edit, then reload and watch.
- **`@austencloud/sidebar` is external**, so nav is matched by the package's own
  `data-tour-module` / `.section-button` rather than a TKA annotation.
- **The +/- BPM buttons are pointerdown-driven** and `el.click()` cannot reach
  them; only the BPM *presets* are annotated. A control the ghost presses to no
  visible effect is worse than one it cannot see.
- **Unrelated, currently broken on dev:** another session's
  `GalleryWorkspace.svelte:1355` has a Svelte compile error
  (`justify-content: safe center` in a selector context) that blanks Browse.
  Not mine, untouched.
