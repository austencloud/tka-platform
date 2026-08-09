# First Fire: The Cinder Court — Gate 3 Visual Target Design

**Date:** 2026-08-09
**Scene:** `first-fire-cinder-court`
**Gate:** 3, registered visual target
**Status:** design approved, spec awaiting review
**Manifest:** `docs/superpowers/specs/first-fire-cinder-court/scene-gates.json` (`currentGate: 3`)

Gates 1 and 2 are approved. The measured plan and the playable graybox are
fixed. This document does not move a wall, a court, or a step of the route. It
decides what the approved room is made of, what lights it, and which seven
cameras the production slice must match.

## 1. Why this room is a volcano

The museum walk now reads winter, then ocean, then hot springs. The Cinder
Court is the vent chamber underneath, and it is the reason the springs are hot.
That is a spatial justification rather than a theme laid over the room: the
visitor descends into the heat source of the space they just left.

The room is a volcano interior. It is hostile, it is loud with heat, and it is
lit by nothing that is not on fire.

## 2. Fire is one instrument that gains a voice per court

Fire is not only flame. This room states three of its forms, and it states them
cumulatively: each court adds a voice rather than replacing the previous one.

| Court | Adds | Present |
|---|---|---|
| DJ | coals | coal |
| EK | flames | coal, flame |
| FL | lightning | coal, flame, arc |

Cumulative rather than one-per-court, so each mouth still announces exactly one
new thing while the last court becomes the full instrument. The extinguish then
sweeps three accumulated layers out of the room at once, which is what makes the
blackout large enough to carry the ending.

Registry ids, verified in
`src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`:
`charcoal` (Coal), `fire`, `zap`.

### 2.1 DJ is the hottest court, not the quietest

The risk in a cumulative design is that the first court reads as flame minus
flame. It must not. Coal is the hotter fire: quiet, white-hot, and unapproachable.
DJ sells that physically.

- Narrowest throat and the closest approach of the three courts. The performer
  sits nearest the walk line.
- `HeatDistortion` runs hardest here.
- A magma trench passes within arm's length of the walk line. The trench inner
  and outer radii are already fixed by the graybox at 2.7 m and 3.4 m against a
  2.2 m habitat.
- `charcoal` on the props leaves white-hot afterimages that decay over roughly
  one second, so the performer appears to drag heat behind them.
- No flame anywhere in DJ.

EK then opens up and breathes. Flame arrives as relief, not as an upgrade.

## 3. Material and lighting brief

**Surfaces.** Obsidian and basalt, near-black, low albedo. The floor takes
almost no light. Court walls are the same stone, unworked. This is geology, not
architecture.

**Sources.** Every photon in the room comes from something that is burning or
molten. There is no ambient fill, no sky, no practical that survives the
extinguish. This is a hard constraint, not a preference: the blackout before the
Earth reveal is only possible if the light budget is exhaustible.

**Ember-scene component mapping.** The look is dressed from the existing
`src/lib/shared/3d/environments/scenes/ember/` set rather than authored fresh:

| Component | Use in the Cinder Court |
|---|---|
| `LavaRivers` | the magma in the court trenches |
| `LavaCracks` | faint glow through the stone along the walked route |
| `LavaPool` | the far-field floor beyond the courts |
| `ObsidianPillars`, `ObsidianPlatform` | the basalt masses that occlude the next court |
| `CraterGround` | the room floor |
| `VolcanicHaze` | depth cue, separates the courts in the far field |
| `HeatDistortion` | proximity cue, strongest at DJ |
| `FireWisps` | lane and perimeter flame anchors |

Configuration lives in
`src/lib/shared/3d/environments/domain/models/scene-configs/ember-scene-config.ts`.

**Palette.** Black basalt, white-hot coal, orange flame, and a single cold
violet-white for the arc — the arc is the only colour in the room that is not on
the black-to-white heat ramp, which is what makes lightning read as arriving from
outside rather than rising from the floor.

## 4. The ending

1. FL's last arc grounds into the walked route.
2. All three accumulated fire layers extinguish at once. Black.
3. One strike of water on hot stone. Steam, hissing, under a second. Not
   rainfall — the visitor never stands in rain and never sees falling water.
4. Green rises out of the strike scars, along the exact path already walked.

Water appears only as the sound of it dying on the rock. Steam is the hot
springs' material, so the ending reaches back one room rather than repeating the
ocean two rooms back. It is also the honest physics of water meeting basalt at
volcanic temperature.

The staged-reveal invariant from Gate 2 still holds: every green mesh carries the
runtime `FF_Growth` prefix, and no green exists in the room until the last fire
is out.

## 5. Deliverables

### 5.1 Locked camera set

Seven cameras, registered to the seven Gate 2 walk frames already in the
manifest as evidence:

| # | Camera | Graybox frame |
|---|---|---|
| 1 | arrival on the ember bridge | `walk-01-ember-bridge.webp` |
| 2 | DJ mouth | `walk-02-dj-mouth.webp` |
| 3 | DJ cooling | `walk-03-dj-cooling.webp` |
| 4 | EK mouth | `walk-04-ek-mouth.webp` |
| 5 | FL mouth | `walk-05-fl-mouth.webp` |
| 6 | blackout | `walk-06-blackout.webp` |
| 7 | Earth growth | `walk-07-earth-growth.webp` |

Registering to approved frames is the point: it proves the visual target is the
same room the user approved, not a prettier different one. Each camera exports
position, target, and vertical FOV into the plan contract so the production slice
renders from identical transforms.

This satisfies the gate's `camera-registration` check.

### 5.2 Visual target board

The seven graybox frames paired one to one with their finished-look targets,
plus the material palette and the coal → flame → arc progression strip.

### 5.3 Material and lighting brief

Section 3 of this document, exported as the gate's `material-lighting-brief`
evidence with its digest recorded in the manifest.

## 6. The one piece of new engineering

`src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte` does
not carry the effect registry today. `TelekineticFormation3D.svelte` in the same
feature does drive registry effects, so this extends an existing museum owner
rather than creating a second effects path.

Relationship, per `never-hand-roll.md`: **extend** `TelekineticFormation3D`'s
effect-driving seam to `MuseumPerformerStation3D`. No new capability owner.

Gate 3 proves one performer can carry one registry effect. Full per-court wiring
belongs to Gate 4, the production slice.

## 7. Checks

**`camera-registration`** — every locked camera resolves to a Gate 2 frame, and
its exported transform reproduces that frame from the graybox.

**`silhouette-read`** — each court must be identifiable from its mouth as coal,
flame, or arc with colour stripped out. If DJ and EK are the same shape in
grayscale, the vocabulary has failed and the brief returns to this gate.

## 8. Out of scope

- Any change to the route, the court geometry, or the plan contract. Gates 1 and
  2 are approved and closed.
- Audio design. The steam hiss and the room rumble are named here as intent; the
  museum's audio path is not part of this gate.
- Full per-court effect wiring. Gate 4.

## 9. References

- `docs/superpowers/specs/first-fire-cinder-court/first-fire-cinder-court-production-contract.md`
- `docs/superpowers/specs/first-fire-cinder-court/scene-gates.json`
- `src/lib/features/museum/data/first-fire-procession-plan.ts`
- `.claude/rules/effects-earn-their-slot.md`, `.claude/rules/blender-first-3d-scenes.md`
