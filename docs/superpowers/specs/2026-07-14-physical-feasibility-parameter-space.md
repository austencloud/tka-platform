# Physical Feasibility — The Complete Parameter Space (Foundation)

**Date:** 2026-07-14
**Type:** Foundation / reference. Not an implementation spec. This maps the full
parameter space for the long-term goal: **a 3D avatar that can physically perform
any TKA sequence** — every arm intersection resolved the way a real performer
resolves it, not by passing arms through each other.
**Grounded in:** Flow Arts Knowledge MCP (`static-props`, `base-rotation`) +
shipped work on branch `feat/wall-plane-feasibility`.

## Why this document exists

The end goal is far off. This is the framework so it makes sense later — for
Austen's analytical map and for future AI generations picking this up cold. The
claim being recorded: **the space is finite and enumerable.** A sequence is a
finite series of movements; the ways a body realizes each movement are a finite
menu of execution strategies. Generative feasibility = for each step, pick from
that finite menu until the motion is physically real.

## Two spaces, kept separate

### A. The INPUT space — what TKA enumerates (the given)

A sequence is fully specified by TKA's finite enumeration. The avatar does not
get to change any of this; it must realize it exactly. Per hand, per step:

| Parameter | Domain |
|---|---|
| Grid location (start, end) | 9 locations: 8 perimeter + center |
| Motion type | pro, anti, dash, static, float (+ hash, + L5 skews) |
| Turns (additional rotation) | 0–3 whole; half (90°); quarter (45°, L6+). **1 turn = 180°** |
| Rotation direction | CW / CCW (only meaningful at ≥1 turn, or as pro/anti base at 0) |
| Orientation | 8 center-relative: 4 radial/nonradial + 4 interradial (L6+) |
| Start orientation (sequence-level) | one of the above, carried forward |

Base-rotation fact that shapes everything downstream: at 0 turns a **shift**
(pro/anti) is already rotating at its base rate (pro preserves center-relative
orientation, anti reverses it); dash/static at 0 turns truly do not rotate. This
is why anti paths make petals and pro paths make a single arc — it falls out of
base rotation, not a rendering choice.

**What TKA deliberately does NOT enumerate** (MCP `static-props`): grip changes,
body movement, behind-the-back passes, contact rolling, tosses, 3D planes below
Level 8. **Everything TKA omits is exactly the avatar's execution DOF below.**

### B. The EXECUTION space — how a body realizes the input (the solve)

This is the parameter space to map. Organized on the three escalating
directions. Each direction is a strictly larger cheat than the one before; the
solver tries them in order and stops at the first that makes the step real.

---

## The three directions (solve cascade)

### Direction 0 — Null (does it just work?)

Square to the audience, wall plane, natural path (arc for pro, count-driven
petals for anti), no cheat. If both hands realize the step with no arm-arm /
prop-torso intersection and within reach — done. Many steps are here.

### Direction 1 — PATH cheat (in-plane, per-hand)

Deform the hand path within the wall plane. Levers:

| Lever | Range | Notes |
|---|---|---|
| Path shape | arc / linear / concave | pro→arc, anti→concave, dash→linear (base behavior) |
| Petal count | `1 + turns` per step (4·(1+turns)/cycle) | derived, not free — set by turns |
| Concavity depth `k` | 0 → 1 (1 = traces center) | **shipped**; petal-model radius floor |
| Path radius / orbit size | how far the hand orbits from center | mostly fixed by grid, minor lever |

**Finding (shipped, `reference_concavity_needs_depth_coupling`):** path cheat
ALONE rarely clears a real conflict — pulling `k`→1 moves the staff toward the
torso, so `prop-through-torso` rises. Direction 1 is real but weak on its own;
its value is aesthetic (petal shape) plus a tiebreak once depth has done the
work. This is why the program moved to Direction 2.

### Direction 2 — DEPTH cheat (out-of-plane, per-hand)

Move a hand off the single wall-plane depth (z), so the two staffs pass in
depth rather than colliding in the plane. This is where the real cheat lives.
Levers:

| Lever | Range | Status |
|---|---|---|
| Per-hand depth offset `z` (near/far body) | reach-bounded, ± off wall plane | **specced** (depth solver) |
| Near/far pairing | opposite-sign pass, or single-hand pull | either, per pattern |
| Under-armpit pass | a special case of deep −z on one hand | design input, archived negative-space doc |
| Arm over/under layering | which arm passes above the other in depth/height | **unmapped lever** — likely needed with z |
| Shoulder negative space (above/below) | raise/lower the hand past the shoulder line | **unmapped** — MCP-canonical technique #1 |
| Elbow pole / bend direction | how the elbow resolves for a given hand target | partially handled; wall-pole depth term specced |

Canonical grounding (MCP `static-props`): the two sanctioned techniques for
keeping the thumb/pinky reference while doing hard moves are **negative space
above and below the shoulder** and **body turns**. Direction 2 is the first
half — negative space around the shoulder, realized as depth + height offsets.

### Direction 3 — BODY cheat (whole-body)

When no per-hand adjustment clears the step, move the body. Levers:

| Lever | Range | Status |
|---|---|---|
| Plane mode | wall / wheel / **dual-wheel** / floor / fusion planes | dual-wheel **shipped**; fusion planes specced (atomic-plane-system) |
| Body facing (yaw) | square → turned (e.g. stage-right so audience still reads the flowers) | dual-wheel turns 90°; facing policy shipped-adjacent |
| Body turns mid-sequence | rotate to pass the prop into the plane **behind** you | **UNSOLVED** — MCP-canonical technique #2, years-long |
| Torso twist / spine pitch / lean | bounded articulation | modeled in StanceSimulator, not yet a solver lever |
| Stance / foot offset / stepping (locomotion) | vacate a quadrant, step through | Dodge Lab built, **orphaned** from playback |
| Height / crouch | global vertical | unmapped |

Direction 3's endgame (body turns into negative space behind the body) is the
single biggest unsolved problem. Explicitly out of scope for years; named here
so the map is complete.

---

## Cross-cutting: constraints that BOUND the space (the rules)

A solve is only valid if it respects these. They are what make the space finite
and what a real performer never violates:

1. **Thumb/pinky reference preserved.** The dual-end landmark must not require a
   regrip. A solve that would force a grip change is a *different move*, not a
   cheat — TKA does not enumerate grip changes. (MCP `static-props`.) The whole
   point of negative space + body turns is to preserve the reference.
2. **Reach envelope.** Each hand target must be within arm length from the
   shoulder. `StanceSimulator.reachShortfall` measures this; it is the natural
   bound on the depth lever (no fixed comfort cap — reach is the limit).
3. **No arm-arm / prop-prop / prop-body intersection.** The feasibility test
   itself (`StanceSimulator` collision zones).
4. **Balance.** CoM over base of support (`balanceMargin`).
5. **Radial orientation to center.** Orientation is measured prop→center, not to
   the ground — so any body/plane transform must preserve the center-relative
   orientation the input specifies. (MCP `static-props`, `base-rotation`.)

---

## The finiteness argument (why this is enumerable)

- The INPUT per step is finite: (motion type ∈ ~5) × (turns ∈ small set) ×
  (location pair ∈ 9²) × (orientation ∈ 8), per hand, and TKA's own combinatorics
  bound the letter space.
- The EXECUTION menu per step is finite: Direction 0 (1 option) → Direction 1
  (path shape ∈ 3, `k` quantized) → Direction 2 (`z` quantized within reach,
  pairing ∈ finite, over/under ∈ 2, shoulder-space ∈ finite) → Direction 3
  (plane ∈ finite, facing ∈ finite, body-turn ∈ finite once solved).
- Therefore per-step feasibility is a bounded search over a finite decision tree,
  and whole-sequence feasibility is a per-step verdict. This is the generative
  claim made concrete: **pick from a finite menu until the motion is real, else
  escalate to the next direction.**

The current solver stack already instantiates the first two-and-a-half
directions of this tree offline. The unmapped levers (over/under layering,
shoulder height negative space, body turns, locomotion integration) are the named
frontier.

---

## Status map (2026-07-14)

| Lever | Direction | Status |
|---|---|---|
| Petal path model (count = 1+turns), concavity `k` | 1 | **Shipped** (petal-path.ts) |
| Feasibility scan (swept-tube + 3D StanceSimulator) | test | **Shipped** |
| Concavity-only solver | 1 | **Shipped** (weak alone — see finding) |
| Per-hand depth `z` solver, reach-bounded | 2 | **Specced** for Fable (depth-solver design + plan) |
| Wall-plane elbow-pole depth term | 2 | **Specced** |
| Dual-wheel plane fallback + facing | 3 | **Shipped** |
| Fusion planes (shield/ramp/wing) | 3 | Specced (atomic-plane-system), unbuilt |
| Arm over/under layering | 2 | **Unmapped lever** |
| Shoulder-height negative space (above/below) | 2 | **Unmapped** (MCP technique #1) |
| Body turns into plane behind | 3 | **Unsolved** (MCP technique #2, years-long) |
| Locomotion / stepping integration | 3 | Dodge Lab built but **orphaned** from playback |
| Grip-change detection (invalid-move flag) | rule | **Unbuilt** — would flag when no cheat preserves the reference |

## Ground truth (the missing input)

Every depth/height magnitude ("how far down the hand reaches to cheat") is set by
body proportions and the specific move — not derivable a priori, needs real
reference. The sanctioned pipeline: Austen-labeled fixtures + video frame
analysis (I can read discrete frames and extract staff/hand/body geometry and
near/far assignment per frame; no audio ASR in-tool). Labels: `possible /
impossible / cheatable`. This calibrates the Direction-2 magnitudes and validates
the solver. It is the substitute for mocap until mocap exists.

## Related

- Spec/plan: `2026-07-13-wall-plane-feasibility-design.md`,
  `2026-07-13-wall-plane-depth-solver-design.md` (+ plans)
- Memory: `project_wall_plane_feasibility`, `reference_concavity_needs_depth_coupling`
- Archived design input: `negative-space-behind-body-prototype.md`
- MCP topics grounding this: `static-props`, `base-rotation`
