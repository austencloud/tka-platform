---
status: active
value: 4
effort: S
remaining: "Body status: Feature SHIPPED to main (`b90408a59b`). A follow-up bug is OPEN and"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Trail "Hand" tracking mode + thumb/pinky-renders-as-hand bug

**Status:** Feature SHIPPED to main (`b90408a59b`). A follow-up bug is OPEN and
UNVERIFIED — user reports that on the sequence viewer, trails still render at the
hand (prop center) even when Track is set to Thumb/Pinky. Could not be confirmed
or refuted from automation (see Blockers). Awaiting a clean runtime read.

Date: 2026-07-22. Author: Claude (Opus 4.8) session.

---

## TL;DR for the next session

1. The **Hand tracking option** (trails emit from the prop center = hand path) is
   built, tested, committed, and live in the dev bundle. Don't rebuild it.
2. The **open question** is whether Thumb/Pinky (and default) tracking actually
   put the staff trail on the ±135 TIP or wrongly at the CENTER on the sequence
   viewer. User says center ("rendering as hands"). Code inspection says tip.
   Not resolved — verification kept failing for environmental reasons.
3. Next step is a **2-line dev console.log in the trail capture** so a hard-reload
   + toggle prints the captured radius per mode (tip≈0.28 vs hand≈0.16 of canvas
   half). That definitively separates real-bug from the tip-passes-near-center
   illusion. See "Next steps."

---

## What shipped (commit `b90408a59b`, on main)

Adds `TrackingMode.HAND` — a fourth trail tracking option that emits from the
prop center (the hand path) instead of the tips. Trails-only; other tip effects
(fire/goo/etc.) use a different pipeline and were intentionally not touched.

Mechanism: `custom{dx:0,dy:0}` already resolves to the prop center in
`prop-position-calculator.ts:66-70`, so HAND is a source-resolution branch, not
new rendering. One branch in `resolveTrailPointConfig`; both overlays + the
capturer route it through `modeTracksRight`.

