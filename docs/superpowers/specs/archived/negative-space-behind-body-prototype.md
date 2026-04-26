# Negative Space Behind-Body Prototype

**Date:** 2026-04-05
**Status:** Accidental discovery during dual wheel plane mode development
**Priority:** Future exploration

## What Was Built

During dual wheel mode development, an intermediate state was created where:
- Avatar faces forward (toward audience)
- Props spin on the wall plane (XY) but are offset laterally to each side of the body
- The props trace circles BEHIND the body, in negative space
- From the front, you see the spinning flowers; from behind, the avatar can't see them

This accidentally represents **behind-the-back negative space** — a real flow arts technique where the performer spins props in the space behind their torso, head, or above their shoulders.

## Why This Matters

If we can map body points (shoulders, head, hips) and define negative space zones relative to them, we'd be the first to formally notate behind-body prop movement. This extends TKA into territory no notation system has covered.

## Key Negative Space Zones

| Zone | Description | Body Reference |
|------|-------------|----------------|
| Behind back | Props cross behind the torso | Spine/shoulder line |
| Behind head | Props pass above/behind the head | Neck/head |
| Above shoulder | Props trace arcs above one shoulder | Shoulder joint |
| Under arm | Props pass under the armpit | Armpit reference |

## What's Needed to Formalize

1. **Body reference points in the 3D model** — shoulder joints, head position, spine line
2. **Negative space zone definitions** — regions behind/above/below body reference points
3. **Data model additions** — how to encode "this beat happens in negative space zone X" in sequence data
4. **IK adjustments** — the avatar needs to reach around/behind body parts, requiring different elbow pole logic and possibly wrist rotation
5. **Collision avoidance** — props need to path around body geometry, not through it

## Technical State (Preserved in Git)

The intermediate code that produced this effect is in the commit history around 2026-04-05. The key parameters were:
- `rotationPlane: Plane.WALL` (props spin on wall plane despite position being on wheel)
- `lateralOffset` applied to X axis in avatar-local space
- `facingAngle: 0` (avatar faces audience, not profile)
- Grid offset at solar plexus (0)

## Next Steps

- Create a feedback item to track this as a future feature
- Gather reference videos of behind-back and above-shoulder spinning
- Design the data model extension for negative space zones
- Prototype with manual bone posing (Path B from the spine twist discussion)
