# First Fire Torch Procession: 3D Handoff (2026-08-06)

## Mission

Replace the current First Fire amphitheater with the approved Torch Procession:
a steam threshold from Water, an ember bridge, three isolated DJ, EK, and FL
shrines, total red extinction, then a bounded green route into Earth. The
governing design and measured plan are in the
[Torch Procession spec](./2026-08-06-first-fire-torch-procession-design.md).
This handoff exists so the 3D pass can start from tested geometry and state
rather than reinterpret the brainstorm.

## Done: verified

- **Canon and governing spec, commit `994bb600be`.** Fire is the sole
  three-performer cave exception. The previous amphitheater spec is archived,
  and the story bible records the exception. Evidence: tracker decision
  `jl8TveF5GrOgHsA2Vyfr` is accepted and completed; the tracker session
  `vOJcIbVJ76gQCaEo4N9L` is completed.
- **Measured floor plan, commit `994bb600be`.** The replacement has a 60 by 30
  metre interior, three separated shrine footprints, alternating blind turns,
  a continuous Water-to-Earth route, and exact room-relative coordinates.
  Evidence: `first-fire-procession-plan.test.ts` proves the dimensions, compiled
  authoring scale, route continuity, rock clearance, shrine separation,
  performer-pair occlusion, and no dual-performer view across route samples
  spaced 0.2 m apart.
- **Resize proof, commit `994bb600be`.** The existing production shell compiles
  to 46.5 by 20.5 m and cannot hold the measured plan. Evidence: the grid
  integration test deliberately rejects it with the required and actual
  dimensions in the error.
- **Interaction state, commit `994bb600be`.** The pure state contract advances
  DJ, EK, FL, extinction, and growth in order. Later overlapping trigger zones
  imply earlier ones; repeat events are idempotent. Evidence:
  `first-fire-procession-state.test.ts` covers order, missed boundaries,
  repeated events, re-entry persistence, and new-run reset.
- **Review drawing, commit `994bb600be`.** The SVG carries plan dimensions and
  shrine centres as machine-checked metadata. Evidence: its XML parses, and the
  plan test asserts the 60 by 30 m frame plus DJ (16.5, 8.5), EK (31.5, 21.5),
  and FL (47, 8.5) coordinates.
- **Regression suite, commit `994bb600be`.** Command:
  `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/museum/first-fire-procession-plan.test.ts tests/unit/museum/first-fire-procession-state.test.ts tests/unit/museum/first-fire-terrain.test.ts tests/unit/museum/first-fire-traversal.test.ts tests/unit/museum/vulcan-cave-floor-plan.test.ts`.
  Result: 5 files passed, 59 tests passed.
- **Copy and file validation, commit `994bb600be`.** Prettier passes on the new
  TypeScript and spec, ESLint reports no source errors, the SVG parses as XML,
  the inline plan JavaScript parses, and the task files have no trailing
  whitespace. The documentation copy passes the project AI-pattern scan.

## Believed done: unverified

- The static drawing is structurally valid but has not been browser-rendered.
  Browser use was not authorized in this conversation.
- The plan has not been walked in first person. Geometry tests prove the 2D
  contract, not camera-scale drama, torch density, ceiling composition, or the
  emotional timing of extinction.
- Audio isolation is specified and supported by the rock plan but has not been
  measured in a running scene.
- The 126-stem budget is a production ceiling, not a measured frame-time result.

## In flight

- Branch: `main`. Groundwork commit: `994bb600be`.
- Production Fire integration has not started. The existing
  `first-fire-layout.ts`, `vulcan-cave-floor-plan.ts`, and current amphitheater
  tests still drive the live room.
- Other sessions have uncommitted changes in `FirstFireGraybox.svelte`,
  `EarthCanyonGraybox.svelte`, `Museum3DScene.svelte`,
  `MuseumPerformerStation3D.svelte`, `museum-room-light-pool.ts`, room lifecycle,
  streaming, and several other cave components. Do not overwrite or revert
  them. Recheck status before editing.
