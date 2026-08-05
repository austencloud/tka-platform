# Goo + Animal 2D Effects — Handoff (2026-08-05)

## Mission

Austen asked for the **Animal** 2D effect to be made beautiful ("the bubbles are
way too big and kind of cartoony"), which turned into fixing its movement
physics, and then for the same treatment on **Goo**. Both effects live in the
Canvas2D backend and render into the 2D animation panel. No design spec exists;
the work was driven by screenshot review, round by round.

Both effects now render substantially differently from 2026-08-04. Goo in
particular was rebuilt around a different data model (sampled path instead of
free particles) and its user-facing controls were replaced.

Files owned by this work:

- `src/lib/shared/effects/renderers/animal-2d-renderer.ts`
- `src/lib/shared/effects/renderers/goo-2d-renderer.ts`
- `src/lib/shared/effects/translators/canvas2d-translator.ts` (animal block only)
- `src/lib/shared/effects/domain/defaults.ts` (animal + goo blocks only)
- `src/lib/shared/animation-engine/components/effects-panel/customize/GooCustomize.svelte`
- `src/lib/shared/animation-engine/components/effects-panel/presets/goo-presets.ts`
  (summary line only)

## Done — verified

Verification for every visual item was a screenshot taken by the agent at
`https://localhost:5173/test/effect-tuner` and read. **The screenshots live in a
session scratchpad and are gone** — the reproduction command is given instead,
and re-running it is the audit path. See Gotchas for how, because the normal
tooling was unavailable.

### Animal

1. **`bfb4b797ed`** — slimmer creatures, shaded bodies, non-googly eyes.
   Half-width maps 2.5–15.5px (was 5–30), spine 160–600px over 56 nodes (was
   40), per-creature build multiplier (caterpillar ×1.55, dragon ×1.15, snake
   ×1.0) with its own width profile. Body gained a contact shadow, clipped
   cylinder shading, scale chevrons, a fading sheen. Head became a tapered wedge;
   eyes became small heading-aligned almonds with slit pupils.
   *Evidence:* screenshots at 1200×900 dpr2 of snake / Ember Drake / Inchworm —
   read and iterated on (the Inchworm pass is what forced the per-creature build
   multiplier, since a global slim-down turned the caterpillar into a hair).
   `npx vitest run .../presets/preset-data.test.ts` → 6 passed.

2. **`52e163e522`** — body traces the tip's path instead of dragging behind it.
   This was the real physics bug: the body was a follow-the-leader distance
   chain, so a tight arc yanked the tail straight and it hung off the head like a
   weighted rope. Now each tip's positions are recorded as a polyline and the
   spine is resampled at fixed arc-length steps. Slither dropped 34px→20px at
   full because a big lateral wave serrates a figure the body is now actually
   drawing.
   *Evidence:* screenshot at tuner speed 1.0 showing two serpents each wrapping
   their own petal of the pattern and closing the curve — the shape the props
   draw is legible in the creature. Austen confirmed: "Awesome."

### Goo

3. **`d3c85e9ff9`** — threshold density, not colour.
   Root cause of the white-amoeba look: the metaball pass summed **coloured**
   blobs then ran `contrast(14)`, which binarizes each channel independently, so
   any overlap saturated to pure white with a cyan fringe. The field is now
   grayscale density; the silhouette is colorized after by multiplying with the
   palette. Body takes `puddleTint`; a second dimmed threshold erodes and
   outer XOR eroded gives a rim band tinted with `edge`.

4. **`a691f9b4cb`** — emit per distance travelled.
   Bead count came from elapsed time, so the same handful landed whether the tip
   crawled 3px or flew 60px in a frame; past walking pace the spacing outran the
   bridge blur and the mass shattered into islands. Also cut velocity inheritance
   from 88% → 22%, which was launching the liquid off the arc it was laid on.

5. **`6cf5d6b4ae`** — directional rim, graded depth, tail pinch-off.
   Rim ring is cut with the eroded mask pushed away from the light, making a
   crescent instead of an even outline. Three nested thresholds give a
   cross-section (bright outer ring → mid → bare body colour). Beads shrink over
   life instead of growing, so the tail necks down instead of ending in a cap.

6. **`569f56b327`** — the stream is a sampled path, and the sliders work again.
   Two structural problems. (a) Sliders were dead: per-distance emission put a
   geometric floor under the count, and Motion could only add on top of a floor
   already at the visual limit. (b) The body was still independent particles.
   Both fixed: count is geometry, knobs own mass/drips/opacity, and the body is
   the tip path resampled at fixed arc-length steps.
   *Evidence:* Motion driven to both extremes in one session —
   `slider-motion-min.webp` (5% → thin wisp) vs `slider-motion-max.webp`
   (100% → fat ribbon), same frame otherwise. This is the proof that the
   sliders reconnected; **re-run it if you touch emission** (script pattern in
   Gotchas).

7. **`db9000563b`** — Viscosity replaces the emission knobs; stream welded to tip.
   `surfaceTension` had been on `GooIntent` since the droplet era, unread, with
   per-preset values already set (Mercury 1.0, Spirit 0.0, Whip 0.2). It is now
   the Viscosity slider and drives drip rate, body life, taper onset, and bridge
   blur together. Panel reads **Viscosity / Amount / Intensity**; Drip is gone
   because it is a consequence. Head cap bead added — density falls off at both
   ends of the stream, so the threshold was eating the tip and the mass read as
   lagging behind the prop.
   *Evidence:* viscosity 0 (stringy, necks off early) vs 100 (thick congealed
   mass wrapping the props), captured back to back. Viewport sweep at
   1440/1920/2560/3840 — renderer is scale-aware and holds at all four.

8. **`50ee94d146`** — pool and hang at a stationary tip.
   Regression introduced by #7: removing the Drip slider took the ambient
   behaviour with it. A slow tip lays no arc length, so nothing resamples and
   only the cap bead survived — the goo blinked out whenever the props paused,
   which at 60 BPM is most of a step. A pendant now grows below the head as speed
   falls, scaled by viscosity.
   *Evidence:* tuner at speed 0.1 (previously near-empty) now shows both tips
   carrying real mass with a drop forming below.

### Test state

`npx vitest run src/lib/shared/effects` → **212 passed, 2 failed**.

Both failures are **pre-existing and unrelated** —
`effect-control-manifest.test.ts`: `trails.tailLength` missing from the default
intent, and `pulse` has 8 primary controls where the test caps at 5. Proven
unrelated by running that file alone against a clean tree (last commit touching
the manifest is `db61d16eae`, not from this session). Do not attribute them to
goo/animal.

`npx tsc --noEmit -p tsconfig.json` → clean for all files above.

## Believed done — unverified

- **Small viewports (375×667, 820×1180, 960×412).** Screenshots were taken but
  are worthless: `/test/effect-tuner` is a desktop-only harness (its own header
  says "Gallery layout for ultrawide"). At 820 its columns overlap and squeeze
  the stage to a ~90px thumbnail; at 375 the canvas is off-screen entirely. The
  renderer multiplies every dimension by `sc` and verifiably scales 1440→3840, so
  small sizes are *expected* to work — but nobody has looked. Needs the real
  surface (see Loose ends #1).
- **Export path.** Neither effect was checked through video export. The goo
  renderer now allocates a **second** offscreen canvas (`work`), and export runs
  a different canvas lifecycle. Worth a look before shipping either effect in an
  export.
- **Performance.** Goo submits up to `MAX_BEADS = 1400` radial-gradient fills per
  frame plus four full-canvas filtered `drawImage` passes. Never profiled. Ran
  smooth by eye in the tuner at 1.5 dpr; that is not a measurement.

## In flight

**Nothing of this work is uncommitted.** All eight commits are on `main`, local,
**unpushed** (`main` is ahead of `origin/main` by 23 commits, most of them other
sessions').

The working tree holds ~244 modified/untracked entries belonging to **other
concurrent sessions** — animation-engine visibility, webgl3d translator,
onboarding, gallery, museum, and more. None of it is mine. Do not commit,
revert, or stash any of it (see Gotchas).

## Loose ends (ranked)

1. **Verify goo + animal on the real surface at small sizes.** Austen's own
   screenshots came from `localhost:5173/create/generate?v=<code>` and
   `/browse/gallery?v=<code>`. His last one used `?v=1GXT`. Load that with the 2D
   animation panel, select Goo, and check 375×667 / 960×412 / 820×1180. His
   screenshots have twice caught things the tuner never exercised (clubs, and the
   slow start of a sequence).
2. **Goo drip visibility.** Drips are implemented and wired to viscosity, but no
   screenshot in this session clearly showed a drop detaching, falling, and
   landing. Either they are too rare at default viscosity 0.45, too short-lived
   (`maxAge` 0.7–1.5s), or they are being lost under the threshold. Confirm they
   read before calling the feature done.
3. **Goo is one bead wide.** "Mass" is bead radius, not a real cross-section, so
   Amount at 100% makes a fat tube rather than a wide sheet. Laying 2–3 beads
   across the stream normal would give genuine width. This is the biggest
   remaining fidelity gap.
4. **Animal: speed-varying thickness and drifting glints.** Both were on the
   improvement list Austen approved and neither was done for animal (goo got
   speed-stretch; animal did not). The animal body is still constant-diameter.
5. **Goo sag between anchors.** Needs the path to be relaxable rather than a pure
   record — a real change, not a tuning pass. Deliberately deferred.
6. **Pre-existing manifest test failures** (`trails.tailLength`, `pulse` primary
   count). Unrelated to this work but they make `vitest run src/lib/shared/effects`
   red, which will mislead the next person.

## Decisions already made

- **2026-08-05, Austen:** "we generally don't want to use hyperlinks..." — n/a
  here, but the operative one: after the goo rewrite he said the controls should
  be **"something more intuitive like how much it congeals or something like that
  that's pretty cool or viscosity."** That is why Drip/Motion became
  Viscosity/Amount. Do not restore a Drip slider; drip rate is a consequence of
  viscosity by design.
- **2026-08-05, Austen:** the animal trail "does not follow the head... it should
  be slightly more likely to behave like a trail in the sense that it really wants
  to follow the path of the mandala that it shapes instead of pulling against it."
  Path-following is the intended model for animal. Do not revert to a physics
  chain.
- **2026-08-05, Austen** on goo: "acts too much like water and it congeals too
  much." Default viscosity was set to 0.45 as the middle ground; he has the slider
  now. If he asks again, move the default, do not re-architect.
- Animal presets were **not** renumbered when the width mapping changed — they
  all got thinner for free, which was the intent.

## Gotchas

- **The chrome-devtools MCP server disconnected mid-session and did not come
  back.** All screenshots from `d3c85e9ff9` onward were taken by driving Chrome's
  debug protocol directly. If the MCP tools are available to you, prefer them.
  If not, the pattern that works: `PUT http://127.0.0.1:9222/json/new?<url>` to
  open a tab, connect to `webSocketDebuggerUrl` with node's global `WebSocket`,
  then `Emulation.setDeviceMetricsOverride` → `Runtime.evaluate` →
  `Page.captureScreenshot` (`format: "webp", quality: 70`). Chrome must already
  be running via `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1`.
- **A blank white screenshot means the dev server is recompiling, not that you
  broke it.** This cost two debugging detours. After editing a renderer, wait
  ~20s before the first capture. `Runtime.exceptionThrown` was silent both times.
- **`I ran `git stash` by accident** in a compound command while gathering
  evidence for this handoff, which stashed ~244 files of other sessions'
  uncommitted work. It was restored immediately with `git stash pop` and verified
  (244 entries back, only the pre-existing `autostash` left in the list). Global
  Git Safety bans stash for exactly this reason — do not run it in this checkout,
  and be careful with `&&` chains that end in a git command.
- **Instrument before theorising.** Two goo bugs were invisible to reasoning and
  obvious to one `console.log`: leftover arc length resetting per segment instead
  of accumulating (almost no beads placed), and a slow tip never recording history
  because a below-threshold move updated the head point instead of appending.
  The second showed up instantly as path lengths `[1, 1, 71, 67]` — two of four
  emitters rendering nothing.
- **Additive compositing constrains the colour work.** Everything in goo
  composites with `lighter`, so depth can only be built by adding *less* toward
  the middle. You can never paint the interior darker. This is why the body takes
  the deep `puddleTint` and the rings brighten outward.
- **Goo bead spacing, radius, and bridge blur are a coupled trio.** Shrinking
  bead size without raising emission breaks the stream into separate beads —
  verified the hard way at 9px. `BEAD_SPACING` must stay under ~1.
- **`effect-control-manifest.test.ts` is red before you start.** See above.
- The effect tuner has a **solo mode** added by another session this same day
  (`d5116e873f`) — may be useful for judging one effect alone.

## Related

- `.claude/rules/effects-earn-their-slot.md` — the registry is source of truth for
  effect ids; `goo` and `animal` are both current.
- `.claude/rules/visual-verification-mandatory.md` — the loop this work followed,
  including the required viewport list this handoff only partly satisfied.
