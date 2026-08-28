# Flow Fest Sim electric unicycle production slice

Status: implementation rehearsal for the next interaction gate. Gate 3 remains `ready-for-review`; this document does not approve or advance Gate 4.

## Outcome

The normal `/test/flow-fest-sim` experience gives the player one electric unicycle at the measured lower-gate spawn. It is a first-class locomotion mode, not a walking-speed multiplier. The ride must preserve the existing DTM, visible-production collision, route, and review-camera owners while composing the established third-person camera and avatar owners for mounted play.

The registered Gate 3 visual-target query stays unchanged: no unicycle, new HUD, or altered camera may appear in `?gate3=1` captures.

## Control contract

- The player begins mounted on a charged wheel at the lower gate.
- `W` applies forward torque. `S` brakes, then commands a limited reverse after the wheel stops.
- `A` turns the rider left and `D` turns right in the established world-frame convention. Steering authority falls with speed and remains controllable at walking pace.
- `Shift` selects performance output while held. `Ctrl` applies strong regenerative braking.
- `E` parks the wheel when speed is at or below 1.5 m/s. Above that threshold the action fails closed and tells the rider to slow down.
- On foot, `E` mounts the parked wheel from within 2.2 m. The normal walk, sprint, crouch, and jump controls remain unchanged while dismounted.
- Mounted play uses the established collision-aware third-person camera. It follows the wheel heading while still allowing mouse look between heading changes. Dismounting restores the existing first-person walking camera.

Gamepad support uses the browser standard mapping when present: left stick steers, right trigger accelerates, left trigger brakes, the south face button mounts or dismounts, and the right shoulder selects performance output.

## Dynamics and collision

The unicycle dynamics owner works in metres, seconds, radians, and metres per second. It owns acceleration, service braking, coast drag, reverse limit, speed-aware steering, visual lean, wheel rotation, odometer, and battery use.

The existing Rapier kinematic character controller remains the sole movement/collision authority. The unicycle adapter accumulates only startup displacements smaller than Rapier's 2 cm controller skin, submits them as soon as they cross that boundary, then reconciles vehicle speed against the ratio between requested and corrected travel. This prevents low-speed acceleration from being mistaken for a collision without introducing a parallel terrain or collision representation.

Mounted collision uses the established player capsule. A parked wheel creates one fixed, visibly matching cylinder collider and removes it before remounting. Teleports and return-to-gate commands cannot leave a duplicate hidden wheel collider behind.

## Camera and presentation

Mounted play renders the existing `Avatar3D` player on the pedals and uses the shared third-person chase camera. The avatar, wheel, pitch, lean, heading, and ground position remain one visual hierarchy. The chase camera uses the shared collision-avoidance path against the measured terrain and visible production solids. Dismounting removes the mounted rider and restores the established first-person walking presentation.

The authored wheel uses PBR primitives with a pneumatic tire, rim, calf-height shell, stance-aligned pedals, vertical leg pads, head/tail emitters, and speed-driven wheel/lean animation. The shared `ch01` avatar remains the rider owner and is positioned over the pedal plane instead of intersecting a hip-height shell.

The single root-offset placement does not yet satisfy the two-pedal contact or
balanced-body fidelity claim. The open P0 work, recommended rig composition,
and mechanical close criteria are tracked as `FFS-FID-001` in
`flow-fest-fidelity-backlog.md`. Until that item closes, a plausible distant
silhouette must not be reported as an authentic EUC riding pose.

The HUD shows speed, charge, ride mode, and the current interaction affordance. Essential copy remains legible at the project's desktop, 4K, tablet, and narrow-phone review sizes. Touch layout evidence does not claim touch locomotion.

## Persistence

The versioned mobility snapshot is keyed to the Gate 2 coordinate fingerprint. It records mounted/parked mode, player X/Z, wheel X/Z, heading, charge, and odometer. Stale fingerprints, unreachable values, non-finite coordinates, and impossible charge/speed values fail closed to a fresh lower-gate wheel.

## Acceptance evidence

- Pure dynamics tests prove acceleration cap, braking/reverse behavior, steering response, deterministic integration, battery bounds, and collision reconciliation. A provider-level regression reproduces Rapier's 2 cm skin and proves that 120 forward frames travel more than eight metres instead of resetting to zero.
- Snapshot tests prove valid round-trip restoration and rejection of malformed or stale data.
- Runtime proof reports the exact controller config, input mode, mounted state, speed, charge, parked-collider state, player/wheel separation, and current coordinate fingerprint.
- Browser verification demonstrates mount, acceleration, steering, braking, safe-speed dismount rejection, successful parking, remounting, and collision with the parked visible wheel.
- Visual review covers 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, and 375×667.
- Existing Flow Fest focused tests, Gate 2 runtime verification, Gate 2 offline verification, and the scene-gate validator remain green.

## Performance targets

- No per-frame geometry, material, rigid-body, or collider allocation while riding.
- One additional visible wheel hierarchy and at most one additional fixed collider.
- No shadow-casting dynamic light on the wheel.
- The established settled desktop frame-time and draw-call budgets remain the governing limits.