Files changed (9):
- `src/lib/shared/animation-engine/domain/types/trail-types.ts` — `HAND = "hand"` enum value.
- `src/lib/shared/animation-engine/domain/types/trail-point-types.ts` — `resolveTrailPointConfig(propType, trackingMode?)`; HAND → `{left:none, right:custom{0,0}}` (`HAND_TRAIL_CONFIG`).
- `src/lib/shared/animation-engine/services/trail-overlay-web-gl2.ts` — HAND in `modeTracksRight`; pass `trackingMode` to gating resolves; thread `trailConfig` into `capturePropTips`/`capturePropTipsInto` (removed a redundant per-frame re-resolve).
- `src/lib/shared/animation-engine/services/trail-overlay-canvas.ts` — same as webgl2.
- `src/lib/shared/animation-engine/services/trail-capturer.ts` — `resolveTrailSources` gets a HAND branch (`tracksRight` includes HAND).
- `src/lib/shared/effects/domain/effect-control-manifest.ts` — `TRAILS_TRACK_OPTS = [...TRACK_OPTS, {value:"hand", label:"Hand"}]`, used only for the trails Track control (shared `TRACK_OPTS` untouched so other effects don't show a broken Hand).
- `src/lib/shared/effects/domain/effects-config.ts` — `TrailsIntent.trackingMode` union widened to include `"hand"`.
- `src/lib/shared/animation-engine/components/canvas-context-menu/canvas-context-menu-builder.ts` — 4th "Hand" item (`fa-hand-back-fist`) in the right-click Tracking submenu.
- `src/lib/shared/animation-engine/services/__tests__/trail-point-resolution.test.ts` — 4 new tests (HAND→center resolution, HAND overrides lab assignment, world-space center placement, capturer emits one center point for a two-ended staff).

Enum values are string-identical to the option values, so `"hand"` string ===
`TrackingMode.HAND` — no conversion layer needed. The overlay reads
`animationSettings.trail.trackingMode` (NOT `effectsConfig.trails.trackingMode`;
`foldTrailIntentIntoSettings` deliberately does not copy trackingMode).

NOT built (separate, larger task): Hand for fire/goo/smoke/bubbles/etc. Those are
fed by `fire-tip-tracker.ts` → `buildEmitterTips` → per-renderer `isEndEnabled`
(A/B), with NO shared resolver and NO center point. Adding Hand there means a
synthetic center emitter in the tracker + a HAND case in ~11 renderers. My
earlier "all effects share one seam" claim was WRONG; corrected mid-build.

Verification done: `npm run check` exit 0; `trail-point-resolution` 15 pass
(4 new); overlay prop-swap-suppression 21 pass; effects default-config +
translator 32 pass. In ONE clean isolated-tab UI test, clicking Hand collapsed
the trail to tight center arcs while Thumb/Both reached outward — consistent with
working. But that visual test compared screenshots at DIFFERENT animation frames,
so it is not conclusive (see Blockers).

## Left deliberately un-done (flag, not a bug)

Legacy hand-rolled tracking rows in `VisualPane.svelte` /
`SimpleTrailControls.svelte` were NOT given a Hand button. Their tracking row is
gated `{#if hasBilateralProp}` and is a "which end" selector — Hand is
prop-agnostic and orthogonal, and gating it there would hide it for the
single-ended props (club, poi) that most benefit. Canonical surfaces (EffectsPanel
Track via `TrailsPanel.svelte`, and the right-click menu) carry Hand.

Concurrent-work note: at the time of this session, `TrailsPanel.svelte` was
UNCOMMITTED (` M`) in the working tree — another agent session added its OWN Hand
button (`TrackingMode.HAND`, `fa-hand-back-fist`) on top of my enum. Not mine to
commit. The user's `:5173` serves the working tree, so his window runs my
committed overlays + that agent's uncommitted UI.

---

## The OPEN bug

**Report (user, 2026-07-22):** "even though I have the tracking set to thumb or
pinky it's still tracking the hand" / "it's rendering as hands." His ORIGINAL
report (before the feature) was the same shape: "the trails are not using the end
tip points of the prop, instead tracing the very hand point itself"
(https://tkaflowarts.com/create/generate?v=OVMY, staff prop). The Hand feature
was the pivot he asked for AFTER that observation.

So the underlying question predates the feature: **on the sequence viewer, does a
staff's trail render at the ±135 tip (correct) or at the center/grip (bug),
regardless of trackingMode?**

### Proven facts (reliable)

- `resolveTrailPointConfig('staff', RIGHT_END)` → `{left:{tip,0}, right:{tip,1}}`
  (verified live via console import — the FUNCTION is correct and live).
  `getTipPoints('staff')` = `[{-135,0},{135,0}]`. So the resolver returns the TIP
  for thumb/pinky, NOT the center. No override/cache corrupts staff (staff uses
  hardcoded `STAFF_TIP_POINTS`; `tka-effect-points-cache` only holds computed
  props like bigclub/trigeng, never staff).
- Live plumbing forwards trackingMode end-to-end in code: UI →
  `animationSettings.setTrackingMode` → `PlaybackSync.update` (diffs trackingMode
  at `playback-sync.ts:602-620`, writes `state.setTrailSettings`) →
  `getEffectiveTrailSettings` (`frame-parameter-builder.ts:570`) → overlay render
  params. `enforceUnilateralConstraint` only forces RIGHT_END when BOTH_ENDS +
  non-bilateral; staff is bilateral so HAND/LEFT/RIGHT pass through.
- The WebGL2 overlay clears its rings on any trackingMode change
  (`trail-overlay-web-gl2.ts:330-341`) — it is reactive to the mode.
- `AnimationPlayer.svelte:183-204` builds `trailSettings` as a `$derived` reading
  `animationSettings.trail.trackingMode` reactively, passed to `AnimatorCanvas`.
- Conclusion from code: NO path renders a staff trail at the center for
  thumb/pinky. Only HAND mode or a `hand` prop → center.

### Blockers that prevented runtime verification (all real, all hit)

1. **Duplicate module instances.** Console `import('/src/lib/...')` in this app
   returns a DIFFERENT instance than the running bundle for service classes.
   Symptoms: prototype patches never fired (`renderFrame`/`captureFrame`/
   `executeFrame`/`gatherTrailPoints` all read 0 while a trail visibly rendered),
   and `setTrackingMode` via console import was a NO-OP on the real app (the
   Customize panel still showed "Both" after I "set" RIGHT_END). This is the
   `reference_devtools_console_module_instance` memory issue (import needs the HMR
   `?t=` query to hit the live instance). NOTE: `animationSettings` mutations DID
   reflect in one earlier test, so instance identity is inconsistent — do not
   trust ANY console-import instrumentation here.
2. **User's window is actively navigated.** The shared Chrome window kept moving
   (generate regenerates its `?v=` code on load; user switched to mobile layout,
   home page, choreo_card) — every measurement landed on a different page/state.
3. **Frozen tab.** Prototype patches added per-frame overhead; `computer`
   `left_click` began timing out (`Input.dispatchMouseEvent` CDP timeout). Pure
   canvas pixel-reads (drawImage→getImageData) did NOT freeze — only patching did.
4. **Visual A/B is frame-confounded.** The animation keeps playing, so screenshots
   in different modes are at different beats; "different trail" could be the frame,
   not the mode. Prop sprites are also blue/red and reach the tips, so a naive
   max-radius pixel metric can't isolate the trail from the props.

### Hypotheses (ranked)

1. **Stale service instance in the user's long-open window.** The trail overlay is
   built once at page load; HMR reloads the module but keeps the old live object,
   so a session open since before `b90408a59b` runs pre-fix code. A HARD reload
   (Ctrl+Shift+R) sheds it. Most likely.
2. **Geometric illusion, not a bug.** Staff tip = 135, hand orbit = 150. At radial
   orientations one tip swings to radius ~15 (near center) — so Thumb genuinely
   passes through the grip region for parts of the motion. Reads as "tracking the
   hand" but is the true tip path.
3. **A real render-path bug the code read missed** (e.g. the active viewer renderer
   is NOT the overlay and is tip-agnostic). Considered but not supported: the
   overlay is created at engine init and `skipTrailRendering = renderers.has("trails")`
   routes drawing to it. Could not confirm at runtime due to Blocker 1.

---

## Next steps (do these, in order)

1. **Add a dev-only console.log to the trail capture** to get a real-instance
   reading that also defeats the stale-instance problem (user hard-reloads → fresh
   code + fresh log). Suggested: in `trail-overlay-web-gl2.ts` `capturePropTipsInto`
   (and/or `trail-overlay-canvas.ts`), gated on `import.meta.env.DEV`, log
   `trackingMode` + the captured endpoint radius fraction
   `Math.hypot(endpoint.x - canvasSize/2, endpoint.y - canvasSize/2)/canvasSize`
   once per ~30 frames. Have the user hard-reload, play a staff sequence, toggle
   Thumb then Hand, and read back the two numbers.
   - Thumb ≈ varies 0.02–0.30 (tip epicycle), Hand ≈ ~0.16 steady → WORKS (illusion).
   - Thumb ≈ ~0.16 steady like Hand → REAL BUG; then find why the overlay isn't
     honoring the tip config on that surface.
   Remove the log after.
2. If confirmed working: close as illusion/stale-HMR; no code change. Maybe improve
   the Thumb visual so it doesn't read as center (out of scope unless asked).
3. If real bug: the fix is NOT in `resolveTrailPointConfig` (proven correct) — it's
   in whatever the viewer actually renders with. Re-audit the active trail renderer
   on the sequence-viewer surface WITHOUT console-import instrumentation (it lies);
   use the DEV log instead.

## Verification commands

- `npx vitest run src/lib/shared/animation-engine/services/__tests__/trail-point-resolution.test.ts`
- `npm run check` (full, before any commit)

## Related

- `.claude/rules/effects-earn-their-slot.md`, `crossfade-primitive.md` (unrelated, style ref)
- Memory: `reference_devtools_console_module_instance` (THE reason console probes failed here),
  `feedback_commit_push_without_asking`
- Prop tip geometry: `src/lib/shared/animation-engine/domain/types/prop-tip-points.ts`
