# Bloom: Kinetic Optics

**Date:** 2026-08-11  
**Status:** Shipped  
**Surfaces:** 2D animation, 3D sequence viewer, coven stages, museum stations,
effect grid, and effect tuner

## Decision

Bloom renders captured light under motion, not colored circles attached to prop
tips. The live source and its scattered light are separate: `coreStrength` owns
the white-hot center, while afterglow stores only colored halo and motion streak.
Revisiting a pose cannot accumulate the white core or diffraction spikes into a
flash.

The shipped looks are three distinct optical archetypes:

| Preset      | Dominant image                                        |
| ----------- | ----------------------------------------------------- |
| `Supernova` | White-hot sharp source with a strong diffraction star |
| `Comet`     | Warm velocity blade with the longest exposure trail   |
| `Halo`      | Broad, quiet aura with almost no visible white center |

## Intent contract

Every Bloom field produces a visible response in both renderers:

| Intent                          | Response                                        |
| ------------------------------- | ----------------------------------------------- |
| `intensity`                     | Source exposure and local-light strength        |
| `coreStrength`                  | White source energy, independent of halo spread |
| `radius`                        | Halo radius and optical footprint               |
| `colorMode`, `color`, `palette` | Source and trail tint                           |
| `falloff`                       | Smooth or sharp halo shaping                    |
| `pulse`, `pulseRate`            | Time-based exposure modulation                  |
| `streak`                        | Velocity-aligned anamorphic stretch             |
| `spikes`                        | Diffraction-star energy                         |
| `afterglow`                     | Bounded colored halo and streak history         |

Version 34 added `coreStrength` and mapped legacy Ring to Smooth. Version 35
removed the abandoned fourth preset and its unused dispersion field. Migration
clears its saved preset id and strips the retired field from stored configs.

## Rendering contract

`BloomRenderer3D` receives stable `BloomTipSource3D` packets from every rig. One
instanced quad pool draws live sources and exposure-history samples across the
scene, so source count changes instance count rather than draw-call count.

The vertex shader projects tip velocity through the active camera. The fragment
shader composes the halo, hot core, velocity blade, and diffraction rays.
Historical instances use the same material with zero core and zero spikes.

Brightness is divided by the square root of active prop count. Dynamic lights
remain anchored to real visible tips, and a limited light budget is distributed
across performers without inventing averaged lights between props.

The 2D renderer follows the same decomposition. Its offscreen buffer retains
only moving colored scatter. The source, core, and spikes are drawn live once
per frame.

## Quality tiers

| Tier   | Live optics                    | History     | Lighting                  |
| ------ | ------------------------------ | ----------- | ------------------------- |
| High   | Full                           | Long, dense | Quality-capped tip lights |
| Medium | Full                           | Shorter     | Lower light budget        |
| Low    | Full identity, reduced samples | Short       | Off                       |

Quality changes may reduce retained samples and light work. They do not remove
streaks, spikes, color selection, or the selected falloff.

## Acceptance proof

- Supernova, Comet, and Halo have different dominant layer signatures in 2D
  and different optical signatures in 3D.
- Solid, prop-matched, rainbow, and palette modes reach the 3D material.
- Fast motion reads as optical exposure instead of a trail tube.
- The low tier preserves the shader identity without dynamic lights.
- Bloom contributes one instanced optical surface regardless of rig count.
- Local lights follow real moving tips and stay distributed across performers.
- A stationary or reversing tip cannot accumulate source energy in history.
- Saved configurations cannot retain the retired preset or dispersion field.
