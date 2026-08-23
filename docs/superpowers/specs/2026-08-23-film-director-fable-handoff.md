# 3D Film Director for Fable — Handoff (2026-08-23)

## Mission

Continue the private `/test/film-director` instrument that turns a versioned written brief into a real, repeatable 3D film using deployed TKA environments, performers, props, effects, formations, and camera paths. The immediate goal is a film Austen can art-direct shot by shot and later use as the central product demonstration on the public Composer page. The governing design and capability truth are in [3D film director instrumentation](./2026-08-21-3d-film-director-instrumentation-design.md).

## Done — verified

All implementation in this section is uncommitted on repository baseline `fca6c4a2b7`; the handoff document has its own commit recorded at the bottom after publication.

- The private directing route accepts a validated version 1 film description, resolves deterministic defaults, drives the production 3D viewer, and preserves the last valid film when an edit is rejected. Evidence: the focused 2026-08-23 run passed 6 files and 24 tests, including schema validation, camera sampling, warm-up planning, performance policy, and environment-transition behavior:

  ```text
  pnpm exec vitest run tests/unit/film-director/director-camera-track.test.ts tests/unit/film-director/film-director-performance-policy.test.ts tests/unit/film-director/film-director-warmup-plan.test.ts tests/unit/film-director/film-director-schema.test.ts tests/unit/3d/environment-transition-compositor.test.ts tests/unit/3d/environment-transition.test.ts --exclude ".codex-tmp/**" --exclude ".claude/worktrees/**"
  Test Files 6 passed (6)
  Tests 24 passed (24)
  ```

- `Sky is the Limit` plays four real arrangements across autumn, forest, ocean, and celestial environments. The film changes cast layout, prop assignments, effects, count offsets, and camera paths from one versioned description. Evidence: runtime inspection on 2026-08-22 reached all four shots; at 32 seconds the celestial tunnel displayed all eight performers from its side camera position.

- Opening preparation hides asset construction behind one honest loading curtain. Repeated cuts retain warmed environments and the recurring three-avatar cast. Evidence: a warmed first preparation took about 15.5 seconds; a cache-bypassed preparation took about 17 seconds. Later autumn-to-forest and forest-to-ocean cuts requested zero resources.

- The visible seam now has one owner. Environment dissolves hold a complete captured outgoing frame while the incoming world, cast, effects, post-processing, and camera settle invisibly. The incoming clock resumes before the captured frame fades monotonically to zero. Fade-through-black uses one continuous full-frame black overlay and holds the clock at full black until the next composition is ready. Evidence: frame-by-frame browser traces showed no empty-world frame; autumn-to-forest prepared invisibly in 75 ms and forest-to-ocean in 129 ms, with a largest measured frame gap of 25.9 ms and no gap over 100 ms. On 2026-08-23 Austen reviewed the current page and said, “so much better.”

- Performer count offsets and the first-reveal gate have focused coverage. Evidence: the separate 2026-08-23 run passed 2 files and 3 tests:

  ```text
  pnpm exec vitest run tests/unit/3d-viewer/performer-initial-reveal.test.ts tests/unit/3d-viewer/performer-step-timing.test.ts --exclude ".codex-tmp/**" --exclude ".claude/worktrees/**"
  Test Files 2 passed (2)
  Tests 3 passed (3)
  ```

- The prepared viewer and its transition midpoint were inspected at 375, 960×412, tablet, 1440, 1920, 2560, and 3840 widths. The stage remained fully covered during the dissolve, controls remained usable, and no page overflow was introduced. The browser console was clean during the final temporal checks.

## Believed done — unverified

- The transition is mechanically clean under the measured four-shot proof, but Austen has not called it final or perfect. His latest judgment is “so much better,” not approval of every edit, camera move, or shot duration.
- Shared-viewer changes are opt-in and are intended to leave ordinary viewers unchanged. Focused tests and the private route support that claim, but the complete app has not received a regression sweep because the shared checkout contains extensive unrelated in-flight 3D work.
- The project-wide type check remains red from the shared dirty checkout. Do not represent the film work as fully typechecked until the unrelated failures are separated or resolved.
- Hidden retained environments stop drawing, but their registered background tasks may remain active. Memory and idle CPU behavior have not been measured over a longer film.

## In flight

Everything below is on `main` in the primary checkout. Do not create a branch or worktree unless Austen explicitly asks. The route and its tests are untracked; the shared viewer changes are mixed into a checkout with other agents’ 3D work.

Cleanly attributable to this film-director work:

- `src/routes/test/film-director/**`: complete private workbench, schema, resolver, deterministic sample direction, proof film, camera tracks, viewer adapter, playback state, warm-up plan, transition profiler, transport, JSON editor, and full-frame compositor.
- `tests/unit/film-director/**`: four focused test files.
- `docs/superpowers/specs/2026-08-21-3d-film-director-instrumentation-design.md`: untracked governing design and truth table.
- `src/lib/shared/3d/domain/performer-step-timing.ts`: untracked count-offset resolver used by the shared viewer.
- `tests/unit/3d-viewer/performer-step-timing.test.ts` and `tests/unit/3d-viewer/performer-initial-reveal.test.ts`: untracked focused coverage.

