# Turn-In-Place Phase 2: Clip Library & Public Interface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable authored turn-in-place animations so sequence viewer performers and museum NPCs step through heading changes instead of snapping, and stand with foot-planted idle rather than static bind pose.

**Architecture:** `ClipBasedTurnAnimator` pre-bakes Mixamo turn clips into per-frame bone rotation arrays and samples them by phase (0→1). A thin scheduling `$derived` in `PerformerRig` detects per-beat heading changes and produces `TurnRequest` objects. `Avatar3D` overlays turn clip bone rotations onto the idle pose, feeds contact curves to `FootPlanter`, and emits yaw through the existing root motion pipeline. Sequence viewer performers get `enableLocomotion + enableRootMotion + enableFootPlanting` turned on so they have idle breathing animation and planted feet.

**Tech Stack:** Three.js AnimationClip parsing, Svelte 5 runes, Threlte, Blender Python API (asset conversion)

**Depends on:** Phase 1 Foundation (complete) — `HingeConstrainedLegIKSolver`, `ContactCurveCache`, `RootMotionExtractor` with yaw, `FootPlanter` with hinge-constrained IK, `PerformerRig` `animationDrivenYaw` accumulator.

**Available turn clips (Mixamo, downloaded):**

| File (in `F:\Downloads\`) | Use | Angle | Duration |
|---|---|---|---|
| `Turn 90 Left.fbx` | 90° left | +90° | 1.0s |
| `Turn 90 Right.fbx` | 90° right | −90° | 1.0s |
| `Quick 180 Turn (2).fbx` | 180° left | +180° | 1.27s |
| `Quick 180 Turn.fbx` | 180° right | −180° | 1.27s |

45° and 135° clips (Move.ai phone mocap) are deferred — the system falls back to linear Hips-Y interpolation for those angles.

---

## File Structure

**Create:**
- `static/animations/turns/convert-turns.py` — Blender FBX→GLB batch script
- `static/animations/turns/bake-contact-curves.py` — Blender contact curve extraction → JSON
- `src/lib/shared/3d/services/contracts/ITurnAnimator.ts` — interface + types
- `src/lib/shared/3d/services/implementations/ClipBasedTurnAnimator.ts` — clip loading, pre-baking, phase sampling
- `tests/unit/3d-animation/ClipBasedTurnAnimator.test.ts` — unit tests

**Modify:**
- `src/lib/shared/3d/components/Avatar3D.svelte` — turn overlay in animation loop, footplanter clip/phase pass-through
- `src/lib/shared/3d/components/PerformerRig.svelte` — turn scheduling via `$derived`, new pass-through props
- `src/lib/shared/3d/components/Viewer3DScene.svelte` — enable locomotion + root motion + foot planting for performers
- `src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte` — enable same flags

---

## Task 1: Convert Turn FBX Files to GLB

**Files:**
- Create: `static/animations/turns/convert-turns.py`

This task produces the Blender script and instructions for the user to run it. The output GLB files are required by Tasks 4+ but the TypeScript tasks can proceed with the existing `locomotion-pack/turn-left.glb` and `turn-right.glb` as temporary stand-ins.

- [ ] **Step 1: Create the turns directory and copy FBX files**

The user copies and renames the 4 winner FBX files:

```bash
mkdir -p static/animations/turns
cp "F:/Downloads/Turn 90 Left.fbx" static/animations/turns/turn-left-90.fbx
cp "F:/Downloads/Turn 90 Right.fbx" static/animations/turns/turn-right-90.fbx
cp "F:/Downloads/Quick 180 Turn (2).fbx" static/animations/turns/turn-left-180.fbx
cp "F:/Downloads/Quick 180 Turn.fbx" static/animations/turns/turn-right-180.fbx
```

- [ ] **Step 2: Write the Blender conversion script**

```python
"""Convert turn FBX files to GLB using Blender's Python API.
Run with: blender --background --python convert-turns.py
"""
import bpy
import os

script_dir = os.path.dirname(os.path.abspath(__file__))

conversions = {
    "turn-left-90.fbx": "turn-left-90.glb",
    "turn-right-90.fbx": "turn-right-90.glb",
    "turn-left-180.fbx": "turn-left-180.glb",
    "turn-right-180.fbx": "turn-right-180.glb",
}

for fbx_name, glb_name in conversions.items():
    fbx_path = os.path.join(script_dir, fbx_name)
    glb_path = os.path.join(script_dir, glb_name)

    if not os.path.exists(fbx_path):
        print(f"SKIP (not found): {fbx_name}")
        continue

    print(f"Converting: {fbx_name} -> {glb_name}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
    )

    print(f"  Done: {glb_name}")

print("All turn conversions complete!")
```

- [ ] **Step 3: User runs the script**

```bash
blender --background --python static/animations/turns/convert-turns.py
```

Expected output: 4 GLB files in `static/animations/turns/`.

- [ ] **Step 4: Verify output files exist**

```bash
ls -la static/animations/turns/*.glb
```

Expected: `turn-left-90.glb`, `turn-right-90.glb`, `turn-left-180.glb`, `turn-right-180.glb`

- [ ] **Step 5: Commit**

```bash
git add static/animations/turns/convert-turns.py
git add static/animations/turns/*.glb
git commit -m "feat(3d): add turn clip GLB files converted from Mixamo FBX"
```

Note: Do NOT commit the FBX source files (large binaries). Only the GLB outputs and the conversion script.

---

## Task 2: Bake Contact Curves from Turn Clips

**Files:**
- Create: `static/animations/turns/bake-contact-curves.py`

This Blender script loads each turn FBX, analyzes foot bone height + velocity per frame, and outputs JSON sidecar files matching the `ContactCurveData` format from `IContactCurveCache.ts`.

- [ ] **Step 1: Write the contact curve bake script**

```python
"""Bake foot contact curves from turn FBX files.
Run with: blender --background --python bake-contact-curves.py

For each FBX, outputs a JSON sidecar with per-frame contact state
for left and right feet. Contact = 1 when foot is planted (low height
AND low velocity), 0 when airborne. Values between 0-1 are blend ramps.

Output format matches ContactCurveData from IContactCurveCache.ts.
"""
import bpy
import json
import math
import os

script_dir = os.path.dirname(os.path.abspath(__file__))

# Map FBX source -> clip name (matches the GLB clip names)
clips = {
    "turn-left-90.fbx": "turn-left-90",
    "turn-right-90.fbx": "turn-right-90",
    "turn-left-180.fbx": "turn-left-180",
    "turn-right-180.fbx": "turn-right-180",
}

# Thresholds (tuned for Mixamo humanoid at default scale)
HEIGHT_THRESHOLD = 5.0    # cm — foot bone below this = potentially planted
VELOCITY_THRESHOLD = 8.0  # cm/frame — foot moving slower than this = planted
BLEND_FRAMES = 2          # frames to ramp contact weight in/out

# Mixamo bone names to search for
LEFT_FOOT_NAMES = ["mixamorig:LeftToeBase", "mixamorig1LeftToeBase", "LeftToeBase"]
RIGHT_FOOT_NAMES = ["mixamorig:RightToeBase", "mixamorig1RightToeBase", "RightToeBase"]


def find_bone(armature, name_candidates):
    """Find a bone by trying multiple naming conventions."""
    for name in name_candidates:
        bone = armature.pose.bones.get(name)
        if bone:
            return bone
    return None


def get_bone_world_pos(armature, bone, frame):
    """Get world-space position of a pose bone at a given frame."""
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    return (armature.matrix_world @ bone.matrix).to_translation()


def bake_contact_curve(fbx_path, clip_name):
    """Load FBX, sample foot positions per frame, derive contact states."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    # Find the armature
    armature = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if not armature:
        print(f"  ERROR: No armature found in {fbx_path}")
        return None

    left_toe = find_bone(armature, LEFT_FOOT_NAMES)
    right_toe = find_bone(armature, RIGHT_FOOT_NAMES)

    if not left_toe or not right_toe:
        print(f"  ERROR: Could not find foot bones in {fbx_path}")
        print(f"  Available bones: {[b.name for b in armature.pose.bones]}")
        return None

    # Get animation frame range
    action = armature.animation_data.action if armature.animation_data else None
    if not action:
        print(f"  ERROR: No animation action in {fbx_path}")
        return None

    frame_start = int(action.frame_range[0])
    frame_end = int(action.frame_range[1])
    frame_count = frame_end - frame_start + 1
    fps = bpy.context.scene.render.fps

    print(f"  Frames: {frame_start}-{frame_end} ({frame_count} frames at {fps}fps)")

    # Sample foot positions per frame
    left_positions = []
    right_positions = []

    for frame in range(frame_start, frame_end + 1):
        left_pos = get_bone_world_pos(armature, left_toe, frame)
        right_pos = get_bone_world_pos(armature, right_toe, frame)
        left_positions.append(left_pos)
        right_positions.append(right_pos)

    # Compute per-frame: height (Y in Blender = up) and velocity
    def compute_raw_contact(positions):
        """Returns per-frame raw contact state: 1 = planted, 0 = airborne."""
        raw = []
        for i, pos in enumerate(positions):
            height = pos.y  # Blender Y = up
            if i == 0:
                velocity = 0
            else:
                prev = positions[i - 1]
                dx = pos.x - prev.x
                dy = pos.y - prev.y
                dz = pos.z - prev.z
                velocity = math.sqrt(dx*dx + dy*dy + dz*dz)

            is_low = height < HEIGHT_THRESHOLD
            is_slow = velocity < VELOCITY_THRESHOLD
            raw.append(1.0 if (is_low and is_slow) else 0.0)
        return raw

    left_raw = compute_raw_contact(left_positions)
    right_raw = compute_raw_contact(right_positions)

    # Apply blend ramps (smooth transitions between planted/airborne)
    def apply_blend_ramps(raw):
        """Smooth 0→1 and 1→0 transitions over BLEND_FRAMES."""
        result = list(raw)
        n = len(result)
        for i in range(1, n):
            if raw[i] != raw[i - 1]:
                # Transition detected — apply ramp
                for j in range(BLEND_FRAMES):
                    idx = i + j
                    if idx >= n:
                        break
                    t = (j + 1) / (BLEND_FRAMES + 1)
                    if raw[i] > raw[i - 1]:
                        # 0→1 transition (foot landing)
                        result[idx] = t
                    else:
                        # 1→0 transition (foot lifting)
                        result[idx] = 1.0 - t
        return result

    left_contact = apply_blend_ramps(left_raw)
    right_contact = apply_blend_ramps(right_raw)

    return {
        "clipName": clip_name,
        "frameRate": fps,
        "frameCount": frame_count,
        "leftFoot": [round(v, 3) for v in left_contact],
        "rightFoot": [round(v, 3) for v in right_contact],
    }


# Process each clip
for fbx_name, clip_name in clips.items():
    fbx_path = os.path.join(script_dir, fbx_name)
    json_path = os.path.join(script_dir, f"{clip_name}.contact.json")

    if not os.path.exists(fbx_path):
        print(f"SKIP (not found): {fbx_name}")
        continue

    print(f"Baking contact curves: {fbx_name}")
    data = bake_contact_curve(fbx_path, clip_name)

    if data:
        with open(json_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"  Written: {json_path}")
        print(f"  Left foot planted frames: {sum(1 for v in data['leftFoot'] if v > 0.5)}/{data['frameCount']}")
        print(f"  Right foot planted frames: {sum(1 for v in data['rightFoot'] if v > 0.5)}/{data['frameCount']}")

print("\nAll contact curves baked!")
```

- [ ] **Step 2: User runs the script**

```bash
blender --background --python static/animations/turns/bake-contact-curves.py
```

Expected: 4 JSON files: `turn-left-90.contact.json`, `turn-right-90.contact.json`, `turn-left-180.contact.json`, `turn-right-180.contact.json`.

- [ ] **Step 3: Verify JSON structure**

Spot-check one file. It should match `ContactCurveData`:

```bash
cat static/animations/turns/turn-left-90.contact.json | head -10
```

Expected shape:
```json
{
  "clipName": "turn-left-90",
  "frameRate": 30,
  "frameCount": 31,
  "leftFoot": [1.0, 1.0, ...],
  "rightFoot": [0.0, 0.0, ...]
}
```

Verify: `leftFoot.length === frameCount` and `rightFoot.length === frameCount`.

- [ ] **Step 4: Commit**

```bash
git add static/animations/turns/bake-contact-curves.py
git add static/animations/turns/*.contact.json
git commit -m "feat(3d): add contact curve sidecars for turn clips"
```

---

## Task 3: ITurnAnimator Interface

**Files:**
- Create: `src/lib/shared/3d/services/contracts/ITurnAnimator.ts`

- [ ] **Step 1: Write the interface**

```typescript
/**
 * ITurnAnimator
 *
 * Sample-based turn animation interface. Given a heading change and a
 * phase (0→1), returns the bone rotations and contact state for that
 * instant. Stateless: same input always produces the same output.
 *
 * Consumers own the phase clock (beat duration, wall-clock time, or
 * scrub position). This interface has no concept of "time" or "playback".
 *
 * The implementation can be swapped without touching consumers:
 * - ClipBasedTurnAnimator (Phase 2 — Mixamo + mocap clips)
 * - NeuralTurnAnimator (future — motion diffusion models)
 * - MotionMatchingTurnAnimator (future — database search)
 */

import type { Quaternion, Vector3 } from "three";

/**
 * Input to a turn sample. The consumer computes this from its own clock.
 */
export interface TurnRequest {
  /** Heading at phase 0, in radians (0 = +Z toward audience). */
  fromHeading: number;
  /** Heading at phase 1, in radians. */
  toHeading: number;
  /** Phase 0→1 within the turn. 0 = start pose, 1 = end pose.
   *  Can go backward (scrubbing). Values outside [0,1] are clamped. */
  phase: number;
}

/**
 * Output of a turn sample — everything Avatar3D needs to pose the skeleton.
 */
export interface TurnSample {
  /** Accumulated yaw delta from phase=0 to this phase, in radians.
   *  Positive = counterclockwise (left turn) when viewed from above. */
  yawDelta: number;
  /** Per-bone local rotations to apply to the skeleton.
   *  Keys are canonical bone names without prefix (e.g. "Hips", "LeftUpLeg").
   *  Only lower-body + spine bones are included. */
  boneRotations: Map<string, Quaternion>;
  /** Hips local position at this phase (for root motion extraction).
   *  Null when using linear fallback (no clip data). */
  hipsPosition: Vector3 | null;
  /** Per-foot contact state: 0 = airborne, 1 = fully planted. */
  leftFootContact: number;
  rightFootContact: number;
  /** Name of the clip being sampled (for ContactCurveCache lookup).
   *  Empty string when using linear fallback. */
  clipName: string;
}

export interface ITurnAnimator {
  /**
   * Sample the turn pose at a given phase. Pure function: same input
   * always returns same output. Consumers own the phase clock.
   */
  sample(request: TurnRequest): TurnSample;

  /**
   * Compute the shortest-path heading change in radians, normalized
   * to [-π, π]. Consumers use this to check if a turn is large enough
   * to schedule (e.g. skip changes below some epsilon).
   */
  computeShortestAngle(fromHeading: number, toHeading: number): number;

  /** Whether all turn clips are loaded and baked. */
  isReady(): boolean;

  /** Dispose loaded clip data. */
  dispose(): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/services/contracts/ITurnAnimator.ts
git commit -m "feat(3d): add ITurnAnimator sample-based interface"
```

---

## Task 4: ClipBasedTurnAnimator — Tests First

**Files:**
- Create: `tests/unit/3d-animation/ClipBasedTurnAnimator.test.ts`

These tests use synthetic clip data (no GLB loading). The implementation in Task 5 will expose an `initializeFromData()` method that accepts pre-built clip arrays for testing.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { Quaternion, Vector3, Euler } from "three";
import { ClipBasedTurnAnimator } from "$lib/shared/3d/services/implementations/ClipBasedTurnAnimator";
import type { BakedTurnClip } from "$lib/shared/3d/services/implementations/ClipBasedTurnAnimator";

/**
 * Build a synthetic turn clip with linear yaw rotation over N frames.
 * The Hips bone rotates from 0 to `angleDeg` degrees around Y.
 * All other bones hold identity rotation.
 */
function buildSyntheticClip(
  clipName: string,
  angleDeg: number,
  frameCount: number
): BakedTurnClip {
  const angleRad = (angleDeg * Math.PI) / 180;
  const boneFrames = new Map<string, Quaternion[]>();

  // Hips: linear yaw from 0 to angleRad
  const hipsFrames: Quaternion[] = [];
  const hipsPositions: Vector3[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    const yaw = angleRad * t;
    // Mixamo GLB: rotation.z = yaw
    const q = new Quaternion().setFromEuler(new Euler(0, 0, yaw));
    hipsFrames.push(q);
    hipsPositions.push(new Vector3(0, 0, 0));
  }
  boneFrames.set("Hips", hipsFrames);

  // Leg bones: identity (standing in place)
  const legBones = [
    "LeftUpLeg", "LeftLeg", "LeftFoot",
    "RightUpLeg", "RightLeg", "RightFoot",
  ];
  for (const name of legBones) {
    const frames: Quaternion[] = [];
    for (let i = 0; i < frameCount; i++) {
      frames.push(new Quaternion()); // identity
    }
    boneFrames.set(name, frames);
  }

  // Simple contact: left foot planted first half, right foot planted second half
  const leftContact: number[] = [];
  const rightContact: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    leftContact.push(t < 0.5 ? 1 : 0);
    rightContact.push(t >= 0.5 ? 1 : 0);
  }

  return {
    angleDeg,
    clipName,
    duration: 1.0,
    frameCount,
    boneFrames,
    hipsPositions,
    contactLeft: leftContact,
    contactRight: rightContact,
  };
}

describe("ClipBasedTurnAnimator", () => {
  let animator: ClipBasedTurnAnimator;

  beforeEach(() => {
    animator = new ClipBasedTurnAnimator();
    animator.initializeFromData([
      buildSyntheticClip("turn-left-90", 90, 31),
      buildSyntheticClip("turn-right-90", -90, 31),
      buildSyntheticClip("turn-left-180", 180, 39),
      buildSyntheticClip("turn-right-180", -180, 39),
    ]);
  });

  describe("computeShortestAngle", () => {
    it("returns positive for counterclockwise (left) turn", () => {
      // 0 → π/2 = +90° left
      const angle = animator.computeShortestAngle(0, Math.PI / 2);
      expect(angle).toBeCloseTo(Math.PI / 2, 5);
    });

    it("returns negative for clockwise (right) turn", () => {
      // 0 → -π/2 = -90° right
      const angle = animator.computeShortestAngle(0, -Math.PI / 2);
      expect(angle).toBeCloseTo(-Math.PI / 2, 5);
    });

    it("normalizes to shortest path across ±π boundary", () => {
      // 170° → -170° should be +20° (short way), not -340° (long way)
      const from = (170 * Math.PI) / 180;
      const to = (-170 * Math.PI) / 180;
      const angle = animator.computeShortestAngle(from, to);
      expect(Math.abs(angle)).toBeLessThan(Math.PI);
      expect(angle).toBeCloseTo((20 * Math.PI) / 180, 3);
    });

    it("returns zero for identical headings", () => {
      const angle = animator.computeShortestAngle(1.5, 1.5);
      expect(angle).toBeCloseTo(0, 5);
    });
  });

  describe("sample — clip selection", () => {
    it("selects 90° left clip for +π/2 heading change", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 0.5,
      });
      expect(sample.clipName).toBe("turn-left-90");
    });

    it("selects 90° right clip for -π/2 heading change", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: -Math.PI / 2,
        phase: 0.5,
      });
      expect(sample.clipName).toBe("turn-right-90");
    });

    it("selects 180° left clip for +π heading change", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI,
        phase: 0.5,
      });
      expect(sample.clipName).toBe("turn-left-180");
    });

    it("selects 180° right clip for -π heading change", () => {
      const sample = animator.sample({
        fromHeading: Math.PI / 2,
        toHeading: -Math.PI / 2,
        phase: 0.5,
      });
      expect(sample.clipName).toBe("turn-right-180");
    });
  });

  describe("sample — phase interpolation", () => {
    it("returns zero yawDelta at phase 0", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 0,
      });
      expect(sample.yawDelta).toBeCloseTo(0, 3);
    });

    it("returns full angle as yawDelta at phase 1", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 1,
      });
      // Synthetic clip has linear yaw, so yawDelta at phase 1 = 90° in radians
      expect(sample.yawDelta).toBeCloseTo(Math.PI / 2, 2);
    });

    it("returns proportional yawDelta at phase 0.5", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 0.5,
      });
      expect(sample.yawDelta).toBeCloseTo(Math.PI / 4, 2);
    });

    it("clamps phase below 0 to 0", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: -0.5,
      });
      expect(sample.yawDelta).toBeCloseTo(0, 3);
    });

    it("clamps phase above 1 to 1", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 1.5,
      });
      expect(sample.yawDelta).toBeCloseTo(Math.PI / 2, 2);
    });
  });

  describe("sample — bone rotations", () => {
    it("includes Hips rotation at sampled phase", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 0.5,
      });
      const hipsQuat = sample.boneRotations.get("Hips");
      expect(hipsQuat).toBeDefined();
      // Extract Z euler (yaw in Mixamo GLB) from the quaternion
      const euler = new Euler().setFromQuaternion(hipsQuat!);
      expect(euler.z).toBeCloseTo(Math.PI / 4, 2);
    });

    it("includes leg bones in the rotation map", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 0.5,
      });
      expect(sample.boneRotations.has("LeftUpLeg")).toBe(true);
      expect(sample.boneRotations.has("RightLeg")).toBe(true);
      expect(sample.boneRotations.has("LeftFoot")).toBe(true);
    });
  });

  describe("sample — contact curves", () => {
    it("returns left foot planted at phase 0.25 (first half)", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 0.25,
      });
      expect(sample.leftFootContact).toBeCloseTo(1, 1);
      expect(sample.rightFootContact).toBeCloseTo(0, 1);
    });

    it("returns right foot planted at phase 0.75 (second half)", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 2,
        phase: 0.75,
      });
      expect(sample.leftFootContact).toBeCloseTo(0, 1);
      expect(sample.rightFootContact).toBeCloseTo(1, 1);
    });
  });

  describe("sample — linear fallback for missing angles", () => {
    it("falls back to linear yaw for 45° turn (no clip)", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: Math.PI / 4, // 45° — no clip loaded
        phase: 0.5,
      });
      // Linear fallback: yawDelta = shortestAngle * phase
      expect(sample.yawDelta).toBeCloseTo(Math.PI / 8, 2);
      expect(sample.clipName).toBe(""); // no clip
      expect(sample.boneRotations.size).toBe(0); // no bone overrides
    });

    it("falls back to linear yaw for 135° turn (no clip)", () => {
      const sample = animator.sample({
        fromHeading: 0,
        toHeading: (135 * Math.PI) / 180,
        phase: 1,
      });
      expect(sample.yawDelta).toBeCloseTo((135 * Math.PI) / 180, 2);
      expect(sample.clipName).toBe("");
    });
  });

  describe("isReady", () => {
    it("returns true after initializeFromData", () => {
      expect(animator.isReady()).toBe(true);
    });

    it("returns false before initialization", () => {
      const fresh = new ClipBasedTurnAnimator();
      expect(fresh.isReady()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d-animation/ClipBasedTurnAnimator.test.ts`
Expected: FAIL — `ClipBasedTurnAnimator` does not exist yet.

- [ ] **Step 3: Commit test file**

```bash
git add tests/unit/3d-animation/ClipBasedTurnAnimator.test.ts
git commit -m "test(3d): add ClipBasedTurnAnimator tests (red phase)"
```

---

## Task 5: ClipBasedTurnAnimator — Implementation

**Files:**
- Create: `src/lib/shared/3d/services/implementations/ClipBasedTurnAnimator.ts`

- [ ] **Step 1: Write the implementation**

```typescript
/**
 * ClipBasedTurnAnimator
 *
 * Loads Mixamo turn clips, pre-bakes them into per-frame bone rotation
 * arrays, and samples by phase (0→1). Stateless sampling: same input
 * always produces the same output.
 *
 * Clip selection: snaps the requested heading change to the nearest
 * supported angle (±90°, ±180°). Unsupported angles (±45°, ±135°)
 * fall back to linear Hips yaw interpolation with no leg motion.
 *
 * Pre-baking eliminates AnimationMixer stateful sampling and makes
 * scrubbing/seeking free — just index into the frame array.
 */

import { Quaternion, Vector3, Euler } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AnimationClip, Object3D } from "three";
import type {
  ITurnAnimator,
  TurnRequest,
  TurnSample,
} from "../contracts/ITurnAnimator";
import type { ContactCurveData } from "../contracts/IContactCurveCache";

/** Known Mixamo bone prefixes (same list as LocomotionAnimator). */
const KNOWN_PREFIXES = ["mixamorig1", "mixamorig:", "mixamorig", ""];

/** Bones included in turn clip overlay. Upper body is driven by arm IK. */
const TURN_BONE_NAMES = new Set([
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
]);

/** Pre-baked turn clip data. Exported for test construction. */
export interface BakedTurnClip {
  /** Angle in degrees. Positive = left (CCW), negative = right (CW). */
  angleDeg: number;
  /** Clip name for contact curve cache lookup. */
  clipName: string;
  /** Original clip duration in seconds. */
  duration: number;
  /** Number of frames in the baked arrays. */
  frameCount: number;
  /** Per-bone per-frame rotations. Key = canonical bone name (no prefix). */
  boneFrames: Map<string, Quaternion[]>;
  /** Per-frame Hips local position (for root motion). */
  hipsPositions: Vector3[];
  /** Per-frame left foot contact (0 = airborne, 1 = planted). */
  contactLeft: number[];
  /** Per-frame right foot contact. */
  contactRight: number[];
}

/** Manifest entry for loading a turn clip from URLs. */
export interface TurnClipManifestEntry {
  /** Angle in degrees this clip represents. */
  angleDeg: number;
  /** URL to the GLB file. */
  glbUrl: string;
  /** URL to the contact curve JSON sidecar. */
  contactUrl: string;
  /** Clip name for cache key. */
  clipName: string;
}

/** The supported clip angles. Others fall back to linear. */
const SUPPORTED_ANGLES = [90, -90, 180, -180];

/** Snap threshold: angles within this many degrees of a supported angle use that clip. */
const SNAP_THRESHOLD_DEG = 22.5;

// ── Reusable temporaries for sampling (zero allocation per frame) ──

const _tempQ1 = new Quaternion();
const _tempQ2 = new Quaternion();
const _tempV1 = new Vector3();
const _tempV2 = new Vector3();
const _tempEuler = new Euler();

// ── Empty fallback sample ──

const EMPTY_BONE_MAP = new Map<string, Quaternion>();

export class ClipBasedTurnAnimator implements ITurnAnimator {
  /** Clips keyed by angle in degrees. */
  private clips = new Map<number, BakedTurnClip>();
  private ready = false;

  // ────────────────────────────────────────────
  // Initialization — test path (synchronous)
  // ────────────────────────────────────────────

  /**
   * Initialize from pre-built clip data. Used by tests.
   */
  initializeFromData(clips: BakedTurnClip[]): void {
    this.clips.clear();
    for (const clip of clips) {
      this.clips.set(clip.angleDeg, clip);
    }
    this.ready = true;
  }

  // ────────────────────────────────────────────
  // Initialization — production path (async)
  // ────────────────────────────────────────────

  /**
   * Load turn clips from GLB URLs and contact curve JSON sidecars.
   * Bakes each clip into per-frame bone rotation arrays.
   * @param modelRoot The loaded avatar model root (for bone prefix detection).
   * @param manifest Array of clip entries to load.
   */
  async initialize(
    modelRoot: Object3D,
    manifest: TurnClipManifestEntry[]
  ): Promise<void> {
    const modelPrefix = this.detectModelPrefix(modelRoot);
    const loader = new GLTFLoader();

    const loadPromises = manifest.map(async (entry) => {
      try {
        const [gltf, contactData] = await Promise.all([
          this.loadGltf(loader, entry.glbUrl),
          this.loadContactJson(entry.contactUrl),
        ]);

        const clip = gltf.animations[0];
        if (!clip) {
          console.warn(`[ClipBasedTurnAnimator] No animation in ${entry.glbUrl}`);
          return;
        }

        const baked = this.bakeClip(clip, entry, modelPrefix, contactData);
        this.clips.set(entry.angleDeg, baked);
      } catch (err) {
        console.warn(
          `[ClipBasedTurnAnimator] Failed to load ${entry.clipName}:`,
          err
        );
      }
    });

    await Promise.all(loadPromises);
    this.ready = true;
  }

  /**
   * Get all contact curve data for registration with ContactCurveCache.
   */
  getContactCurves(): ContactCurveData[] {
    const curves: ContactCurveData[] = [];
    for (const clip of this.clips.values()) {
      curves.push({
        clipName: clip.clipName,
        frameRate: Math.round(clip.frameCount / clip.duration),
        frameCount: clip.frameCount,
        leftFoot: clip.contactLeft,
        rightFoot: clip.contactRight,
      });
    }
    return curves;
  }

  // ────────────────────────────────────────────
  // ITurnAnimator interface
  // ────────────────────────────────────────────

  sample(request: TurnRequest): TurnSample {
    const angleDeg = this.shortestAngleDeg(request.fromHeading, request.toHeading);
    const clip = this.selectClip(angleDeg);

    if (!clip) {
      return this.linearFallback(request);
    }

    return this.sampleClip(clip, request.phase);
  }

  computeShortestAngle(fromHeading: number, toHeading: number): number {
    let delta = toHeading - fromHeading;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return delta;
  }

  isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.clips.clear();
    this.ready = false;
  }

  // ────────────────────────────────────────────
  // Private — clip selection
  // ────────────────────────────────────────────

  private shortestAngleDeg(fromHeading: number, toHeading: number): number {
    return (this.computeShortestAngle(fromHeading, toHeading) * 180) / Math.PI;
  }

  /**
   * Select the clip whose angle is closest to the requested angle.
   * Returns null if no clip is within SNAP_THRESHOLD_DEG.
   */
  private selectClip(angleDeg: number): BakedTurnClip | null {
    let bestClip: BakedTurnClip | null = null;
    let bestDist = Infinity;

    for (const supported of SUPPORTED_ANGLES) {
      const dist = Math.abs(angleDeg - supported);
      if (dist < bestDist && dist <= SNAP_THRESHOLD_DEG) {
        bestDist = dist;
        bestClip = this.clips.get(supported) ?? null;
      }
    }

    return bestClip;
  }

  // ────────────────────────────────────────────
  // Private — sampling
  // ────────────────────────────────────────────

  private sampleClip(clip: BakedTurnClip, phase: number): TurnSample {
    const clampedPhase = Math.max(0, Math.min(1, phase));
    const floatIndex = clampedPhase * (clip.frameCount - 1);
    const i0 = Math.floor(floatIndex);
    const i1 = Math.min(clip.frameCount - 1, i0 + 1);
    const t = floatIndex - i0;

    // Interpolate bone rotations
    const boneRotations = new Map<string, Quaternion>();
    for (const [boneName, frames] of clip.boneFrames) {
      const q0 = frames[i0]!;
      const q1 = frames[i1]!;
      const result = _tempQ1.copy(q0).slerp(q1, t);
      boneRotations.set(boneName, result.clone());
    }

    // Interpolate Hips position
    let hipsPosition: Vector3 | null = null;
    if (clip.hipsPositions.length > 0) {
      const p0 = clip.hipsPositions[i0]!;
      const p1 = clip.hipsPositions[i1]!;
      hipsPosition = _tempV1.copy(p0).lerp(p1, t).clone();
    }

    // Compute yawDelta: difference between Hips yaw at this phase and at phase 0
    const hipsAtPhase = boneRotations.get("Hips");
    const hipsAtZero = clip.boneFrames.get("Hips")?.[0];
    let yawDelta = 0;
    if (hipsAtPhase && hipsAtZero) {
      // Extract Z euler (Mixamo GLB yaw axis) from both
      _tempEuler.setFromQuaternion(hipsAtPhase);
      const yawAtPhase = _tempEuler.z;
      _tempEuler.setFromQuaternion(hipsAtZero);
      const yawAtZero = _tempEuler.z;
      yawDelta = yawAtPhase - yawAtZero;
    }

    // Interpolate contact curves
    const leftFootContact = this.lerpContact(clip.contactLeft, i0, i1, t);
    const rightFootContact = this.lerpContact(clip.contactRight, i0, i1, t);

    return {
      yawDelta,
      boneRotations,
      hipsPosition,
      leftFootContact,
      rightFootContact,
      clipName: clip.clipName,
    };
  }

  /**
   * Linear fallback for unsupported angles: Hips yaw only, no leg motion.
   * The visual result is the same as the current system (feet slide) but
   * the interface is satisfied so consumers don't need special-casing.
   */
  private linearFallback(request: TurnRequest): TurnSample {
    const clampedPhase = Math.max(0, Math.min(1, request.phase));
    const totalAngle = this.computeShortestAngle(
      request.fromHeading,
      request.toHeading
    );

    return {
      yawDelta: totalAngle * clampedPhase,
      boneRotations: EMPTY_BONE_MAP,
      hipsPosition: null,
      leftFootContact: 1, // Assume both feet planted (no clip data)
      rightFootContact: 1,
      clipName: "",
    };
  }

  private lerpContact(
    arr: number[],
    i0: number,
    i1: number,
    t: number
  ): number {
    const v0 = arr[i0] ?? 0;
    const v1 = arr[i1] ?? 0;
    return v0 * (1 - t) + v1 * t;
  }

  // ────────────────────────────────────────────
  // Private — loading and baking (production path)
  // ────────────────────────────────────────────

  private detectModelPrefix(root: Object3D): string {
    for (const prefix of KNOWN_PREFIXES) {
      if (root.getObjectByName(`${prefix}Hips`)) return prefix;
    }
    return "mixamorig";
  }

  private loadGltf(
    loader: GLTFLoader,
    url: string
  ): Promise<import("three/examples/jsm/loaders/GLTFLoader.js").GLTF> {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
  }

  private async loadContactJson(
    url: string
  ): Promise<ContactCurveData | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return (await response.json()) as ContactCurveData;
    } catch {
      return null;
    }
  }

  private bakeClip(
    clip: AnimationClip,
    entry: TurnClipManifestEntry,
    modelPrefix: string,
    contactData: ContactCurveData | null
  ): BakedTurnClip {
    // Detect clip's bone prefix
    const clipPrefix = this.detectClipPrefix(clip);

    // Determine frame count from clip duration at 30fps (standard Mixamo)
    const fps = 30;
    const frameCount = Math.round(clip.duration * fps) + 1;

    const boneFrames = new Map<string, Quaternion[]>();
    const hipsPositions: Vector3[] = [];

    // Initialize Hips position array
    for (let i = 0; i < frameCount; i++) {
      hipsPositions.push(new Vector3());
    }

    // Parse tracks
    for (const track of clip.tracks) {
      const dotIdx = track.name.indexOf(".");
      if (dotIdx === -1) continue;

      const fullBoneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx + 1);

      // Strip clip prefix to get canonical name
      const canonicalName = clipPrefix
        ? fullBoneName.slice(clipPrefix.length)
        : fullBoneName;

      // Only process turn-relevant bones
      if (!TURN_BONE_NAMES.has(canonicalName)) continue;

      if (property === "quaternion") {
        const frames: Quaternion[] = [];
        // Sample at each baked frame using linear interpolation of keyframes
        for (let f = 0; f < frameCount; f++) {
          const time = (f / (frameCount - 1)) * clip.duration;
          const q = this.sampleQuaternionTrack(track, time);
          frames.push(q);
        }
        boneFrames.set(canonicalName, frames);
      }

      if (canonicalName === "Hips" && property === "position") {
        for (let f = 0; f < frameCount; f++) {
          const time = (f / (frameCount - 1)) * clip.duration;
          const pos = this.sampleVectorTrack(track, time);
          hipsPositions[f] = pos;
        }
      }
    }

    // Contact curves: use provided JSON data or generate defaults
    let contactLeft: number[];
    let contactRight: number[];

    if (contactData && contactData.frameCount === frameCount) {
      contactLeft = contactData.leftFoot;
      contactRight = contactData.rightFoot;
    } else if (contactData) {
      // Resample if frame counts differ
      contactLeft = this.resampleArray(contactData.leftFoot, frameCount);
      contactRight = this.resampleArray(contactData.rightFoot, frameCount);
    } else {
      // No contact data — default to both feet planted
      contactLeft = new Array(frameCount).fill(1);
      contactRight = new Array(frameCount).fill(1);
    }

    return {
      angleDeg: entry.angleDeg,
      clipName: entry.clipName,
      duration: clip.duration,
      frameCount,
      boneFrames,
      hipsPositions,
      contactLeft,
      contactRight,
    };
  }

  private detectClipPrefix(clip: AnimationClip): string {
    if (clip.tracks.length === 0) return "";
    const boneName = clip.tracks[0]!.name.split(".")[0] ?? "";
    for (const prefix of KNOWN_PREFIXES) {
      if (prefix && boneName.startsWith(prefix)) return prefix;
    }
    return "";
  }

  /**
   * Sample a quaternion track at a given time using linear interpolation.
   */
  private sampleQuaternionTrack(
    track: { times: Float32Array; values: Float32Array },
    time: number
  ): Quaternion {
    const times = track.times;
    const values = track.values;

    // Clamp time
    if (time <= times[0]!) return new Quaternion(values[0], values[1], values[2], values[3]);
    const lastTime = times[times.length - 1]!;
    if (time >= lastTime) {
      const i = (times.length - 1) * 4;
      return new Quaternion(values[i], values[i + 1], values[i + 2], values[i + 3]);
    }

    // Find bracketing keyframes
    let lo = 0;
    for (let i = 0; i < times.length - 1; i++) {
      if (times[i + 1]! >= time) {
        lo = i;
        break;
      }
    }
    const hi = lo + 1;
    const t = (time - times[lo]!) / (times[hi]! - times[lo]!);

    const i0 = lo * 4;
    const i1 = hi * 4;
    const q0 = _tempQ1.set(values[i0]!, values[i0 + 1]!, values[i0 + 2]!, values[i0 + 3]!);
    const q1 = _tempQ2.set(values[i1]!, values[i1 + 1]!, values[i1 + 2]!, values[i1 + 3]!);

    return q0.slerp(q1, t).clone();
  }

  /**
   * Sample a vector3 track at a given time using linear interpolation.
   */
  private sampleVectorTrack(
    track: { times: Float32Array; values: Float32Array },
    time: number
  ): Vector3 {
    const times = track.times;
    const values = track.values;

    if (time <= times[0]!) return new Vector3(values[0], values[1], values[2]);
    const lastTime = times[times.length - 1]!;
    if (time >= lastTime) {
      const i = (times.length - 1) * 3;
      return new Vector3(values[i], values[i + 1], values[i + 2]);
    }

    let lo = 0;
    for (let i = 0; i < times.length - 1; i++) {
      if (times[i + 1]! >= time) {
        lo = i;
        break;
      }
    }
    const hi = lo + 1;
    const t = (time - times[lo]!) / (times[hi]! - times[lo]!);

    const i0 = lo * 3;
    const i1 = hi * 3;
    const v0 = _tempV1.set(values[i0]!, values[i0 + 1]!, values[i0 + 2]!);
    const v1 = _tempV2.set(values[i1]!, values[i1 + 1]!, values[i1 + 2]!);

    return v0.lerp(v1, t).clone();
  }

  /**
   * Resample an array to a different frame count using linear interpolation.
   */
  private resampleArray(source: number[], targetCount: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      const t = i / (targetCount - 1);
      const floatIdx = t * (source.length - 1);
      const lo = Math.floor(floatIdx);
      const hi = Math.min(source.length - 1, lo + 1);
      const frac = floatIdx - lo;
      result.push((source[lo] ?? 0) * (1 - frac) + (source[hi] ?? 0) * frac);
    }
    return result;
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-animation/ClipBasedTurnAnimator.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/services/implementations/ClipBasedTurnAnimator.ts
git commit -m "feat(3d): implement ClipBasedTurnAnimator with pre-baked phase sampling"
```

---

## Task 6: Avatar3D Turn Overlay

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte`

This task adds the `turnRequest` prop to Avatar3D, instantiates the `ClipBasedTurnAnimator`, and inserts the turn clip overlay into the animation pipeline between locomotion update and root motion extraction.

- [ ] **Step 1: Add imports and props**

Add to the import block (after line 58, before the Props interface):

```typescript
import { ClipBasedTurnAnimator } from "../services/implementations/ClipBasedTurnAnimator";
import type { ITurnAnimator, TurnRequest } from "../services/contracts/ITurnAnimator";
```

Add to the Props interface (after `enableFootPlanting`, around line 127):

```typescript
/** Active turn request — when set, the turn clip overlay applies bone
 *  rotations from the sampled turn clip between locomotion and root
 *  motion in the animation pipeline. Null means no turn is active. */
turnRequest?: TurnRequest | null;
```

Add to destructuring (after `enableFootPlanting = false`, around line 159):

```typescript
turnRequest: turnRequestProp = null,
```

- [ ] **Step 2: Add TurnAnimator instantiation**

Add to the service variables (after `contactCurveCache`, around line 177):

```typescript
let turnAnimator: ClipBasedTurnAnimator | null = null;
```

In the onMount initialization block where other services are created (inside the `if (enableLocomotion)` block, after `contactCurveCache = new ContactCurveCache()`, around line 461):

```typescript
turnAnimator = new ClipBasedTurnAnimator();
```

After the locomotion animator initialization (after `locomotionAnimator.loadAnimations({...})`, around line 388), add the turn animator initialization:

```typescript
// Load and bake turn clips (async — isReady() gates usage in frame loop)
if (turnAnimator && cachedRoot) {
  const turnsBase = "/animations/turns/";
  turnAnimator
    .initialize(cachedRoot, [
      { angleDeg: 90, glbUrl: `${turnsBase}turn-left-90.glb`, contactUrl: `${turnsBase}turn-left-90.contact.json`, clipName: "turn-left-90" },
      { angleDeg: -90, glbUrl: `${turnsBase}turn-right-90.glb`, contactUrl: `${turnsBase}turn-right-90.contact.json`, clipName: "turn-right-90" },
      { angleDeg: 180, glbUrl: `${turnsBase}turn-left-180.glb`, contactUrl: `${turnsBase}turn-left-180.contact.json`, clipName: "turn-left-180" },
      { angleDeg: -180, glbUrl: `${turnsBase}turn-right-180.glb`, contactUrl: `${turnsBase}turn-right-180.contact.json`, clipName: "turn-right-180" },
    ])
    .then(() => {
      // Register turn clip contact curves so FootPlanter can query them
      if (contactCurveCache && turnAnimator) {
        for (const curve of turnAnimator.getContactCurves()) {
          contactCurveCache.register(curve);
        }
      }
    })
    .catch((err) => {
      console.warn("[Avatar3D] Failed to load turn clips:", err);
    });
}
```

- [ ] **Step 3: Insert turn overlay into animation pipeline**

In the `useTask` animation loop, after `locomotionAnimator.update(delta)` (line 734) and before the root motion extraction block (line 752), insert:

```typescript
// Turn clip overlay — when a turn is active, overwrite lower-body
// and spine bones with the turn clip's authored pose at the current
// phase. The idle animation's hip sway is suspended on these bones;
// the turn clip's own authored motion takes over. When turnRequest
// is null, idle resumes driving all bones.
let currentTurnClipName: string | undefined;
let currentTurnPhase: number | undefined;

if (turnRequestProp && turnAnimator?.isReady() && skeletonService) {
  const sample = turnAnimator.sample(turnRequestProp);
  const bones = skeletonService.getState().bones;

  // Apply bone rotations — overwrite animation pose for lower body
  for (const [boneName, quat] of sample.boneRotations) {
    const bone = bones.get(boneName);
    if (bone) {
      bone.quaternion.copy(quat);
    }
  }

  // Apply Hips position for root motion yaw extraction
  if (sample.hipsPosition) {
    const hipsBone = bones.get("Hips");
    if (hipsBone) {
      hipsBone.position.copy(sample.hipsPosition);
    }
  }

  // Track clip info for FootPlanter contact curve lookup
  if (sample.clipName) {
    currentTurnClipName = sample.clipName;
    currentTurnPhase = turnRequestProp.phase;
  }
}
```

- [ ] **Step 4: Pass turn clip info to FootPlanter**

Update the FootPlanter.update() call (around line 781) to include the turn clip name and phase:

Replace:
```typescript
footPlanter.update(delta, {
  groundY: 0,
  locomotionState: currentLocomotionState,
  isMoving,
  // currentClipName / currentClipPhase omitted in Phase 1 — velocity
  // fallback handles idle + walk. Phase 2 populates these when turn
  // clips play.
});
```

With:
```typescript
footPlanter.update(delta, {
  groundY: 0,
  locomotionState: currentLocomotionState,
  isMoving,
  currentClipName: currentTurnClipName,
  currentClipPhase: currentTurnPhase,
});
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "feat(3d): wire turn clip overlay into Avatar3D animation pipeline"
```

---

## Task 7: PerformerRig Turn Scheduling and New Props

**Files:**
- Modify: `src/lib/shared/3d/components/PerformerRig.svelte`

This task adds pass-through props for `enableRootMotion`, `enableFootPlanting`, and `turnRequest`, and implements the turn scheduling `$derived` that detects per-beat heading changes.

- [ ] **Step 1: Add imports**

Add after the existing imports (around line 31):

```typescript
import type { TurnRequest } from "../services/contracts/ITurnAnimator";
import { derivePlaneModeFromHands } from "../state/avatar-instance-state.svelte";
```

- [ ] **Step 2: Add new props to the interface**

Add to the Props interface (after `animationDrivenYaw`, around line 88):

```typescript
/** Enable idle/walk locomotion animation on the avatar.
 *  When true, the avatar breathes/sways while standing. */
enableRootMotion?: boolean;
/** Enable foot planting IK on the avatar. Pins feet to the
 *  ground during contact phases. */
enableFootPlanting?: boolean;
/** Externally provided turn request. When null, PerformerRig
 *  derives its own from per-beat heading changes. */
turnRequestOverride?: TurnRequest | null;
```

Add to destructuring (after `onYawIntegrated`):

```typescript
enableRootMotion = false,
enableFootPlanting = false,
turnRequestOverride,
```

- [ ] **Step 3: Add heading derivation and turn scheduling**

Add after the `isDualWheel` derived (around line 147):

```typescript
// ── Turn scheduling ──
// Derive per-beat heading from the avatar's plane mode configuration.
// When consecutive beats have different headings (from per-beat plane
// overrides), schedule a turn during that beat.

function getHeadingForBeat(beatIndex: number): number {
  const override = avatarState.beatPlaneOverrides.get(beatIndex);
  if (override) {
    const mode = derivePlaneModeFromHands(
      override.blue ?? Plane.WALL,
      override.red ?? Plane.WALL
    );
    return PLANE_MODE_CONFIGS[mode].facingAngle;
  }
  return PLANE_MODE_CONFIGS[avatarState.planeMode].facingAngle;
}

const turnRequest = $derived.by((): TurnRequest | null => {
  // External override takes precedence
  if (turnRequestOverride !== undefined) return turnRequestOverride;

  // No sequence loaded or single-beat → no turns
  if (!avatarState.hasSequence || avatarState.totalSteps <= 1) return null;

  const currentIdx = avatarState.currentStepIndex;
  // Beat 0 is the start position — no "from" heading to compare
  if (currentIdx === 0) return null;

  const currentHeading = getHeadingForBeat(currentIdx);
  const prevHeading = getHeadingForBeat(currentIdx - 1);

  // Compute shortest-path angle
  let delta = currentHeading - prevHeading;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;

  // Skip tiny or zero heading changes
  if (Math.abs(delta) < 0.01) return null;

  return {
    fromHeading: prevHeading,
    toHeading: currentHeading,
    phase: avatarState.progress,
  };
});

// When a turn is active, enable animation-driven yaw so the rig
// rotates from the turn clip's root motion rather than snapping.
const effectiveAnimDrivenYaw = $derived(animationDrivenYaw || turnRequest !== null);
```

- [ ] **Step 4: Pass new props to Avatar3D**

Update the `<Avatar3D>` component call (around line 182) to include the new props:

Add these props to the existing Avatar3D instantiation:

```svelte
enableLocomotion={enableLocomotion}
enableRootMotion={enableRootMotion}
enableFootPlanting={enableFootPlanting}
turnRequest={turnRequest}
```

And update the rotation line:

Replace:
```svelte
rotation.y={animationDrivenYaw ? accumulatedYaw : facingAngle}
```

With:
```svelte
rotation.y={effectiveAnimDrivenYaw ? accumulatedYaw : facingAngle}
```

And update the `onRootMotion` prop — it should fire when EITHER `animationDrivenYaw` is explicitly set OR a turn is active:

Replace:
```svelte
onRootMotion={animationDrivenYaw
  ? (delta) => {
      if (delta.yawDelta !== 0) {
        accumulatedYaw += delta.yawDelta;
        onYawIntegrated?.(accumulatedYaw);
      }
    }
  : undefined}
```

With:
```svelte
onRootMotion={effectiveAnimDrivenYaw
  ? (delta) => {
      if (delta.yawDelta !== 0) {
        accumulatedYaw += delta.yawDelta;
        onYawIntegrated?.(accumulatedYaw);
      }
    }
  : undefined}
```

- [ ] **Step 5: Snap facing angle at turn completion**

When a turn completes (turnRequest goes from non-null to null), the avatarState's `facingAngle` still holds the PRE-turn heading. If we just sync `accumulatedYaw = facingAngle`, the rig snaps back. Fix: snap the avatarState to the target heading on turn completion, then update the sync effect.

First, update the sync effect to use `effectiveAnimDrivenYaw`:

Replace:
```typescript
$effect(() => {
  if (!animationDrivenYaw) {
    accumulatedYaw = facingAngle;
  }
});
```

With:
```typescript
$effect(() => {
  if (!effectiveAnimDrivenYaw) {
    accumulatedYaw = facingAngle;
  }
});
```

Then add a turn-completion effect BEFORE the sync effect (order matters in Svelte 5 — earlier effects run first):

```typescript
// Track the target heading of the active turn. When the turn completes
// (turnRequest goes null), snap the consumer's facing angle to the
// target heading so the sync effect picks up the correct post-turn
// angle instead of snapping back to the pre-turn heading.
let turnTargetHeading: number | null = $state(null);

$effect(() => {
  if (turnRequest) {
    turnTargetHeading = turnRequest.toHeading;
  } else if (turnTargetHeading !== null) {
    // Turn just completed — snap avatarState to post-turn heading
    avatarState.snapFacingAngle(turnTargetHeading);
    turnTargetHeading = null;
  }
});
```

This ensures the rig smoothly holds its post-turn rotation instead of snapping back.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/components/PerformerRig.svelte
git commit -m "feat(3d): add turn scheduling and pass-through props to PerformerRig"
```

---

## Task 8: Viewer3DScene Integration

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte`

Enable locomotion, root motion, and foot planting for the sequence viewer performers so they get idle breathing animation and planted feet.

- [ ] **Step 1: Add enableLocomotion, enableRootMotion, and enableFootPlanting to PerformerRig**

In the `<PerformerRig>` block (around line 240), add the new props:

```svelte
<PerformerRig
  position={performer.position}
  facingAngle={performer.facingAngle}
  planeMode={performer.planeMode}
  avatarState={performer}
  showGrid={viewer3DState.showGrid}
  visiblePlanes={gridVisiblePlanes}
  gridMode={(sequenceData?.gridMode ?? "diamond") as import("../domain/constants/grid-layout").GridMode}
  {bluePropType}
  {redPropType}
  bluePropState={performer.bluePropState}
  redPropState={performer.redPropState}
  tipEffectMap={globalTipEffectMap}
  {isPlaying}
  enableLocomotion={true}
  enableRootMotion={true}
  enableFootPlanting={true}
/>
```

The `enableLocomotion={true}` loads the idle animation so the avatar breathes and sways instead of standing in a static pose. The state machine stays in IDLE (isMoving is false) so walk clips have zero weight.

`enableRootMotion={true}` initializes the root motion extractor so turn clip yaw can be extracted.

`enableFootPlanting={true}` pins feet to the ground via hinge-constrained leg IK.

- [ ] **Step 2: Verify no regression**

Run: `npm run check`
Expected: No type errors from the new props.

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DScene.svelte
git commit -m "feat(3d): enable locomotion + foot planting for sequence viewer performers"
```

---

## Task 9: Museum NPC Integration

**Files:**
- Modify: `src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte`

Enable the same flags for museum NPCs so they get idle animation and foot planting. Reactive turning toward the player is a separate concern (requires player position from the room manager) and is noted as a future follow-up — not blocked by this task.

- [ ] **Step 1: Add enableLocomotion and enableFootPlanting to PerformerRig**

In the `<PerformerRig>` block (around line 152), add the new props:

```svelte
<PerformerRig
  position={{ x: 0, z: 0 }}
  {facingAngle}
  planeMode={PlaneMode.WALL}
  avatarState={performerState}
  {showGrid}
  visiblePlanes={new Set([Plane.WALL])}
  gridMode={(resolvedSequence?.gridMode ?? "diamond") as GridMode}
  {bluePropType}
  {redPropType}
  groundOffset={museumGroundOffset}
  enableLocomotion={true}
  enableRootMotion={true}
  enableFootPlanting={true}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte
git commit -m "feat(3d): enable locomotion + foot planting for museum NPCs"
```

---

## Task 10: Final Build Verification and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run type checker**

Run: `npm run check`
Expected: No new type errors.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All ClipBasedTurnAnimator tests pass. Pre-existing test failures (16 on main, unrelated) remain unchanged.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no new warnings.

- [ ] **Step 4: Manual verification checklist**

Open the sequence viewer at `localhost:5173`:

1. **Idle breathing:** Load any sequence. The avatar should breathe/sway naturally (not static mannequin pose).
2. **Foot planting:** Watch the avatar's feet for 30 seconds. They should stay planted on the ground, not sliding with hip sway.
3. **Prop IK:** Arms should still track prop positions correctly. The idle sway should not affect hand placement.
4. **Scrubbing:** Drag the timeline back and forth. Avatar should show correct pose at every position.
5. **Playback:** Play the sequence. Props spin correctly, avatar stands naturally.

Open the museum (if accessible):
6. **NPC idle:** Museum performer stations should show breathing avatars with planted feet.
7. **NPC playback:** NPCs performing sequences should have correct prop motion + idle body.

Note: Turn clips will only trigger when per-beat heading changes exist (via per-beat plane overrides). Without those, the turn infrastructure is loaded but dormant — identical to the current visual behavior but with the addition of idle animation and foot planting.

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore(3d): Phase 2 turn-in-place cleanup and verification"
```

---

## Future Work (Not In This Plan)

1. **Museum NPC reactive turns:** Pass player position from room manager → station → PerformerRig. Compute heading toward player. Schedule turn when heading delta exceeds threshold. Requires changes to museum room architecture.

2. **Per-beat heading derivation from sequence data:** Currently heading comes from plane mode only. Future work: derive body rotation from prop path requirements (e.g., a prop moving from wall to wheel plane implies a 90° body turn). This makes turns automatic without per-beat plane overrides.

3. **45° and 135° turn clips (Move.ai):** Phone mocap captures to fill the remaining angle increments. The linear fallback handles these angles for now.

4. **Cross-fade between consecutive turns:** When a turn is interrupted by another heading change before completing, blend between the two turn clips. Spec calls this "Phase 3: interruption blending."

5. **Idle variation:** Load multiple idle clips (breathing variations) and randomly switch between them for more natural standing behavior.
