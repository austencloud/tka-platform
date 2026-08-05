# Ghost presenter — audit, remediation and voice — Handoff (2026-08-05)

## Mission

The ghost-mind presenter demonstrates the app to passersby, unattended, for
hours — a laptop propped open at Taco Tuesday Flow Jam. It is a utility-scored
intention loop: a bag of small curiosities, each with a precondition, an appeal
score, a visible thought and a piece of choreography. One loop scores, picks,
performs, remembers, re-scores; the intention *sequence* is never authored.

This session started as an audit of that implementation and turned into
remediation plus a rewrite of its voice.

- Design spec: `docs/superpowers/specs/2026-08-04-ghost-mind-design.md`
  (read §As built first)
- Prior handoffs: `docs/superpowers/specs/2026-08-05-ghost-mind-handoff.md`
  (also updated by this session), `docs/superpowers/handoffs/2026-08-04-ghost-mind-handoff.md`
- Companion spec, NOT built: `docs/superpowers/specs/2026-08-04-taco-cat-presence-design.md`

**Everything below is on `main` in the primary checkout `E:/tka-platform`, and
`main` is NOT pushed.** Pushing main deploys production
(`reference_cf_pages_deploy_topology`). That is Austen's call.

## Done — verified

**The presenter survived being touched.** `e8e8df0990`. Any trusted pointerdown
or keypress parked the ghost FOREVER — only a human clicking the parked dot
brought it back, so one curious tap ended a four-hour run. Now: 30s idle-resume.
Also `Escape → kill()` sat BEFORE the `isTrusted` check, so any synthetic Escape
could permanently end the demo.
Evidence, live on a dev server: parked at t=0–25s after a real F13 keypress,
un-parked at t=30s with no click (`.resume-hit` present → absent). An untrusted
`Escape` dispatched via JS no longer kills — the ghost survived and the trail
advanced 4 more entries.

**A fresh browser profile demonstrated nothing at all, forever.** `e8e8df0990`.
The create-tutorial prompt is the first thing a clean profile sees, and ANY
overlay with a backdrop makes every annotated control fail the
`elementFromPoint` press gate — so the ghost's whole world reads as empty.
Evidence, measured on the pre-fix production build: **92 decisions in 6 minutes,
100% of them `escape-room`**, blocker still up, zero pressable elements.
Fix: `dismiss` kind + `dismiss-blocker` intention (Skip, never Accept) on the
create-tutorial prompt and the generate/step-editor tours.
Post-fix evidence on the same fresh-profile scenario: **30 decisions in 2.8
minutes, 0 failures, 14 distinct intentions, ZERO escape-room**, full chain
observed (dismiss-blocker ×2 → pick-start → fiddle-turns → add-step → play-it
with the stage playing and word "Ψ" → reject-effect with ink active →
what-is-this-button → leave-viewer → clear-and-restart through its confirm →
pick-start).

**The escape hatch could not leave an overlay.** `b75e2ddcab`.
`handleModuleChange` swaps what sits UNDER the viewer drawer and leaves the
drawer covering it. Observed live: the ghost opened someone else's sequence, the
viewer had no animation data, and it "escaped" to create while still trapped
behind the drawer, re-escaping every 45s. Fix: `close-overlay` kind on the
viewer's close button, pressed BEFORE the programmatic hatch; the viewer content
rail annotated `curio`; `leave-viewer` for a restlessness-driven exit.
Evidence: the 30-decision run above, zero `escape-room`.

**`escape-room` fired in a real trap.** `e8e8df0990` era. The handoff's top
"believed done — unverified" item. Evidence: trail entry 14 was
`escape-room @museum` with `available` empty and dwell > 45s; it left via a real
module switch and immediately resumed working (`add-step`, `scrub-back`,
`clear-and-restart`), 0 failures across 18 entries.

**The sessionStorage latch and `?present=0`.** Evidence: hard-reloaded to
`/create/construct` with NO `?present` param — presenter still running
(`survivedParamLoss: true`). Then `?present=0` → ghost gone, latch `null`; a
subsequent param-less load stayed stopped with the app normal.

