---
status: active
value: 4
effort: M
remaining: 'Updraft feel-prototype for the Air room (Plan B "The Last Lift"). One Opus executor. Gate: the lift must feel right before any Air room geometry is built.'
depends_on: 'docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md'
tags: [museum, air-room, updraft, prototype]
last_triaged: 2026-08-05
---
# Air room — updraft feel-prototype (2026-08-05)

## Why this exists

Austen chose **Plan B — "The Last Lift"** for the Air room
(`static/sketches/2026-08-05-air-room-floor-plans.html`): the visitor ramps to
landings A (+1.6) and B (+4.6), and then the final +4.6 → +8.4 is a **visible
updraft column** that lifts them to the overlook. The ~4 s rise IS the room's
reveal.

That mechanic does not exist anywhere in the codebase (verified: no
"updraft"/"wind"/"elevator" concept in `src/lib/features/museum` or
`src/lib/shared/3d`). Building the whole Air room on an unproven feel is the
failure mode this plan prevents. **Prototype the lift on a bare shaft first,
gate on feel, then build the room.**

Fallback if the gate fails: restore the all-rooms doc's ramp 3 (10 m run, east
wall, +4.6 → +7.6) and the room reverts to Plan A with nothing else moving.

## Scope — build exactly this, nothing more

A bare, walkable test shaft in the **existing empty `cave-air` bay**, reached
through the existing route `/test/museum-cave-3d`. No performers, no art, no
ledges beyond plain height markers. It doubles as the Air room's skeleton
later, so put it in the right bay rather than a throwaway scene.

### Phase 1 — the mechanic seam (shared code)

1. `src/lib/features/museum/domain/museum-grid-types.ts` — add an OPTIONAL
   method to `MuseumTerrainProgram`:
   ```ts
   /** Upward lift speed (m/s) at a world point, or 0 for still air. */
   updraftAt?(worldX: number, worldZ: number, worldY: number): number;
   ```
   Optional so every existing terrain program (Drowned Gallery, First Fire,
   Earth Canyon) compiles untouched.
2. `src/lib/features/museum/services/museum-physics-provider.ts` — add
   `updraftSpeedAtPlayer(): number` returning
   `this.terrain?.updraftAt?.(this.position.x, this.position.z, this.position.y) ?? 0`.
   Do NOT change `movePlayer`'s ground clamp — it is a floor-only clamp and
   already passes upward motion through unimpeded.
3. `src/lib/shared/3d/camera/UnifiedCameraController.svelte` — in the PHYSICS
   path only (the block at ~754-771), consult the lift before the gravity
   branch:
   ```ts
   const lift = physicsProvider.updraftSpeedAtPlayer?.() ?? 0;
   ```
   - If `lift > 0`: ease `verticalVelocity` toward `lift` (exponential
     approach, e.g. `verticalVelocity += (lift - verticalVelocity) * min(1, RISE_EASE * delta)`)
     instead of applying gravity. This is what makes walking in feel like being
     picked up rather than launched.
   - If `lift === 0`: existing gravity/jump behavior, unchanged. Do not zero
     `verticalVelocity` on exit — letting residual upward momentum decay under
     gravity is what makes the crest feel like an arc instead of a wall.
   - Guard the whole thing behind `lift > 0` so the kinematic path and every
     non-museum consumer of the UCC are bit-for-bit unaffected.
   - Tune constants as named module consts, not magic numbers.

   **Do not** touch the jump impulse, `SCALE.TERMINAL_VELOCITY`, or the
   kinematic path.

### Phase 2 — the bare shaft

4. New `src/lib/features/museum/data/air-chimney-layout.ts`, modelled
   structurally on `first-fire-layout.ts` (single geometry source; the graybox
   may draw NOTHING the layout module does not know about). For the prototype
   it needs only:
   - `bayBounds` for the `cave-air` room (derive from the grid the same way
     `buildFirstFireLayout` does).
   - A flat floor rect at the bay datum, a low entry platform at **+4.6**
     reached by ONE plain ramp (stand-in for ramp 2 — do not build the real
     switchback yet), the **updraft column** footprint, and a landing lip at
     **+8.4** the column delivers you onto.
   - Three plain height-marker posts at +1.6 / +4.6 / +7.6 so the rise reads
     against something. Boxes, not ledges.
   - `createAirChimneyTerrain(grid)` exporting `elevationAt`, `blockedAt`, and
     the new `updraftAt` — returning the tuned lift inside the column footprint
     between the column's base and its top, 0 elsewhere.
5. New `src/lib/features/museum/components/game/AirChimneyGraybox.svelte`,
   modelled on `FirstFireGraybox.svelte`, mounted in `Museum3DScene.svelte`
   beside the other three grayboxes. Render the column as a visible translucent
   cylinder plus rising motes so the player can SEE where the lift is —
   reuse `environments/primitives/FallingParticles.svelte` with inverted
   velocity if that is cheap, otherwise a simple instanced points cloud.