- The conversation-only interactive plan lives under this thread's
  `.codex/visualizations` directory and is intentionally outside the project
  commit. The canonical review asset is the SVG beside this handoff.

## Loose ends, ranked

1. **Rebase the plan onto the landed museum work.** Read the current diffs in
   every overlapping file. Resolve ownership before editing.
2. **Resize the Fire shell.** In `vulcan-cave-floor-plan.ts`, replace the old 62
   by 27 authoring minimum with
   `FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM` from the new plan. Update the room
   description and derive all three performer placements from the shrine
   centres. Run the whole cave floor-plan and museum-walk suites because a
   wider Fire room moves every downstream room.
3. **Replace the terrain contract.** Rewrite `first-fire-layout.ts` around the
   new plan's path sections, trench annuli, rock ribs, entrance hazards, and
   exit growth path. Preserve the existing rule that physics and meshes consume
   one geometry source. Replace amphitheater assertions in the existing terrain
   and traversal tests; do not keep both layouts alive.
4. **Build the graybox from the plan.** Render steam, bridge, torch ribbons,
   three shrine pockets, trenches, rock ribs, and the final growth route. The
   first target is spatial truth, not finished particles.
5. **Wire one room-scoped state owner.** Use
   `first-fire-procession-state.ts`. Expose active performer step index and
   within-step progress through a narrow callback or adapter. Never synchronize
   the three performers as an ensemble.
6. **Add bounded effects.** Reuse tracked `FireRenderer3D` for moving prop
   flames. Follow the existing museum `InstancedMesh` placement pattern for
   repeated torch stems and low-cost flame cards. Reuse the room-light pool
   after its current edit lands. Keep detailed fire on one shrine at a time.
7. **Connect Earth without spending its reveal.** Extend the existing bent
   grass gully only after every red source is gone. Growth remains on the final
   shrine and transition path.
8. **Run the full acceptance gate.** Terrain and sightline tests, museum walk,
   typecheck, console pass, merged-scene draw calls and frame time, visual
   frames, then Austen's first-person walk.

## Decisions already made

- Austen locked the Torch Procession on 2026-08-06.
- The order is Water steam threshold, ember bridge, DJ, EK, FL, total red
  extinction, green ring, then Earth.
- The maze creates pressure without real dead ends or traps.
- Each shrine has a 240-degree orbit outside a narrow fire trench.
- DJ, EK, and FL remain separate solo encounters. No shared performance
  sightline or acoustic field is allowed.
- Completed flames collapse to low coals while the automaton keeps moving.
- FL extinguishes all red fire before any green appears.
- The green response comes from Earth's existing bent gully and stays bounded.
- No production 3D file may be edited around another session's uncommitted work.

## Gotchas

- `buildFirstFireProcessionPlanForGrid()` is supposed to throw against the
  current cave. That is the resize proof, not a failing implementation.
- `FirstFireGraybox.svelte` consumes the old amphitheater-shaped
  `FirstFireLayout`. Importing the new plan before replacing that renderer will
  not produce a partial upgrade.
- The east Fire door is south-aligned. Preserve it. The long green bend from FL
  to that door is what prevents Fire from exposing Earth's canyon early.
- Four activation zones overlap by 20 degrees. The state reducer advances to
  the highest reached zone, which is how it avoids a missed-trigger soft lock.
- The current room-light pool file is dirty. Inspect the landed contract instead
  of coding against today's two-slot implementation.
- The tracked `FireRenderer3D` models flames born at moving prop tips. It is not
  the field-torch solution.
- Shared particle-pool work is currently untracked and owned elsewhere. Do not
  make Fire depend on it until it lands.
- Full `pnpm exec tsc --noEmit --pretty false` is not green in the shared
  checkout. It reports unrelated in-flight errors in Browse, Choreo Cards, Lab,
  keyboard, pictograph, and museum files such as `museum-walk.ts` and
  `museum-geometry-builder.ts`. None of the errors reference the four new Fire
  source or test files. The focused 59-test suite is green.
- Port 5173 belongs to Austen. Do not restart it. Browser interaction still
  needs Austen's permission under the repository rules.