**Five intentions were dead code; a test now prevents it.** `e8e8df0990`.
`clear`, `curio`, `effect-param` and `prop-picker` had NO annotated element
anywhere in `src/`. `open-viewer` was unreachable because `ViewSequenceButton`
claimed kind `play` while actually opening the viewer, and `viewer-open` hung off
the 2D/3D toggle (so it meant "open AND in 3D"). Deleted `page-families` (no
pager exists — the `Next ›` I later found in the data is a Learn lesson stepper,
not the option picker) and `open-mandala` (it claimed to open a mandala and only
watched the stage).
Evidence: `npx vitest run --config tests/config/vitest.config.ts tests/unit/attract/`
→ **22 passed**, including two new tests: every kind in the vocabulary must have
a real annotated element in `src/`, and every kind must be used by an intention.

**`AnimatorCanvas` annotation landed.** `950015c0b4`. It was the one piece of the
built system living only in a working tree; without it `play-it`, `pause-to-look`
and every `watchKind("stage")` beat scored zero in a fresh clone. Committed from
the index alone via a reduced `git apply --cached` patch, so another session's
in-flight `elementalGlyphVisible` work stayed uncommitted in the worktree.
Evidence: `git show --stat 950015c0b4` = 6 insertions, that file only;
`git status` still shows the file modified (their 4 lines intact).

**The ghost does the thing it just said it would.** `3b912bbc97`.
`resolveThought()` ran BEFORE `perform()`, so any thought naming a control had to
independently re-derive what the perform would choose — the thought took the
FIRST match, the perform a RANDOM one. Austen watching it live: *"he keeps saying
I wonder what side by side is and then not clicking side by side"*, *"said I
wanted to slow down and then clicking fast"*. It hit `what-is-this-button`,
`go-to-module`, `try-prop`; `change-tempo` narrated a hardcoded "Slower" while
pressing a random one of Slow/Med/Fast. Intentions now declare `target(ctx)`,
resolved once and handed to both.
Also fixed the third thing he saw — *"moves out of the way after clicking"* — which
was `watchKind()` calling `restBeside()`, gliding to the target's corner after
every press.
Evidence: a new static test fails if a thought reads the DOM or references
`target` without the intention declaring one; **verified non-vacuous** by
deleting `change-tempo`'s target and watching the test name it
(`playback.ts → change-tempo`), then restoring.

**Practice + the camera mirror.** `3bb86ec191`. Austen reversed the earlier
withhold: *"practice should be used by the ghost and the camera should be opened
and I think that's part of the effect."* `try-practice` enters practice then
presses Mirror (which defaults OFF, so practice alone shows no camera);
`leave-practice` exits on rising restlessness so the camera does not stay on all
night. Gated on `cameraGranted`.
Evidence: browser permission `prompt` → `cameraGranted: false` → `try-practice`
absent from the scored candidates entirely, so it can never raise a prompt.

**F9 switch + reload respects who has the wheel.** `091ad933fd`. Evidence, in
order on a dev server: armed and running (trail advancing) → trusted keypress
parks it and persists `paused` + timestamp → **40s later still parked**, so dev
does not spring back → reload with NO `?present` param mounts it **parked, trail
0, caption hidden** → a real click on "Watch the demo again" flips activity to
`running`, clears the timestamp, un-parks, and it gets back to work
(`go-to-module`, `add-step`).

**A motive per control, and the museum walks itself.** `183da80415`,
`29f46cabde`, `48781af983`, `f813a52490`. See Decisions and Gotchas.
Evidence for the docent: see the next block.

**The museum docent walks, and the "~40s stop" did not exist.** `f813a52490`
added an instance counter and a stop reason to `window.__docent` precisely
because a remount and a `stop()` call look identical from outside and have
opposite fixes. Evidence: with NO file edits during the run,
`{active: true, stopReason: null}` held for 60s straight and then 110s straight,
walking continuously (tiles 77,236 → 85,246 → 78,246 → 85,212 → 72,189 …) and
crossing from the Entrance Lobby into the Vulcan Cave. **The earlier "stops" were
Vite HMR remounts caused by my own edits mid-tour** — the same trap the prior
handoff documents for `window.__ghost`. See Gotchas; it is the single easiest way
to waste an hour here.