6. Register the terrain in `buildVulcanCaveFloorPlan()`'s `composeCaveTerrain([...])`
   list alongside the existing three.

### Phase 3 — tune to the target feel

Target numbers, to be hit and then reported with measured evidence:
- Rise of **+3.8 m in ~4 s** (so a steady-state lift near **1.0 m/s**), with
  the ease-in occupying roughly the first 0.5 s.
- **No jump input required** — walking into the column is the whole
  interaction. Verify a player who never presses jump completes the rise.
- The player must not overshoot past the +8.4 lip and float in the void, and
  must not be able to hover indefinitely at the top. The column's `updraftAt`
  returning 0 above the lip height plus normal gravity should settle them.
- Stepping out of the column mid-rise must drop the player safely (gravity
  resumes; the floor clamp catches them).

## Verification required (evidence in the final report)

1. `npx vitest run tests/unit/museum/` — full pass, count reported.
2. `npm run check` (or `check:fast` if another svelte-check is running
   machine-wide per `resource-budget.md`) — report errors, and explicitly
   separate any that are in other sessions' files.
3. **A measured rise trace**, not a claim: with the browser on
   `/test/museum-cave-3d`, teleport into the column and sample the player Y
   over time via `evaluate_script`, printing `{t, y}` pairs. Report the rise
   duration and total gain. This is the number that proves ~4 s / +3.8 m.
4. **Screenshots** (webp, quality 70) at 1920: standing at the column base
   looking up, mid-rise, and cresting at the lip. Read them for the defects in
   `visual-verification-mandatory.md` before reporting.

Teleport recipe, lighting gotchas, rect-cell math, door-derived gaps, and the
"one geometry source" rule: reuse the **"Non-negotiable gotchas"** section of
`docs/superpowers/plans/2026-08-04-first-fire-graybox.md` verbatim. Note the
DevTools `emulate` dpr gotcha (pass target × 1.1).

## Ledger

- [x] P1.1 `updraftAt?` on `MuseumTerrainProgram` — optional, `worldY` is the
      player's physics position; `composeCaveTerrain` forwards it per bay.
- [x] P1.2 `updraftSpeedAtPlayer()` on `MuseumPhysicsProvider`; `STANDING_Y`
      exported so the layout can express the lift ceiling in player-Y.
      `movePlayer` untouched.
- [x] P1.3 UCC lift branch. **Deviation:** the museum imports
      `UnifiedCameraController` from `@austencloud/camera-3d`, NOT
      `src/lib/shared/3d/camera/UnifiedCameraController.svelte` which the plan
      named. Both live copies now carry the identical branch; the package
      resolves via its `svelte` export condition (source, no dist build).
- [x] P2.1 `air-chimney-layout.ts` + `createAirChimneyTerrain`.
- [x] P2.2 `AirChimneyGraybox.svelte` mounted in `Museum3DScene.svelte`. Motes
      reuse `FallingParticles` in `embers` (rising) mode.
- [x] P2.3 terrain registered in `buildVulcanCaveFloorPlan()`; `cave-air`
      resized to 34 × 48 minInterior and joined the tile-suppressed set.
- [x] P3.1 measured +3.81 m in 3.93 s, no jump input, ease-in 0.372 m over the
      first 0.5 s, overshoot 0.013 m.
- [x] V1 `npx vitest run tests/unit/museum/` — 26 files / 281 tests passed.
- [x] V2 `npm run check` — exit 0, 0 errors 0 warnings.
- [x] V3 rise trace reported (browser, `/test/museum-cave-3d`).
- [x] V4 screenshots read; two defects found and fixed (column shell opacity,
      lip rim walling in the overlook), one logged below.

## Findings for the Air room decision

1. **The lift itself lands the target.** 4.6 → 8.4 in 3.93 s with a soft pickup.
   Stepping out mid-rise (measured at 7.06 m) drops the player onto the +4.6
   platform in ~0.3 s — safe, and it reads as a consequence rather than a death.
2. **The 2D physics seam is the real constraint.** `blockedAt`/`elevationAt`
   take no Y, and the ground clamp is a minimum — so any ledge XZ-adjacent to
   lower ground can be walked straight UP onto. The prototype closes this with
   blocked rock rims, which is why the overlook is fenced. A real Air room
   either keeps the fence (now a knee-high parapet) or the terrain program needs
   a Y-aware blocker.
3. **The top hovers, it does not settle.** Lift cuts at the lip, gravity pulls
   back under it, lift resumes: the player bobs within ~1 cm at lip height
   instead of descending. Beside a ledge you can step onto, that reads as
   forgiving — but it is not the "gravity settles them" the plan assumed. If the
   room wants a real dismount, the column needs a spent-state, not a ceiling.

## Commit discipline

Explicit pathspec ONLY (`git commit -m "..." -- <paths>`); new files need
`git add <paths>` first. The index is shared with several parallel sessions and
the checkout carries their dirty files — do not stage, commit, or revert
anything outside this plan's file list.
