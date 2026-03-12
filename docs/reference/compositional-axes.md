# TKA Compositional Axes

Seven orthogonal axes of composition in the TKA domain. Each can be "turned up" independently.

## Axis 1 — Motion Richness (per-hand complexity)

```
Grid location only                        → hand path
+ motion family (shift/dash/static)       → typed hand path (derivable from locations)
+ rotation direction (pro/anti/float)     → directional path
+ turns (0, 0.5, 1, ...)                  → quantified path
+ orientation (in/out/clock/counter)      → fully specified solo prop
```

## Axis 2 — Hand Count (combining performers on one body)

```
One hand                    → solo prop
Two hands combined          → pictograph (one beat, letters emerge here)
```

## Axis 3 — Temporal Stacking (beats in sequence)

```
One pictograph              → a single moment
Multiple pictographs        → a sequence (words emerge here)
Looped/repeated sequence    → LOOP pattern
```

## Axis 4 — Performer Count (bodies in space)

```
One performer               → solo
Two performers, same seq    → mirror/unison
Two performers, diff seq    → duet
N performers                → ensemble
```

Spawns sub-axis: floor positioning (where each performer stands, facing direction, spacing).

## Axis 5 — Effects & Dynamics (how it looks/feels)

```
Raw motion                  → the sequence itself
+ effort/dynamics           → effort timeline
+ visual effects            → trails, LEDs, fire properties
+ audio sync                → music-mapped timing
```

## Axis 6 — Show Structure (macro-scale composition)

```
One sequence                → a piece
Multiple sequences, themed  → an act (~3 min, one vibe)
Multiple acts               → a show
Multiple shows              → a career / body of work
```

## Axis 7 — Meaning (cultural/thematic layer)

```
A vibe or message           → what an act communicates
Variations/counterfoils     → how acts relate within a show
A broader theme             → what a show says
Lifetime themes             → what a body of work says
```

## Independence

These axes are genuinely orthogonal:
- A hand path (Axis 1: minimal) can be performed by 4 people (Axis 4: high) with fire effects (Axis 5: high)
- A fully specified solo prop (Axis 1: max) performed alone (Axis 4: min) with no effects (Axis 5: min)

## Current Software Coverage

The three-tier data model covers **Axes 1-3**. Axes 4-7 are future layers that sit on top without restructuring the foundation.

## Motion Type Taxonomy

Two separate enum systems that interact:

**HandMotionType** (hand's path through space — 3 values):
- SHIFT: hand arcs along perimeter to adjacent grid point
- DASH: hand moves straight line to opposite grid point (180° across)
- STATIC: hand stays put

**MotionType** (prop rotation during movement — 5 values):
- PRO: prop rotates with hand's travel direction (only on shifts)
- ANTI: prop rotates against hand's travel direction (only on shifts)
- FLOAT: prop doesn't rotate during shift
- DASH: no rotation, applied to dash hand motions
- STATIC: no rotation, applied to static hand motions

HandMotionType is derivable from locations (adjacent = shift, opposite = dash, same = static).
MotionType for shifts depends on whether user-chosen rotation matches hand path direction.