**The docent survives the scene host remounting.** `42cfcc8e18`. The 110s run
exposed the real problem the fake one was hiding: **`instancesSeen: [1,2,3,4,5,6]`
— six docents in 110 seconds** as rooms streamed and wings changed, each one
throwing away its path, target and seen-exhibits set. It walked forever and
ARRIVED nowhere (110s of "Walking over to…", zero "Reading…"). The docent is now
one per tab (`getMuseumDocent()`), re-pointed at the current grid on each mount.
Evidence: 80s continuous run afterwards → `instances: [1]`, `stopped: false`,
where the same measurement previously gave six.

`npm run check` → **0 errors, 0 warnings**. `tests/unit/attract/` → **22 passed**.

## Believed done — unverified

- **The F9 Ghost chip itself.** The admin toolbar is admin-gated and the test
  context had no admin session, so `activate()`/`deactivate()` were exercised
  through the lifecycle rather than through the button. The chip is a thin
  wrapper over exactly those two calls. Needs: press F9 as admin and click it.
- **The GRANTED camera path.** Verified only that it fails closed. Exercising the
  positive path needs the one-time manual grant (see Gotchas). Nobody has seen
  the ghost actually open the mirror.
- **Multi-hour behavior.** Longest continuous observation ~3 minutes. Thermals,
  Firestore read cost, and whether two five-minute windows look like the same
  tour remain unmeasured. This is still the spec's real acceptance test.
- **The 4-minute stall watchdog** never fired, because `escape-room` now rescues
  traps at 45s. It is a backstop for a stall `escape-room` does not cover.
- **`prefers-reduced-motion` suppression.** Code path exists; never exercised.
- **The docent over a long run / across many wings.** Verified continuous for
  60s, 80s and 110s and across an Entrance Lobby → Vulcan Cave crossing, but not
  for ten minutes and not across every wing.
- **The docent reliably ARRIVING at exhibits.** It does arrive sometimes —
  observed "Reading Reception" and "Reading Codex Pages" with real dwells in an
  early run — but two later runs (110s and 80s) logged **zero arrivals**, only
  "Walking over to…" with the target changing every few seconds. See loose end #1
  for the diagnosis; this is the one place the feature is still visibly short of
  the thing Austen asked for.

## In flight

Nothing of this work is uncommitted. `git status` shows many modified files from
OTHER sessions (gallery drill, combinator research, compose, shop docs,
`pill-summaries.*`, and `AnimatorCanvas.svelte`'s remaining
`elementalGlyphVisible` lines). **None of those are mine — do not sweep them into
a commit** (`commit-only-your-own-changes.md`).

Branch/worktree: everything on `main` in the primary checkout. No worktree.
Unpushed.

## Loose ends (ranked)

1. **Make the docent's pathfinding agree with the physics, so it arrives.**
   `findPath` in `museum-docent.svelte.ts` walks the TILE MAP via
   `isWalkable(tile.type)` from `tile-registry`. The thing that actually stops the
   player is `MuseumPhysicsProvider`, which blocks on `SOLID_TYPES` **plus
   `furnitureColliders` (built from `grid.furniture`) plus `grid.terrain`** — none
   of which the tile map expresses. So the BFS happily routes through a bench, the
   player jams against it, the stuck detector fires at 2600ms, and it retargets
   before ever arriving. Evidence: in the 110s run the target changed every few
   seconds ("Codex Pages" → "Notebooks Scattered" → "Patent Documents" inside
   10s) and it sat at tile 85,246 for 12+ seconds mid-walk. **Fix: give the docent
   the same solidity oracle the physics uses** (share the furniture/terrain
   blocking test rather than re-deriving it) — the honest version is to ask the
   physics provider "is this tile passable", not to guess from the tile type.
   Everything else about the docent is verified; this is what stands between
   "walks around" and "gives a tour".
2. **Run it for twenty minutes and watch it.** Still the unpaid acceptance test,
   and now the highest-value thing left: every individual mechanism is verified
   and the whole has never been observed for long. Watch for two five-minute
   windows that look like the same tour (momentum/weighted-pick wrong) and read
   `window.__ghost.failures()` / `.trail()` — `ok: false` means a lying
   precondition. **Do not edit any attract or museum file during the run.**