Relevant shared files with possible parallel-agent overlap. Inspect and select only the film-related hunks before any commit:

- `src/lib/shared/3d/components/Viewer3DCanvas.svelte`: retained environments, keyed shader warm-up, WebGL canvas exposure, and opt-in host-controlled transition mode.
- `src/lib/shared/3d/components/Viewer3DScene.svelte`: retained-world props, host-controlled transition forwarding, stable performer timing, and performer readiness.
- `src/lib/shared/3d/environments/components/Environment3D.svelte`: retained autumn/forest/ocean/celestial worlds plus atomic covered switching.
- `src/lib/shared/3d/environments/domain/environment-transition.ts`: pure host-covered switch behavior.
- `src/lib/shared/3d/components/SceneShaderWarmup.svelte`: readiness-aware two-paint warm-up and cache key support.
- `src/lib/shared/3d/environments/scenes/AutumnScene.svelte`, `ForestScene.svelte`, `CelestialScene.svelte`, and `ocean/OceanScene.svelte`: inactive retained worlds relinquish global scene state; GLB roots are not disposed; ocean image lighting is cached by renderer.
- `tests/unit/3d/environment-transition.test.ts`: host-covered retained-world test.
- `src/config/domains.ts`: `/test/film-director` needs standalone development-harness behavior, but this file also contains unrelated route changes from other work. Do not commit the whole file without reviewing every hunk.

## Loose ends (ranked)

1. Art-direct the proof film with Austen. Start by watching every seam and camera move at normal speed. Tune shot composition and pacing only after identifying the exact objection. Preserve the one-owner transition model.
2. Decide whether the captured-still outgoing half is the final editorial standard. It prevents construction frames and currently satisfies the visible-seam complaint. A true live-to-live dissolve requires two simultaneous rendered compositions or an offline fixed-frame compositor; do not imply the current dissolve renders two live worlds.
3. Add a deterministic fixed-frame capture and encoding path that consumes the same approved film description. It should produce one master plus smaller marketing variants without tying timing to live browser frame rate.
4. Measure retained-world memory and idle task cost before adding more environments or longer films. Introduce one shared active-world signal if hidden worlds continue expensive background tasks.
5. Connect arbitrary saved or generated sequences. The instrument currently drives the deployed demo sequence; the schema does not yet prove general library-sequence loading.
6. Return to the public Composer presentation only after footage is approved. The public route is unchanged. The adversarial Composer audit favored iteration over restart but found that its current 3D embed uses the wrong state owner and that the page does not demonstrate manual composition.

## Decisions already made

- On 2026-08-22 Austen asked for an instrument where he can describe a scene in ordinary language and Codex can translate it into a consistent schema, filling omitted details with reasonable defaults.
- The film must use the real 3D system and deployed catalogs. Missing astronaut, zombie, or moon assets must be rejected or enter the asset pipeline; they must not be presented as shipped capabilities.
- The marketing goal favors an authored video that demonstrates range without requiring visitors to operate a dense control surface.
- On 2026-08-22 Austen asked to pay the loading cost before playback or keep everything warm so later seams do not construct avatars, props, fire, or environments in view.
- On 2026-08-22 Austen rejected the first transition pass because performers and props froze over half-built worlds and competing fades exposed indecisive intermediate frames. Lower timing numbers were not accepted as visual proof.
- On 2026-08-23 Austen accepted the replacement as “so much better” and assigned the next pass to Fable.
- The public Composer route, shared launchpad, `SiteHeader`, and `SiteFooter` remain outside this film-director work.

## Gotchas

- Do not restore the ordinary environment veil for the film route. The rejected version combined that performer-only veil with an editorial fade, creating the exact floating-prop and half-world failure Austen saw.
- Automatic fade-through-black and manual shot navigation intentionally use different covers. The timeline owns the black overlay only when it is already opaque at the cut. Manual navigation falls back to the captured full-frame dissolve.
- The film clock must remain held while the incoming composition settles. It resumes before the first visible incoming frame so performers do not appear frozen when the cover begins to lift.
- `window.__tkaFilmDirectorTransitions` exposes the current and completed transition profiles in development. Console profiles use the label `[FilmDirector] environment transition`.
- First load is intentionally slower than a warmed cut. The opening curtain must remain opaque until both the environments and recurring cast have been exercised. Do not trade that integrity for a faster but visibly assembled opening.
- Port 5173 is Austen’s HTTPS development server. Do not start, stop, or restart it. Use `https://localhost:5173/test/film-director`.
- The checkout is heavily dirty with parallel 3D work. Never revert shared files wholesale, stage all changes, or use a bare commit. Commit only explicit reviewed paths.
