# Opus Adversarial Review — First Fire Navigation Reset (2026-08-09)

Verdict: **SOUND-WITH-FIXES** — the "topology carries navigation" argument
survived attack; the first implementation of it did not. All blockers were
fixed the same day (see Dispositions). Reviewer: Opus 5 at high effort,
configuration-space analysis (eroded-disk connectivity + widest-path).

## Findings and dispositions

| # | Finding | Disposition |
|---|---|---|
| 1.1 | EK baffle slot 0.80 m — max traversable capsule radius 0.40 m; second court unreachable | **Fixed structurally**: baffle piers deleted; EK/FL mouths rotated tangentially away from the hub (EK −156°, FL 115°) so no ray alignment exists to baffle against; corridors back to 3.5 m |
| 1.2 | Declared route widths were literals; measured clear width 0.90 m | **Fixed**: new test ray-marches perpendicular from every 0.25 m route sample; asserts ≥ 0.9 m per side and ≥ 2.4 m total in carved geometry |
| 1.3 | Fire lanes ran point-for-point on the walk centreline | **Fixed**: lanes are mitred 1.1 m parallel offsets of the walk |
| 2.1 | 302 m² of reachable floor >2.5 m off-route ("nowhere else to walk" only by enumeration) | **Fixed as proof**: flood-fill reachability test asserts every reachable 0.5 m cell is within 2 m of the carved network, and all three court entries are reachable |
| 2.2 | Earth gate open from first hub arrival — performers skippable | **Open, flagged for Austen** (design decision; fire cannot own collision, so a physical bar needs basalt or a state-driven mechanism) |
| 2.3/2.4 | 6 m baffle corridors read as rooms; serpentine ~110° turns | **Fixed**: piers gone, corridors 3.5 m, single doglegs |
| 2.5 | Bowl sink / rotunda height not in the contract (2D plan) | **Deferred to Blender pass** (elevations are Gate 2 authoring; wall heights 3/7.5/12 m are in the contract) |
| 3.1 | Reverse-direction sightline test vacuous | **Accepted as known** (kept; facing-cone visibility remains untested by design — 2D plan) |
| 3.2 | No geometry-vs-clearance test | **Fixed** (see 1.2) |
| 3.3 | Hub-return check uses bounding rect | **Accepted** (hubCircle now exported; tightening is cheap follow-up) |
| 3.4 | Sightline math is 2D to performer base point | **Accepted as known limitation** of the plan layer |
| 4.x | Gate centres inside hub floor; orbit lanes overran court walls; DJ threshold outside court; competing coal/growth cues post-blackout; DJ encounter 1/7 length; shell 66% dead mass; 126-anchor budget carried over | Court walls/orbits now clear by ≥0.9 m (tested); DJ entry moved inside the court; coal-state split, DJ dwell pacing, torch budget, and shell size **deferred to Gate 2** and listed in the production contract's next-pass notes |

## Net state after fixes

- 35/35 First Fire tests pass, including the two new proofs (clearance,
  reachability); full svelte-check 0 errors.
- Corridors: 3.5 m (entry 4 m, earth 3.2 m); every route sample ≥ 0.9 m from
  rock per side — a 0.5 m capsule traverses the whole procession.
- EK approach is a western wrap through the hub-ring/bowl-wall channel with a
  radial throat; FL approach curls into a south-south-west mouth. Both mouths
  face solid rock, so hub → performer rays are impossible regardless of
  corner-cutting.