3. **Austen's thumbs on the effect commentary.** He said *"I'm gonna read through
   every one of these and I'm gonna give you the thumbs up or thumbs down on
   every one"*, then *"Go nuts, I'll take the lot"* — so the current sixteen are
   accepted, but he may still revise. They live in one table in
   `src/lib/shared/attract/intentions/monologue.ts`. Two are weakest and were
   flagged to him: **Bloom** and **Sparkle** are the only lines that still name a
   feature rather than something a flow artist would say.
4. **The card → download → share flow he described.** DELIBERATELY NOT BUILT.
   `shareOrDownloadBlob` calls `navigator.share()` where the platform supports
   files, which opens the **native share sheet** — OS chrome the ghost cannot
   see, press or dismiss, i.e. the exact trap class fixed twice this session.
   The safe version uses `downloadBlobToDisk()` (never opens a share sheet),
   bounded to once or twice per session like `budgets.galleryOpens`. Austen owes
   a call on whether download-only is worth it.
5. **Annotate more surfaces — now with data.** Filtered PostHog says real clicks
   go to Prop, Generate, 2D Animation, Construct, Card, Tunnel, Side by Side,
   Playback. The viewer rail and prop switcher are now annotated; the remaining
   gap is Learn/Lab/Choreo, which real users barely visit (see Gotchas).
6. **Verify the four items under "Believed done — unverified".** The camera
   granted path first — it is the one with a visible payoff.
7. **Taco Cat (Task 6 of the original spec).** Still blocked on permission from
   the real `flowtacocat` creator and nine SVG poses.

## Decisions already made

- **Practice and the camera are IN** (Austen, 2026-08-05, reversing an earlier
  withhold): *"I actually think practice should be used by the ghost and the
  camera should be opened and I think that's part of the effect."*
- **"Wait — can it see me?" only if the camera really connects** (Austen,
  2026-08-05). It is a reaction gated on `cameraLive`, fed by
  `data-ghost-state="camera-live"` which `CameraPreview` sets when the stream has
  started and the video element is attached — not when the button was pressed.
- **Name the thing; do not narrate its purpose** (Austen, 2026-08-05). *"I want
  to see it from the inside? No. They would say let's see what it looks like in a
  tunnel."* The card is something you review or send, not something you hold.
  Nobody announces what a mandala is before pressing it.
- **Curiosity first, fondness after** (Austen, 2026-08-05, on Ghost): *"it can
  wonder what does the ghost mean or what does the ghost do. And then once it's
  already encountered it it can say I liked that ghost effect."* Hence
  `FIRST_ENCOUNTER_NAMED` and the encounter-gated motive.
- **`overwhelmed` should be rare** (Austen, 2026-08-05): *"He sure does say
  that's a lot of buttons pretty often."* Capped at twice a session, appeal 0.08.
- **Per-module scripts stay rejected** (design + Austen's own decision list). The
  PostHog idea was approved as WEIGHTS and personality profiles, not scripts —
  and see Gotchas for why the weights part is premature.
- **Entry is `?present=1` only**, plus the F9 admin chip added this session.
  `?present=<seed>` replays; `?present=0` disarms.
- **Navigation presses real nav DOM only.** The only sanctioned programmatic move
  is the safety/escape hatch via `handleModuleChange`.
- **Idle-resume is production-only** (derived from Austen's HMR ask, 2026-08-05):
  in dev the only way back is an explicit resume, because a ghost that grabs the
  wheel back 30s after he touched something is the same annoyance in a new
  costume.
- **The museum owns its own autopilot**, not the presenter. The ghost is a
  DOM-only observer by design; teaching it to steer a 3D character would put
  pathfinding in a file that must never import feature code.

## Gotchas

- **Editing ANY attract or museum file while a tour is running triggers an HMR
  remount** that wipes `window.__ghost` / re-creates the docent. This cost this
  session about an hour: the museum docent's "mysterious ~40s stop" was entirely
  self-inflicted HMR. Finish the edit, reload, THEN watch. `window.__docent`
  reports `instanceId` — if it changes, you remounted, and nothing is wrong with
  the docent.
- **PostHog numbers are wrong unless you filter.** `memory/reference_posthog_reading_traffic.md`
  documents it and this session still got it wrong: Learn looked like the app's
  engagement hotspot and it was 100% Austen's own dev traffic
  (`PositionsConceptExperience.svelte`, which he was building). ALWAYS exclude geo
  Chicago, hosts `localhost` / `127.0.0.1` / `dev*.tkaflowarts.com`, and bot geos
  Ashburn / Luleå / Forest City / Council Bluffs. Filtered, 60 days: landing 114
  sessions, `create/construct` 107, `composer` 61, `q/SJJ6` 26,
  `create/generate` 21, `browse/gallery` 15 — **Learn does not appear and `guide`
  has 3**. Also: only ~100 real interacting sessions exist, which is far too few
  to cluster personalities or build a transition matrix from. Revisit after the
  app has traffic. Written up as `memory/feedback_posthog_filter_dev_traffic.md`.
- **The camera needs a one-time manual grant on the origin the park laptop uses**,
  or `try-practice` silently never fires. The browser permission prompt is native
  chrome: the ghost cannot press it, cannot dismiss it, and `elementFromPoint`
  cannot see it. It fails closed on Safari too, which does not implement the
  camera permission query.
- **A modal with a backdrop makes the ENTIRE annotated world unpressable**,
  because every `can` is gated on the `elementFromPoint` hit-test. This is the
  single most dangerous shape in the system. Any new unsolicited overlay needs a
  `dismiss`-annotated escape, and any dialog the ghost itself raises needs
  `ghostConfirm` on `ConfirmDialog`.
- **`ConfirmDialog`'s `ghostConfirm` is opt-in per call site on purpose.** Never
  set it on anything that deletes saved work, spends money, or touches an
  account.
- **The docent's steering is grid-native on ROUNDED tiles, deliberately.** The
  player's world position does not sit on tile centres — measured live, tile Y
  held a permanent `.75` offset. Against a fractional position, distance to an
  integer waypoint never falls under an arrival epsilon and a one-row step reads
  as 0.25, under the direction threshold, so it can only move along X. Do not
  "simplify" it back to a distance check.
- **The docent targets the NEAREST few exhibits, deliberately.** Random choice
  picked plaques 76 and 166 tiles away, so it never arrived and the tour was
  permanently in transit showing corridors.
- **`DimensionFlipProof.svelte` is the real museum scene host** despite the name;
  `MuseumModule` and `PersonalMuseumModule` both render it.
- **Effect commentary is keyed by LABEL, not id.** The registry ships
  `charcoal`/"Coal" and `sparkles`/"Sparkle" — keying by id silently misses both.
  Frost is retired (Animal took its slot); its code is dormant but unregistered,
  so there are 16 chips.
- **Verify an effect's default before writing copy about it.** "The dragon one"
  was wrong: `defaults.ts` sets `creature: "snake"`.
- **`window.__ghost`** gives `seed`, `trail()`, `failures()`, `scores()`,
  `world()`, `memory`, `autoResume(bool)`, `pause()`, `resume()`, `stop()`.
  `scores()` is how the "build intentions were losing to the navigator" bug was
  found. **`window.__docent`** (dev only) gives `active`, `status`, `keys`,
  `tile`, and `debug()` with the target, path, instanceId and stopReason.
- **`/create/generate` takes ~14s to paint on a cold deep link and that is NOT
  the ghost** — reproduced with presentation mode off. It is
  `project_create_module_load_perf` (T4).
- **Never `goto()` or `history.back()` from the presenter.** They move the URL
  while the module system believes it is elsewhere and the shell renders empty
  until a human clicks a module. A static test guards it.
- **The +/- BPM buttons are pointerdown-driven** and `el.click()` cannot reach
  them; only the BPM presets are annotated.
- **`@austencloud/sidebar` is external**, so nav is matched by the package's own
  `data-tour-module` / `.section-button` rather than a TKA annotation.
