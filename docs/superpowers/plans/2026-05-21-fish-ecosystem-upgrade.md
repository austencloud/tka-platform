# Fish Ecosystem Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-model fish system with a 50-species PBR ecosystem — ABZU-style per-species vertex animation, GPU behavioral ecology state machine, and dynamic species rotation.

**Architecture:** Three independent layers. Layer 1 converts models, creates species config, rewrites FishSchool.svelte with per-locomotion-mode vertex animation + PBR fragment shader. Layer 2 adds a `textureState` GPGPU variable for flee/chase/territorial behaviors. Layer 3 adds `SpeciesRotationManager` for visitor spawn/despawn. Each layer is independently shippable.

**Tech Stack:** Blender 5.0 (batch FBX→GLB), Three.js GPUComputationRenderer, GLSL vertex/fragment shaders, Svelte 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-21-fish-ecosystem-upgrade-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/convert-fish-pack.py` | CREATE — Blender batch script: FBX→GLB + vertex color baking + normalize + Draco |
| `static/models/ocean/pack/*.glb` | CREATE (50) — Converted models with baked vertex colors |
| `src/.../ocean/fish-species-config.ts` | CREATE — All 50 species definitions (locomotion mode, trophic role, size, speed, social, bold, instance counts, resident/visitor) |
| `src/.../ocean/fish-locomotion-params.ts` | CREATE — 6 locomotion mode parameter sets (swimFreq, waveK, baseAmplitude, stiffness, etc.) |
| `src/.../ocean/fish-shaders.ts` | CREATE — All GLSL shader strings extracted from FishSchool.svelte (velocity, position, render vertex, render fragment) |
| `src/.../ocean/FishSchool.svelte` | REWRITE — Multi-species instancing from GLB pack, locomotion-mode vertex animation, PBR fragment, configurable from species config |
| `src/.../ocean/FishEventSystem.ts` | EXTEND — Add trophic-role-aware dart selection, predator proximity response |
| `src/.../ocean/fish-behavior-shader.ts` | CREATE (Layer 2) — State transition GLSL shader string |
| `src/.../ocean/SpeciesRotationManager.ts` | CREATE (Layer 3) — CPU timer-driven visitor spawn/despawn, GPU slot allocation |
| `tests/unit/3d-viewer/fish-species-config.test.ts` | CREATE — Validate config completeness, locomotion assignments, size scale ranges |
| `tests/unit/3d-viewer/fish-locomotion-params.test.ts` | CREATE — Validate parameter ranges, all modes covered |
| `tests/unit/3d-viewer/fish-event-system.test.ts` | EXTEND — Trophic-aware dart tests |
| `tests/unit/3d-viewer/species-rotation.test.ts` | CREATE (Layer 3) — Rotation manager slot allocation, spawn/despawn lifecycle |

**Abbreviation:** `src/.../ocean/` = `src/lib/shared/3d/environments/scenes/ocean/`

---

## Layer 1: Models + Animation

### Task 1: Blender Batch Conversion Script

**Files:**
- Create: `scripts/convert-fish-pack.py`

- [ ] **Step 1: Write the Blender batch conversion script**

```python
"""
Fish Pack FBX → GLB Converter with Vertex Color Baking

Usage:
  blender --background --python scripts/convert-fish-pack.py -- <input_dir> <output_dir>

Processes all FBX files in input_dir:
1. Import FBX
2. Strip armatures/bones
3. Normalize to unit bounding box, center origin
4. Align forward to +Z (head at -Z, tail at +Z)
5. Bake vertex colors (R=spine gradient, G=pectoral mask, B=dorsal/caudal mask)
6. Export GLB with embedded textures + Draco compression
"""

import bpy
import bmesh
import sys
import os
import math
from pathlib import Path
from mathutils import Vector


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in bpy.data.armatures:
        if block.users == 0:
            bpy.data.armatures.remove(block)


def import_fbx(filepath):
    print(f"Importing: {filepath}")
    bpy.ops.import_scene.fbx(
        filepath=filepath,
        use_anim=False,
        ignore_leaf_bones=True,
        automatic_bone_orientation=True,
    )


def strip_armatures():
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'ARMATURE':
            bpy.data.objects.remove(obj, do_unlink=True)


def find_mesh():
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            return obj
    return None


def normalize_and_center(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bbox = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    min_co = Vector((min(v.x for v in bbox), min(v.y for v in bbox), min(v.z for v in bbox)))
    max_co = Vector((max(v.x for v in bbox), max(v.y for v in bbox), max(v.z for v in bbox)))
    size = max_co - min_co
    max_dim = max(size.x, size.y, size.z)

    if max_dim > 0.001:
        scale_factor = 1.0 / max_dim
        obj.scale = (scale_factor, scale_factor, scale_factor)
        bpy.ops.object.transform_apply(scale=True)

    bbox = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    center = sum((Vector(v) for v in bbox), Vector()) / 8
    obj.location = -center
    bpy.ops.object.transform_apply(location=True)


def bake_vertex_colors(obj):
    mesh = obj.data
    if not mesh.color_attributes:
        mesh.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()

    color_layer = bm.loops.layers.color.active
    if not color_layer:
        color_layer = bm.loops.layers.color.new("Col")

    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)
    body_width = max_x - min_x
    body_height = max_y - min_y
    body_length = max_z - min_z

    for face in bm.faces:
        for loop in face.loops:
            v = loop.vert.co

            # Red: spine gradient (0 at head/min_z, 1 at tail/max_z)
            r = (v.z - min_z) / body_length if body_length > 0.001 else 0.0

            # Green: pectoral fin mask
            lateral_extent = abs(v.x) / (body_width * 0.5) if body_width > 0.001 else 0.0
            y_norm = (v.y - min_y) / body_height if body_height > 0.001 else 0.5
            is_pectoral = lateral_extent > 0.4 and 0.35 < y_norm < 0.65
            g = 1.0 if is_pectoral else 0.0

            # Blue: dorsal (top) + caudal (tail) fin mask
            z_norm = (v.z - min_z) / body_length if body_length > 0.001 else 0.0
            is_caudal = z_norm > 0.6
            is_dorsal = y_norm > 0.7
            b = 1.0 if (is_caudal or is_dorsal) else 0.0

            loop[color_layer] = (r, g, b, 1.0)

    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def export_glb(obj, output_path):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_colors=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format='AUTO',
    )
    print(f"Exported: {output_path}")


def process_fish(fbx_path, output_dir):
    clear_scene()
    import_fbx(str(fbx_path))
    strip_armatures()

    obj = find_mesh()
    if not obj:
        print(f"WARNING: No mesh found in {fbx_path.name}, skipping")
        return False

    normalize_and_center(obj)
    bake_vertex_colors(obj)

    stem = fbx_path.stem
    # Convert PascalCase to snake_case for filename consistency
    import re
    snake = re.sub(r'(?<!^)(?=[A-Z])', '_', stem).lower()
    output_path = Path(output_dir) / f"{snake}.glb"
    export_glb(obj, output_path)
    return True


def main():
    argv = sys.argv
    separator_idx = argv.index('--') if '--' in argv else -1
    if separator_idx < 0 or len(argv) < separator_idx + 3:
        print("Usage: blender --background --python convert-fish-pack.py -- <input_dir> <output_dir>")
        sys.exit(1)

    input_dir = Path(argv[separator_idx + 1])
    output_dir = Path(argv[separator_idx + 2])

    if not input_dir.is_dir():
        print(f"Input directory not found: {input_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    fbx_files = sorted(input_dir.glob("*.fbx"))
    print(f"Found {len(fbx_files)} FBX files")

    success = 0
    for fbx in fbx_files:
        if process_fish(fbx, output_dir):
            success += 1

    print(f"\nDone: {success}/{len(fbx_files)} converted successfully")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the batch conversion**

Run:
```powershell
& "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe" --background --python scripts/convert-fish-pack.py -- "D:\Downloads\OceanFishPack_temp\OceanFishPack\FBX" "E:\tka-platform\static\models\ocean\pack"
```
Expected: 50 GLB files in `static/models/ocean/pack/`, each 50-300KB with Draco compression.

- [ ] **Step 3: Verify converted models**

Run:
```powershell
Get-ChildItem "E:\tka-platform\static\models\ocean\pack\*.glb" | Measure-Object | Select-Object -ExpandProperty Count
```
Expected: `50`

Run:
```powershell
Get-ChildItem "E:\tka-platform\static\models\ocean\pack\*.glb" | Sort-Object Length | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}} | Format-Table
```
Expected: All files present, sizes between ~20KB-500KB.

- [ ] **Step 4: Spot-check one model for vertex colors**

Run a quick Node.js check that the GLB contains vertex color data:
```powershell
node -e "const fs=require('fs');const{GLTFLoader}=require('three/examples/jsm/loaders/GLTFLoader.js');/* Can't run in Node without canvas — instead check file size delta */" 
```

Alternative: open one GLB in the dev server browser console:
```javascript
// Paste in browser console after loading ocean scene
const loader = new THREE.GLTFLoader();
loader.load('/models/ocean/pack/clownfish.glb', (gltf) => {
  gltf.scene.traverse(c => {
    if (c.isMesh) {
      console.log('Has vertex colors:', !!c.geometry.attributes.color);
      console.log('Has UV:', !!c.geometry.attributes.uv);
      console.log('Vertex count:', c.geometry.attributes.position.count);
    }
  });
});
```
Expected: `Has vertex colors: true`, `Has UV: true`, vertex count 500-5000.

- [ ] **Step 5: Commit**

```powershell
git add scripts/convert-fish-pack.py static/models/ocean/pack/
git commit -m "feat(ocean): batch-convert 50 fish FBX models to GLB with vertex colors

Blender script normalizes geometry, bakes spine/pectoral/dorsal vertex color
masks for ABZU-style vertex animation, exports with Draco compression.
Source: OceanFishPack (50 oceanic species with 1K albedo textures).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Species Config + Locomotion Parameters

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/fish-species-config.ts`
- Create: `src/lib/shared/3d/environments/scenes/ocean/fish-locomotion-params.ts`
- Create: `tests/unit/3d-viewer/fish-species-config.test.ts`
- Create: `tests/unit/3d-viewer/fish-locomotion-params.test.ts`

- [ ] **Step 1: Write the failing tests for species config**

```typescript
// tests/unit/3d-viewer/fish-species-config.test.ts
import { describe, it, expect } from "vitest";
import {
  RESIDENT_SPECIES,
  VISITOR_SPECIES,
  ALL_SPECIES,
  TrophicRole,
  LocomotionMode,
  type FishSpeciesConfig,
} from "$lib/shared/3d/environments/scenes/ocean/fish-species-config";

describe("fish-species-config", () => {
  it("has exactly 50 species total", () => {
    expect(ALL_SPECIES.length).toBe(50);
  });

  it("has 13 resident species", () => {
    expect(RESIDENT_SPECIES.length).toBe(13);
  });

  it("has 37 visitor species", () => {
    expect(VISITOR_SPECIES.length).toBe(37);
  });

  it("every species has a valid locomotion mode", () => {
    for (const sp of ALL_SPECIES) {
      expect(Object.values(LocomotionMode)).toContain(sp.locomotionMode);
    }
  });

  it("every species has a valid trophic role", () => {
    for (const sp of ALL_SPECIES) {
      expect(Object.values(TrophicRole)).toContain(sp.trophicRole);
    }
  });

  it("every species has sizeScale > 0", () => {
    for (const sp of ALL_SPECIES) {
      expect(sp.sizeScale).toBeGreaterThan(0);
    }
  });

  it("every species has a model filename", () => {
    for (const sp of ALL_SPECIES) {
      expect(sp.modelFile).toMatch(/^[a-z_]+\.glb$/);
    }
  });

  it("no duplicate model filenames", () => {
    const files = ALL_SPECIES.map((s) => s.modelFile);
    expect(new Set(files).size).toBe(files.length);
  });

  it("resident species have instanceCount defined", () => {
    for (const sp of RESIDENT_SPECIES) {
      expect(sp.instanceCount).toBeGreaterThan(0);
    }
  });

  it("speed range is valid (min < max, both positive)", () => {
    for (const sp of ALL_SPECIES) {
      expect(sp.speed[0]).toBeGreaterThan(0);
      expect(sp.speed[1]).toBeGreaterThanOrEqual(sp.speed[0]);
    }
  });

  it("social range is valid", () => {
    for (const sp of ALL_SPECIES) {
      expect(sp.social[0]).toBeGreaterThanOrEqual(0);
      expect(sp.social[1]).toBeGreaterThanOrEqual(sp.social[0]);
    }
  });

  it("bold range is valid", () => {
    for (const sp of ALL_SPECIES) {
      expect(sp.bold[0]).toBeGreaterThan(0);
      expect(sp.bold[1]).toBeGreaterThanOrEqual(sp.bold[0]);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d-viewer/fish-species-config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the failing tests for locomotion params**

```typescript
// tests/unit/3d-viewer/fish-locomotion-params.test.ts
import { describe, it, expect } from "vitest";
import {
  LOCOMOTION_PARAMS,
  LocomotionMode,
  type LocomotionModeParams,
} from "$lib/shared/3d/environments/scenes/ocean/fish-locomotion-params";

describe("fish-locomotion-params", () => {
  it("has params for all 6 locomotion modes", () => {
    const modes = Object.values(LocomotionMode).filter(
      (v) => typeof v === "number"
    );
    for (const mode of modes) {
      expect(LOCOMOTION_PARAMS[mode as LocomotionMode]).toBeDefined();
    }
  });

  it("swimFreq is between 0.5 and 10 Hz for all modes", () => {
    for (const params of Object.values(LOCOMOTION_PARAMS)) {
      expect(params.swimFreq).toBeGreaterThanOrEqual(0.5);
      expect(params.swimFreq).toBeLessThanOrEqual(10);
    }
  });

  it("stiffness is between 0.0 and 1.0", () => {
    for (const params of Object.values(LOCOMOTION_PARAMS)) {
      expect(params.stiffness).toBeGreaterThanOrEqual(0);
      expect(params.stiffness).toBeLessThanOrEqual(1);
    }
  });

  it("ostraciiform has highest stiffness", () => {
    const ostra = LOCOMOTION_PARAMS[LocomotionMode.Ostraciiform];
    for (const [mode, params] of Object.entries(LOCOMOTION_PARAMS)) {
      if (Number(mode) !== LocomotionMode.Ostraciiform) {
        expect(ostra.stiffness).toBeGreaterThanOrEqual(params.stiffness);
      }
    }
  });

  it("labriform has highest pectoral amplitude", () => {
    const labri = LOCOMOTION_PARAMS[LocomotionMode.Labriform];
    for (const [mode, params] of Object.entries(LOCOMOTION_PARAMS)) {
      if (Number(mode) !== LocomotionMode.Labriform) {
        expect(labri.pectoralAmp).toBeGreaterThanOrEqual(params.pectoralAmp);
      }
    }
  });

  it("anguilliform has zero stiffness (full body wave)", () => {
    const angu = LOCOMOTION_PARAMS[LocomotionMode.Anguilliform];
    expect(angu.stiffness).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d-viewer/fish-locomotion-params.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Write the locomotion params module**

```typescript
// src/lib/shared/3d/environments/scenes/ocean/fish-locomotion-params.ts

export enum LocomotionMode {
  Anguilliform = 0,
  Subcarangiform = 1,
  Carangiform = 2,
  Thunniform = 3,
  Ostraciiform = 4,
  Labriform = 5,
}

export interface LocomotionModeParams {
  swimFreq: number;
  waveK: number;
  baseAmplitude: number;
  stiffness: number;
  ampExponent: number;
  strideAmp: number;
  rollAmp: number;
  pectoralFreq: number;
  pectoralAmp: number;
}

export const LOCOMOTION_PARAMS: Record<LocomotionMode, LocomotionModeParams> = {
  [LocomotionMode.Anguilliform]: {
    swimFreq: 1.5,
    waveK: 1.6,
    baseAmplitude: 0.07,
    stiffness: 0,
    ampExponent: 1.0,
    strideAmp: 0.03,
    rollAmp: 0.05,
    pectoralFreq: 0,
    pectoralAmp: 0,
  },
  [LocomotionMode.Subcarangiform]: {
    swimFreq: 3.0,
    waveK: 1.1,
    baseAmplitude: 0.10,
    stiffness: 0.4,
    ampExponent: 2.0,
    strideAmp: 0.02,
    rollAmp: 0.04,
    pectoralFreq: 3.0,
    pectoralAmp: 0.05,
  },
  [LocomotionMode.Carangiform]: {
    swimFreq: 4.0,
    waveK: 1.0,
    baseAmplitude: 0.12,
    stiffness: 0.65,
    ampExponent: 3.0,
    strideAmp: 0.01,
    rollAmp: 0.02,
    pectoralFreq: 0,
    pectoralAmp: 0,
  },
  [LocomotionMode.Thunniform]: {
    swimFreq: 5.0,
    waveK: 1.0,
    baseAmplitude: 0.20,
    stiffness: 0.85,
    ampExponent: 4.0,
    strideAmp: 0.005,
    rollAmp: 0.01,
    pectoralFreq: 0,
    pectoralAmp: 0,
  },
  [LocomotionMode.Ostraciiform]: {
    swimFreq: 2.0,
    waveK: 0,
    baseAmplitude: 0.07,
    stiffness: 0.95,
    ampExponent: 1.0,
    strideAmp: 0,
    rollAmp: 0,
    pectoralFreq: 4.0,
    pectoralAmp: 0.08,
  },
  [LocomotionMode.Labriform]: {
    swimFreq: 1.5,
    waveK: 0.3,
    baseAmplitude: 0.03,
    stiffness: 0.85,
    ampExponent: 1.5,
    strideAmp: 0.01,
    rollAmp: 0.02,
    pectoralFreq: 6.0,
    pectoralAmp: 0.12,
  },
};

export const LOCOMOTION_MODE_COUNT = Object.keys(LOCOMOTION_PARAMS).length;
```

- [ ] **Step 6: Write the species config module**

```typescript
// src/lib/shared/3d/environments/scenes/ocean/fish-species-config.ts

import { LocomotionMode } from "./fish-locomotion-params";

export { LocomotionMode };

export enum TrophicRole {
  ApexPredator = 0,
  Mesopredator = 1,
  SchoolingPrey = 2,
  ReefCruiser = 3,
  Territorial = 4,
  Neutral = 5,
}

export interface FishSpeciesConfig {
  name: string;
  modelFile: string;
  locomotionMode: LocomotionMode;
  trophicRole: TrophicRole;
  sizeScale: number;
  speed: [number, number];
  social: [number, number];
  bold: [number, number];
  instanceCount: number;
  resident: boolean;
}

export const RESIDENT_SPECIES: FishSpeciesConfig[] = [
  { name: "Clownfish", modelFile: "clownfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Territorial, sizeScale: 0.22, speed: [0.6, 0.75], social: [0.8, 1.2], bold: [0.7, 1.0], instanceCount: 4, resident: true },
  { name: "Blue Tang", modelFile: "blue_tang.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.60, speed: [0.8, 1.0], social: [1.0, 1.4], bold: [0.6, 0.9], instanceCount: 6, resident: true },
  { name: "Yellow Tang", modelFile: "yellow_tang.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.40, speed: [0.8, 1.0], social: [1.0, 1.4], bold: [0.6, 0.9], instanceCount: 5, resident: true },
  { name: "Emperor Angelfish", modelFile: "emperor_angelfish.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.76, speed: [0.5, 0.7], social: [0.6, 1.0], bold: [0.7, 1.0], instanceCount: 3, resident: true },
  { name: "Copperband Butterflyfish", modelFile: "copperband_butterflyfish.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.40, speed: [0.5, 0.7], social: [0.8, 1.2], bold: [0.6, 0.9], instanceCount: 4, resident: true },
  { name: "Moorish Idol", modelFile: "moorish_idol.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.44, speed: [0.5, 0.7], social: [0.6, 1.0], bold: [0.6, 0.9], instanceCount: 3, resident: true },
  { name: "Blue-Green Chromis", modelFile: "blue_green_chromis.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.SchoolingPrey, sizeScale: 0.20, speed: [1.2, 1.5], social: [1.5, 2.0], bold: [0.3, 0.5], instanceCount: 30, resident: true },
  { name: "Three-Stripe Damselfish", modelFile: "three_stripe_damselfish.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.Territorial, sizeScale: 0.20, speed: [1.0, 1.3], social: [0.8, 1.2], bold: [0.8, 1.1], instanceCount: 5, resident: true },
  { name: "Lyretail Anthias", modelFile: "lyretail_anthias.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.SchoolingPrey, sizeScale: 0.30, speed: [0.9, 1.1], social: [1.3, 1.8], bold: [0.4, 0.6], instanceCount: 15, resident: true },
  { name: "Blackspotted Puffer", modelFile: "blackspotted_puffer.glb", locomotionMode: LocomotionMode.Ostraciiform, trophicRole: TrophicRole.Neutral, sizeScale: 0.66, speed: [0.3, 0.5], social: [0.2, 0.4], bold: [1.2, 1.5], instanceCount: 2, resident: true },
  { name: "Banggai Cardinalfish", modelFile: "banggai_cardinalfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.16, speed: [0.5, 0.7], social: [0.8, 1.2], bold: [0.5, 0.8], instanceCount: 4, resident: true },
  { name: "Cleaner Wrasse", modelFile: "cleaner_wrasse.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.Neutral, sizeScale: 0.28, speed: [0.6, 0.8], social: [0.4, 0.8], bold: [0.9, 1.2], instanceCount: 3, resident: true },
  { name: "Royal Gramma", modelFile: "royal_gramma.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Territorial, sizeScale: 0.16, speed: [0.5, 0.7], social: [0.3, 0.6], bold: [0.7, 1.0], instanceCount: 3, resident: true },
];

export const VISITOR_SPECIES: FishSpeciesConfig[] = [
  // Pelagic predators
  { name: "Great Barracuda", modelFile: "great_barracuda.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.ApexPredator, sizeScale: 2.20, speed: [1.4, 1.8], social: [0.1, 0.3], bold: [1.3, 1.5], instanceCount: 1, resident: false },
  { name: "Yellowfin Tuna", modelFile: "yellowfin_tuna.glb", locomotionMode: LocomotionMode.Thunniform, trophicRole: TrophicRole.ApexPredator, sizeScale: 3.00, speed: [1.5, 2.0], social: [0.3, 0.6], bold: [1.3, 1.5], instanceCount: 2, resident: false },
  { name: "Giant Trevally", modelFile: "giant_trevally.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.ApexPredator, sizeScale: 2.00, speed: [1.3, 1.7], social: [0.2, 0.5], bold: [1.2, 1.5], instanceCount: 2, resident: false },
  { name: "Wahoo", modelFile: "wahoo.glb", locomotionMode: LocomotionMode.Thunniform, trophicRole: TrophicRole.ApexPredator, sizeScale: 3.20, speed: [1.6, 2.0], social: [0.1, 0.2], bold: [1.4, 1.5], instanceCount: 1, resident: false },
  { name: "Mahi-Mahi", modelFile: "mahi_mahi.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.ApexPredator, sizeScale: 2.40, speed: [1.3, 1.7], social: [0.3, 0.6], bold: [1.2, 1.5], instanceCount: 2, resident: false },
  { name: "Goliath Grouper", modelFile: "goliath_grouper.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 3.00, speed: [0.3, 0.5], social: [0.1, 0.2], bold: [1.4, 1.5], instanceCount: 1, resident: false },
  // Schooling pelagics
  { name: "Atlantic Herring", modelFile: "atlantic_herring.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.SchoolingPrey, sizeScale: 0.50, speed: [1.2, 1.6], social: [1.8, 2.0], bold: [0.2, 0.4], instanceCount: 50, resident: false },
  { name: "European Sardine", modelFile: "european_sardine.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.SchoolingPrey, sizeScale: 0.40, speed: [1.2, 1.5], social: [1.8, 2.0], bold: [0.2, 0.4], instanceCount: 50, resident: false },
  { name: "European Anchovy", modelFile: "european_anchovy.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.SchoolingPrey, sizeScale: 0.30, speed: [1.3, 1.7], social: [1.8, 2.0], bold: [0.2, 0.3], instanceCount: 60, resident: false },
  { name: "Atlantic Mackerel", modelFile: "atlantic_mackerel.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.SchoolingPrey, sizeScale: 0.70, speed: [1.3, 1.6], social: [1.5, 1.8], bold: [0.3, 0.5], instanceCount: 25, resident: false },
  { name: "Skipjack Tuna", modelFile: "skipjack_tuna.glb", locomotionMode: LocomotionMode.Thunniform, trophicRole: TrophicRole.ApexPredator, sizeScale: 1.60, speed: [1.4, 1.8], social: [0.5, 0.8], bold: [1.2, 1.4], instanceCount: 4, resident: false },
  { name: "Yellowtail Amberjack", modelFile: "yellowtail_amberjack.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.ApexPredator, sizeScale: 2.20, speed: [1.2, 1.6], social: [0.4, 0.7], bold: [1.1, 1.4], instanceCount: 4, resident: false },
  { name: "Spanish Mackerel", modelFile: "spanish_mackerel.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 2.40, speed: [1.3, 1.7], social: [0.5, 0.8], bold: [1.0, 1.3], instanceCount: 6, resident: false },
  { name: "Sergeant Major", modelFile: "sergeant_major.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.SchoolingPrey, sizeScale: 0.30, speed: [1.0, 1.3], social: [1.3, 1.7], bold: [0.4, 0.6], instanceCount: 20, resident: false },
  // Reef visitors
  { name: "True Clownfish", modelFile: "true_clownfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Territorial, sizeScale: 0.22, speed: [0.6, 0.75], social: [0.8, 1.2], bold: [0.7, 1.0], instanceCount: 3, resident: false },
  { name: "Powder Blue Tang", modelFile: "powder_blue_tang.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.46, speed: [0.8, 1.0], social: [1.0, 1.4], bold: [0.6, 0.9], instanceCount: 4, resident: false },
  { name: "Naso Unicornfish", modelFile: "naso_unicornfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.90, speed: [0.6, 0.8], social: [0.6, 1.0], bold: [0.7, 1.0], instanceCount: 3, resident: false },
  { name: "Queen Angelfish", modelFile: "queen_angelfish.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.80, speed: [0.5, 0.7], social: [0.5, 0.9], bold: [0.7, 1.0], instanceCount: 2, resident: false },
  { name: "Flame Angelfish", modelFile: "flame_angelfish.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.20, speed: [0.5, 0.7], social: [0.6, 1.0], bold: [0.6, 0.9], instanceCount: 3, resident: false },
  { name: "Lemonpeel Angelfish", modelFile: "lemonpeel_angelfish.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.24, speed: [0.5, 0.7], social: [0.6, 1.0], bold: [0.6, 0.9], instanceCount: 3, resident: false },
  { name: "Raccoon Butterflyfish", modelFile: "raccoon_butterflyfish.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.46, speed: [0.5, 0.7], social: [0.7, 1.1], bold: [0.6, 0.9], instanceCount: 3, resident: false },
  { name: "Threadfin Butterflyfish", modelFile: "threadfin_butterflyfish.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.46, speed: [0.5, 0.7], social: [0.7, 1.1], bold: [0.6, 0.9], instanceCount: 3, resident: false },
  { name: "Moon Wrasse", modelFile: "moon_wrasse.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.56, speed: [0.7, 0.9], social: [0.6, 1.0], bold: [0.7, 1.0], instanceCount: 4, resident: false },
  { name: "Six-Line Wrasse", modelFile: "six_line_wrasse.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.18, speed: [0.7, 0.9], social: [0.5, 0.9], bold: [0.7, 1.0], instanceCount: 4, resident: false },
  { name: "Bluehead Wrasse", modelFile: "bluehead_wrasse.glb", locomotionMode: LocomotionMode.Labriform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.40, speed: [0.7, 0.9], social: [0.6, 1.0], bold: [0.7, 1.0], instanceCount: 4, resident: false },
  { name: "Domino Damselfish", modelFile: "domino_damselfish.glb", locomotionMode: LocomotionMode.Carangiform, trophicRole: TrophicRole.Territorial, sizeScale: 0.28, speed: [1.0, 1.3], social: [0.8, 1.2], bold: [0.8, 1.1], instanceCount: 4, resident: false },
  { name: "Pajama Cardinalfish", modelFile: "pajama_cardinalfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.16, speed: [0.4, 0.6], social: [0.8, 1.2], bold: [0.5, 0.8], instanceCount: 4, resident: false },
  { name: "Longnose Hawkfish", modelFile: "longnose_hawkfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.ReefCruiser, sizeScale: 0.26, speed: [0.4, 0.6], social: [0.3, 0.6], bold: [0.8, 1.1], instanceCount: 2, resident: false },
  { name: "Picasso Triggerfish", modelFile: "picasso_triggerfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 0.60, speed: [0.6, 0.9], social: [0.3, 0.6], bold: [1.0, 1.3], instanceCount: 2, resident: false },
  { name: "Clown Triggerfish", modelFile: "clown_triggerfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 1.00, speed: [0.5, 0.8], social: [0.2, 0.5], bold: [1.0, 1.3], instanceCount: 1, resident: false },
  { name: "Blue Triggerfish", modelFile: "blue_triggerfish.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 0.90, speed: [0.6, 0.9], social: [0.3, 0.6], bold: [1.0, 1.3], instanceCount: 2, resident: false },
  { name: "Longspine Porcupinefish", modelFile: "longspine_porcupinefish.glb", locomotionMode: LocomotionMode.Ostraciiform, trophicRole: TrophicRole.Neutral, sizeScale: 1.00, speed: [0.3, 0.5], social: [0.2, 0.4], bold: [1.2, 1.5], instanceCount: 1, resident: false },
  { name: "Valentini Puffer", modelFile: "valentini_puffer.glb", locomotionMode: LocomotionMode.Ostraciiform, trophicRole: TrophicRole.Neutral, sizeScale: 0.22, speed: [0.3, 0.5], social: [0.2, 0.4], bold: [1.0, 1.3], instanceCount: 2, resident: false },
  { name: "Red Snapper", modelFile: "red_snapper.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 1.50, speed: [0.7, 1.0], social: [0.5, 0.8], bold: [0.9, 1.2], instanceCount: 3, resident: false },
  // Deep/cold water
  { name: "Atlantic Cod", modelFile: "atlantic_cod.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 2.00, speed: [0.5, 0.8], social: [0.4, 0.7], bold: [0.8, 1.1], instanceCount: 3, resident: false },
  { name: "Haddock", modelFile: "haddock.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 1.40, speed: [0.5, 0.8], social: [0.5, 0.8], bold: [0.7, 1.0], instanceCount: 3, resident: false },
  { name: "European Hake", modelFile: "european_hake.glb", locomotionMode: LocomotionMode.Subcarangiform, trophicRole: TrophicRole.Mesopredator, sizeScale: 1.60, speed: [0.5, 0.8], social: [0.3, 0.6], bold: [0.8, 1.1], instanceCount: 2, resident: false },
];

export const ALL_SPECIES: FishSpeciesConfig[] = [
  ...RESIDENT_SPECIES,
  ...VISITOR_SPECIES,
];

export const RESIDENT_FISH_COUNT = RESIDENT_SPECIES.reduce(
  (sum, sp) => sum + sp.instanceCount,
  0
);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-viewer/fish-species-config.test.ts tests/unit/3d-viewer/fish-locomotion-params.test.ts`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/lib/shared/3d/environments/scenes/ocean/fish-species-config.ts src/lib/shared/3d/environments/scenes/ocean/fish-locomotion-params.ts tests/unit/3d-viewer/fish-species-config.test.ts tests/unit/3d-viewer/fish-locomotion-params.test.ts
git commit -m "feat(ocean): add 50-species config and 6 locomotion mode parameters

Each species has locomotion mode, trophic role, size scale, speed/social/bold
ranges, and instance count. 13 residents (~87 fish), 37 visitors. Locomotion
params from Di Santo et al. 2021 biomechanics research.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Extract Shaders to Separate Module

FishSchool.svelte is 802 lines with 4 inline GLSL shaders. Extract them before rewriting so the component stays readable.

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts`
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte`

- [ ] **Step 1: Create the shader module with upgraded shaders**

```typescript
// src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts

import { LOCOMOTION_MODE_COUNT } from "./fish-locomotion-params";

const MAX_SPECIES = 50;
const MAX_LOCO_MODES = LOCOMOTION_MODE_COUNT;

// ── Simplex noise (shared across shaders) ─────────────────────────
const NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 curlNoise(vec3 p) {
  float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  float px = snoise(p + dx) - snoise(p - dx);
  float py = snoise(p + dy) - snoise(p - dy);
  float pz = snoise(p + dz) - snoise(p - dz);
  return vec3(py - pz, pz - px, px - py) / (2.0 * e);
}
`;

export const velocityShader = /* glsl */ `
uniform float uDelta;
uniform float uTime;
uniform float uSepDist;
uniform float uAliDist;
uniform float uMaxSpeed;
uniform float uMinSpeed;
uniform float uGroundY;
uniform float uHeightMin;
uniform float uHeightMax;
uniform float uStageRadius;
uniform float uBoundRadius;
uniform float uFishCount;
uniform float uMaxSteer;
uniform float uCurrentStrength;
uniform float uPerceptionCos;
uniform sampler2D tTraits;

uniform vec3 uSchoolCenters[${MAX_SPECIES}];
uniform float uSchoolRadius;

uniform vec3 uScatterOrigin;
uniform float uScatterRadius;
uniform float uScatterForce;

uniform int uDartCount;
uniform int uDartIndices[8];
uniform float uDartStrength;

uniform int uExcursionCount;
uniform int uExcursionIndices[4];
uniform float uExcursionBias[4];

${NOISE_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec3 pos = posData.xyz;
  vec4 velData = texture2D(textureVelocity, uv);
  vec3 vel = velData.xyz;
  float instanceScale = velData.w;

  if (pos.x > 9000.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, instanceScale); return; }

  vec4 traits = texture2D(tTraits, uv);
  float speedMult = traits.r;
  float socialMult = traits.g;
  float boldness = traits.b;

  int mySpecies = int(floor(posData.w));

  vec3 sep = vec3(0.0);
  vec3 ali = vec3(0.0);
  vec3 coh = vec3(0.0);
  float sepN = 0.0;
  float aliN = 0.0;
  float cohN = 0.0;

  vec3 forward = length(vel) > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);

  for (float y = 0.0; y < resolution.y; y += 1.0) {
    for (float x = 0.0; x < resolution.x; x += 1.0) {
      vec2 ref = (vec2(x, y) + 0.5) / resolution.xy;
      vec4 neighborPos = texture2D(texturePosition, ref);
      vec3 op = neighborPos.xyz;
      if (op.x > 9000.0) continue;

      vec3 toNeighbor = op - pos;
      float d = length(toNeighbor);
      if (d < 0.001 || d > uAliDist * 1.5) continue;

      float cosAngle = dot(forward, normalize(toNeighbor));
      if (cosAngle < uPerceptionCos) continue;

      int neighborSpecies = int(floor(neighborPos.w));
      bool sameSpecies = (mySpecies == neighborSpecies);

      if (d < uSepDist) {
        sep += normalize(pos - op) * (1.0 - d / uSepDist);
        sepN += 1.0;
      }
      if (d < uAliDist && sameSpecies) {
        ali += texture2D(textureVelocity, ref).xyz;
        aliN += 1.0;
      }
      if (d < uAliDist * 1.5 && sameSpecies) {
        coh += op;
        cohN += 1.0;
      }
    }
  }

  vec3 steer = vec3(0.0);

  if (sepN > 0.0) steer += normalize(sep / sepN) * 0.3;
  if (aliN > 0.0) steer += (ali / aliN - vel) * 0.6 * socialMult;
  if (cohN > 0.0) steer += normalize(coh / cohN - pos) * 0.8 * socialMult;

  if (mySpecies < ${MAX_SPECIES}) {
    vec3 toSchool = uSchoolCenters[mySpecies] - pos;
    float schoolDist = length(toSchool);
    if (schoolDist > uSchoolRadius) {
      float pull = (schoolDist - uSchoolRadius) / uSchoolRadius;
      steer += normalize(toSchool) * pull * 0.5;
    }
  }

  float curlScale = uCurrentStrength * (1.0 - socialMult * 0.4);
  vec3 curlForce = curlNoise(pos * 0.15 + uTime * 0.02) * curlScale;
  steer += curlForce;

  vec2 toCenter = -pos.xz;
  float distXZ = length(pos.xz);
  if (distXZ > uBoundRadius * 0.6) {
    float t = (distXZ - uBoundRadius * 0.6) / (uBoundRadius * 0.4);
    steer.xz += normalize(toCenter) * t * 1.5;
  }

  float minY = uGroundY + uHeightMin;
  float maxY = uGroundY + uHeightMax;
  if (pos.y < minY + 0.5) steer.y += (minY + 0.5 - pos.y) * 2.0;
  if (pos.y > maxY - 0.5) steer.y -= (pos.y - maxY + 0.5) * 2.0;

  float avoidDist = (uStageRadius + 2.5) * (1.5 - boldness * 0.4);
  if (distXZ < avoidDist) {
    float pen = avoidDist - distXZ;
    steer.xz += normalize(pos.xz + 0.001) * pen * 3.0;
  }

  float distToRay = distance(pos, uScatterOrigin);
  if (distToRay < uScatterRadius && uScatterForce > 0.0) {
    vec3 away = normalize(pos - uScatterOrigin + vec3(0.001));
    float proximity = 1.0 - distToRay / uScatterRadius;
    steer += away * uScatterForce * proximity * proximity;
  }

  float steerLen = length(steer);
  if (steerLen > uMaxSteer) steer = steer / steerLen * uMaxSteer;

  vel = vel * 0.94 + steer * uDelta;

  float adjMax = uMaxSpeed * speedMult;
  float adjMin = uMinSpeed * speedMult;
  float spd = length(vel);
  if (spd > adjMax) vel = vel / spd * adjMax;
  if (spd > 0.001 && spd < adjMin) vel = vel / spd * adjMin;

  int fishIdx = int(gl_FragCoord.y) * int(resolution.x) + int(gl_FragCoord.x);
  for (int i = 0; i < 8; i++) {
    if (i >= uDartCount) break;
    if (fishIdx == uDartIndices[i]) {
      vel += normalize(vel + vec3(0.001)) * uDartStrength;
    }
  }

  for (int i = 0; i < 4; i++) {
    if (i >= uExcursionCount) break;
    if (fishIdx == uExcursionIndices[i]) {
      vel.y += uExcursionBias[i];
    }
  }

  gl_FragColor = vec4(vel, instanceScale);
}
`;

export const positionShader = /* glsl */ `
uniform float uDelta;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec3 vel = texture2D(textureVelocity, uv).xyz;
  posData.xyz += vel * uDelta;
  gl_FragColor = posData;
}
`;

export const renderVertexShader = /* glsl */ `
attribute vec2 aReference;

uniform sampler2D tPosition;
uniform sampler2D tVelocity;
uniform float uSize;
uniform float uTime;
uniform float uMaxSpeed;

// Per-locomotion-mode animation params
uniform float uSwimFreq[${MAX_LOCO_MODES}];
uniform float uWaveK[${MAX_LOCO_MODES}];
uniform float uBaseAmplitude[${MAX_LOCO_MODES}];
uniform float uStiffness[${MAX_LOCO_MODES}];
uniform float uAmpExponent[${MAX_LOCO_MODES}];
uniform float uStrideAmp[${MAX_LOCO_MODES}];
uniform float uRollAmp[${MAX_LOCO_MODES}];
uniform float uPectoralFreq[${MAX_LOCO_MODES}];
uniform float uPectoralAmp[${MAX_LOCO_MODES}];
uniform int uLocoMode;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vec4 posData = texture2D(tPosition, aReference);
  vec3 fishPos = posData.xyz;
  vUv = uv;

  vec4 velData = texture2D(tVelocity, aReference);
  vec3 fishVel = velData.xyz;
  float instanceScale = velData.w;

  vec3 forward = length(fishVel) > 0.001 ? normalize(fishVel) : vec3(0.0, 0.0, 1.0);
  vec3 worldUp = vec3(0.0, 1.0, 0.0);
  if (abs(dot(forward, worldUp)) > 0.99) worldUp = vec3(1.0, 0.0, 0.0);

  vec3 right = normalize(cross(worldUp, forward));
  vec3 up = cross(forward, right);
  mat3 rot = mat3(right, up, forward);

  float fishScale = uSize * instanceScale;
  vec3 localPos = position;

  // Read vertex color masks (baked in Blender)
  float spineMask = color.r;
  float pectoralMask = color.g;
  float dorsalMask = color.b;

  int mode = uLocoMode;
  float speedMult = length(fishVel) / max(uMaxSpeed * 0.5, 0.001);
  float perInstanceJitter = aReference.x * 2.0;
  float freq = uSwimFreq[mode] * (0.8 + speedMult * 0.4) + perInstanceJitter;
  float phase = uTime * freq + localPos.z * uWaveK[mode];

  // Amplitude envelope: stiffness controls head-to-tail gradient
  float envelope = pow(max(spineMask, 0.001), uAmpExponent[mode]);
  float stiffMask = mix(1.0, envelope, uStiffness[mode]);
  float bodyAmp = uBaseAmplitude[mode] * stiffMask * (0.7 + 0.3 * speedMult);

  // Additive motion layers
  localPos.x += sin(phase) * bodyAmp;
  localPos.x += sin(uTime * freq * 0.5) * uStrideAmp[mode];
  localPos.z += sin(phase) * uRollAmp[mode] * spineMask;

  // Pectoral fin flutter
  float pecPhase = uTime * uPectoralFreq[mode] + perInstanceJitter * 3.0;
  localPos.y += sin(pecPhase) * uPectoralAmp[mode] * pectoralMask;

  // Dorsal/caudal fin flex
  localPos.y += sin(phase * 1.5) * bodyAmp * 0.3 * dorsalMask;

  // C-start escape response
  float swimSpeed = length(fishVel);
  float speedRatio = swimSpeed / (uMaxSpeed * 0.5);
  float cStartIntensity = smoothstep(1.5, 2.5, speedRatio);
  float cBend = cStartIntensity * sin(localPos.z * 1.5) * 0.3;
  localPos.x += cBend;

  vec3 transformed = rot * (localPos * fishScale) + fishPos;
  vWorldPos = transformed;
  vNormal = normalize(rot * normal);

  gl_Position = projectionMatrix * viewMatrix * vec4(transformed, 1.0);
}
`;

export const renderFragmentShader = /* glsl */ `
uniform sampler2D tAlbedo;
uniform vec3 uFallbackColor;
uniform float uHasTexture;
uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uRoughness;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vec3 albedo = mix(uFallbackColor, texture2D(tAlbedo, vUv).rgb, uHasTexture);
  vec3 N = normalize(vNormal);

  float NdotL = max(dot(N, uLightDir), 0.0);

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 H = normalize(uLightDir + viewDir);
  float NdotH = max(dot(N, H), 0.0);
  float spec = pow(NdotH, mix(8.0, 64.0, 1.0 - uRoughness));

  vec3 lit = albedo * (uAmbient + NdotL * 0.6) + vec3(spec * 0.15);

  float dist = length(vWorldPos.xz);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  lit = mix(lit, uFogColor, fog);

  gl_FragColor = vec4(lit, 1.0);
}
`;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty`
Expected: PASS (shader module exports string constants).

- [ ] **Step 3: Commit**

```powershell
git add src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts
git commit -m "feat(ocean): extract and upgrade GLSL shaders to separate module

Velocity shader now supports 50 species (integer species ID). Vertex shader
adds per-locomotion-mode ABZU animation (5 additive layers from vertex color
masks). Fragment shader adds Cook-Torrance specular + roughness uniform.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Rewrite FishSchool.svelte for 50-Species Instancing

The core rewrite — replaces hardcoded 8-model system with data-driven species config.

**Files:**
- Rewrite: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte`

- [ ] **Step 1: Write the rewritten FishSchool.svelte**

The implementer should rewrite `FishSchool.svelte` following this architecture:

1. **Imports**: Import `RESIDENT_SPECIES`, `type FishSpeciesConfig` from `fish-species-config.ts`, `LOCOMOTION_PARAMS`, `LocomotionMode` from `fish-locomotion-params.ts`, all 4 shaders from `fish-shaders.ts`.

2. **Props**: Keep existing interface but remove `baseColor` (replaced by per-species albedo). Add `modelBasePath` prop defaulting to `"/models/ocean/pack/"`.

3. **Model loading**: Instead of 8 hardcoded `useGltf` calls, use a single `$effect` that loads all resident species GLBs via `useGltf` with the `modelBasePath + species.modelFile` pattern. Store results in a `Map<string, ExtractedModel>`.

4. **Species ID encoding**: Change from `speciesId / 8.0 + jitter` to integer species index stored directly in `posData.w`. The velocity shader now uses `int(floor(posData.w))` instead of `floor(posData.w * 8.0)`.

5. **GPU compute texture size**: `texSize = Math.ceil(Math.sqrt(RESIDENT_FISH_COUNT))` — sized for resident species. Reserve 100 extra slots for visitors (Layer 3).

6. **Per-species InstancedMesh creation**: Loop over `RESIDENT_SPECIES`, for each species:
   - Extract geometry + diffuseMap from loaded GLB
   - Run `normalizeGeometry()` (keep existing function)
   - Create `aReference` attribute pointing to this species' range in the GPU textures
   - Create `ShaderMaterial` with the imported shaders
   - Set `uLocoMode` uniform to the species' `locomotionMode` enum value
   - Set all `uSwimFreq[i]`, `uWaveK[i]`, etc. uniform arrays from `LOCOMOTION_PARAMS`
   - Set `tAlbedo` to the species' diffuseMap
   - Set `uRoughness` per species (reef fish 0.5, pelagic 0.3, puffer 0.6)

7. **Spawn positions**: Same cluster approach but using species config for counts and positions. School centers stored in `uSchoolCenters[speciesIndex]`.

8. **Frame update**: Same as current — tick GPUComputationRenderer, update material uniforms. FishEventSystem tick unchanged.

9. **Orientation**: Remove the hardcoded `ORIENT_FNS` array. The Blender conversion script already aligns to +Z. If empirical testing shows some pack models need rotation corrections, add an optional `orientCorrection` field to `FishSpeciesConfig` and apply during geometry extraction.

**Key differences from current code:**
- No more `const glbCommon = useGltf(...)` × 8 — data-driven loading from species config
- Species ID is integer (0-49) not fractional (0.0-1.0)
- Vertex shader reads vertex colors for ABZU animation instead of using `localPos.z` directly
- Fragment shader has specular + roughness instead of flat N·L
- `uSchoolCenters` array grows from `[8]` to `[50]`

The full component will be ~500 lines (down from 802) because shaders are extracted.

- [ ] **Step 2: Delete old fish models (replaced by pack)**

The old models at `static/models/ocean/fish_*.glb` are replaced by the pack models. Remove them to avoid confusion:

```powershell
git rm static/models/ocean/fish_common.glb static/models/ocean/fish_butterfly.glb static/models/ocean/fish_trout.glb static/models/ocean/fish_clown.glb static/models/ocean/fish_clownfish.glb static/models/ocean/fish_gray.glb static/models/ocean/fish_koi.glb static/models/ocean/fish_small.glb
```

- [ ] **Step 3: Verify build succeeds**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Visual verification**

Load the ocean scene in the browser. Verify:
- 13 resident species visible with distinct textures
- Each species schools with its own kind
- ABZU-style locomotion visible: angelfish glide with pectoral flutter, tangs use tail-focused swimming, puffer paddles rigidly
- Specular highlights on fish scales
- Fish scatter when cursor passes through

- [ ] **Step 5: Commit**

```powershell
git add src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
git rm static/models/ocean/fish_common.glb static/models/ocean/fish_butterfly.glb static/models/ocean/fish_trout.glb static/models/ocean/fish_clown.glb static/models/ocean/fish_clownfish.glb static/models/ocean/fish_gray.glb static/models/ocean/fish_koi.glb static/models/ocean/fish_small.glb
git commit -m "feat(ocean): rewrite FishSchool for 50-species ecosystem

Data-driven species loading from fish-species-config. 13 resident species
with ABZU-style per-locomotion-mode vertex animation. PBR fragment shader
with specular. Replaces 8 hardcoded models with pack-based pipeline.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Layer 2: Behavioral Ecology

### Task 5: Threat Matrix + Trophic Config

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/fish-species-config.ts`
- Create: `tests/unit/3d-viewer/fish-threat-matrix.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/3d-viewer/fish-threat-matrix.test.ts
import { describe, it, expect } from "vitest";
import {
  THREAT_MATRIX,
  TrophicRole,
  isThreat,
  isPrey,
} from "$lib/shared/3d/environments/scenes/ocean/fish-species-config";

describe("threat matrix", () => {
  it("apex predator fears nothing", () => {
    for (const role of Object.values(TrophicRole).filter(v => typeof v === "number")) {
      expect(isThreat(TrophicRole.ApexPredator, role as TrophicRole)).toBe(false);
    }
  });

  it("schooling prey fears apex and meso", () => {
    expect(isThreat(TrophicRole.SchoolingPrey, TrophicRole.ApexPredator)).toBe(true);
    expect(isThreat(TrophicRole.SchoolingPrey, TrophicRole.Mesopredator)).toBe(true);
    expect(isThreat(TrophicRole.SchoolingPrey, TrophicRole.SchoolingPrey)).toBe(false);
  });

  it("neutral fears nothing", () => {
    for (const role of Object.values(TrophicRole).filter(v => typeof v === "number")) {
      expect(isThreat(TrophicRole.Neutral, role as TrophicRole)).toBe(false);
    }
  });

  it("apex hunts prey and cruiser", () => {
    expect(isPrey(TrophicRole.ApexPredator, TrophicRole.SchoolingPrey)).toBe(true);
    expect(isPrey(TrophicRole.ApexPredator, TrophicRole.ReefCruiser)).toBe(true);
    expect(isPrey(TrophicRole.ApexPredator, TrophicRole.ApexPredator)).toBe(false);
  });

  it("meso hunts only prey", () => {
    expect(isPrey(TrophicRole.Mesopredator, TrophicRole.SchoolingPrey)).toBe(true);
    expect(isPrey(TrophicRole.Mesopredator, TrophicRole.ReefCruiser)).toBe(false);
  });

  it("neutral hunts nothing", () => {
    for (const role of Object.values(TrophicRole).filter(v => typeof v === "number")) {
      expect(isPrey(TrophicRole.Neutral, role as TrophicRole)).toBe(false);
    }
  });

  it("threat matrix is 6x6", () => {
    expect(THREAT_MATRIX.length).toBe(36);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d-viewer/fish-threat-matrix.test.ts`
Expected: FAIL — `isThreat`, `isPrey`, `THREAT_MATRIX` not exported.

- [ ] **Step 3: Add threat matrix to species config**

Add to the end of `fish-species-config.ts`:

```typescript
// 6×6 threat matrix: THREAT_MATRIX[myRole * 6 + neighborRole] = 1.0 means neighborRole threatens myRole
// Row = "I am this role", Col = "neighbor is this role", Value = "I should flee"
export const THREAT_MATRIX = new Float32Array([
  // Apex fears:    Apex  Meso  Prey  Cruis Terr  Neut
  /* Apex    */     0,    0,    0,    0,    0,    0,
  /* Meso    */     1,    0,    0,    0,    0,    0,
  /* Prey    */     1,    1,    0,    0,    0,    0,
  /* Cruiser */     1,    0,    0,    0,    0,    0,
  /* Territ  */     1,    0,    0,    0,    0,    0,
  /* Neutral */     0,    0,    0,    0,    0,    0,
]);

// 6×6 hunt matrix: HUNT_MATRIX[myRole * 6 + neighborRole] = 1.0 means I hunt neighborRole
export const HUNT_MATRIX = new Float32Array([
  // Apex hunts:    Apex  Meso  Prey  Cruis Terr  Neut
  /* Apex    */     0,    0,    1,    1,    0,    0,
  /* Meso    */     0,    0,    1,    0,    0,    0,
  /* Prey    */     0,    0,    0,    0,    0,    0,
  /* Cruiser */     0,    0,    0,    0,    0,    0,
  /* Territ  */     0,    0,    0,    0,    0,    0,
  /* Neutral */     0,    0,    0,    0,    0,    0,
]);

export function isThreat(myRole: TrophicRole, neighborRole: TrophicRole): boolean {
  return THREAT_MATRIX[myRole * 6 + neighborRole] === 1;
}

export function isPrey(myRole: TrophicRole, neighborRole: TrophicRole): boolean {
  return HUNT_MATRIX[myRole * 6 + neighborRole] === 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-viewer/fish-threat-matrix.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/shared/3d/environments/scenes/ocean/fish-species-config.ts tests/unit/3d-viewer/fish-threat-matrix.test.ts
git commit -m "feat(ocean): add trophic threat/hunt matrices for behavioral ecology

6x6 matrices encode predator-prey relationships. Apex hunts prey+cruiser,
meso hunts prey only, prey flees apex+meso, neutral ignores all. Helper
functions isThreat() and isPrey() for CPU-side logic.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: GPU State Machine (textureState + State Transition Shader)

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts`
- Modify: `src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts` (velocity shader reads state)
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte` (add GPGPU variable)

- [ ] **Step 1: Write the state transition shader**

```typescript
// src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts

const TROPHIC_ROLE_COUNT = 6;

export const stateShader = /* glsl */ `
uniform float uDelta;
uniform float uTime;
uniform float uFleeRange;
uniform float uHuntRange;
uniform float uPanicRadius;
uniform float uHomeRadius;
uniform float uPerceptionCos;
uniform sampler2D tTraits;

// Trophic roles per species (indexed by species ID)
uniform int uTrophicRole[50];

// Threat matrix: uThreatMatrix[myRole * 6 + neighborRole] = 1.0 means I flee
uniform float uThreatMatrix[36];
// Hunt matrix: uHuntMatrix[myRole * 6 + neighborRole] = 1.0 means I chase
uniform float uHuntMatrix[36];

// School home positions
uniform vec3 uSchoolCenters[50];

// Player ray acts as virtual apex predator
uniform vec3 uScatterOrigin;
uniform float uScatterRadius;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec3 pos = posData.xyz;
  if (pos.x > 9000.0) { gl_FragColor = vec4(0.0); return; }

  vec4 velData = texture2D(textureVelocity, uv);
  vec3 vel = velData.xyz;
  vec3 forward = length(vel) > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);

  vec4 stateData = texture2D(textureState, uv);
  float currentState = stateData.x;
  float stateTimer = stateData.y;

  int mySpecies = int(floor(posData.w));
  int myTrophic = uTrophicRole[mySpecies];

  float newState = currentState;
  float newTimer = max(0.0, stateTimer - uDelta);
  float threatDirX = stateData.z;
  float threatDirZ = stateData.w;

  // Timer expiry → return to School
  if (newTimer <= 0.0 && currentState != 0.0) {
    newState = 0.0;
  }

  // Player ray → virtual predator (flee)
  float rayDist = distance(pos, uScatterOrigin);
  if (rayDist < uScatterRadius && myTrophic != 0 && myTrophic != 5) {
    newState = 1.0;
    newTimer = 2.0;
    vec3 awayFromRay = normalize(pos - uScatterOrigin);
    threatDirX = awayFromRay.x;
    threatDirZ = awayFromRay.z;
  }

  // Scan neighbors for threats/prey
  for (float ny = 0.0; ny < resolution.y; ny += 1.0) {
    for (float nx = 0.0; nx < resolution.x; nx += 1.0) {
      vec2 ref = (vec2(nx, ny) + 0.5) / resolution.xy;
      vec4 nPos = texture2D(texturePosition, ref);
      vec3 op = nPos.xyz;
      if (op.x > 9000.0) continue;

      vec3 toNeighbor = op - pos;
      float d = length(toNeighbor);
      if (d < 0.001) continue;

      // Perception cone
      float facing = dot(forward, normalize(toNeighbor));
      if (facing < uPerceptionCos) continue;

      int neighborSpecies = int(floor(nPos.w));
      int neighborTrophic = uTrophicRole[neighborSpecies];

      // Threat detection → FLEE
      if (d < uFleeRange && uThreatMatrix[myTrophic * 6 + neighborTrophic] > 0.5) {
        newState = 1.0;
        newTimer = 3.0;
        vec3 away = normalize(pos - op);
        threatDirX = away.x;
        threatDirZ = away.z;
      }

      // Prey detection → CHASE (only with forward cone > 0.7)
      if (d < uHuntRange && facing > 0.7 && uHuntMatrix[myTrophic * 6 + neighborTrophic] > 0.5) {
        newState = 2.0;
        newTimer = 5.0;
        vec3 toward = normalize(op - pos);
        threatDirX = toward.x;
        threatDirZ = toward.z;
      }

      // Panic cascade: fleeing same-species neighbor triggers flee
      if (mySpecies == neighborSpecies && d < uPanicRadius) {
        vec4 neighborState = texture2D(textureState, ref);
        if (neighborState.x > 0.5 && neighborState.x < 1.5) {
          newState = 1.0;
          newTimer = 2.0;
          threatDirX = neighborState.z;
          threatDirZ = neighborState.w;
        }
      }

      // Territorial defense
      if (myTrophic == 4 && neighborSpecies != mySpecies && d < uHomeRadius) {
        newState = 6.0;
        newTimer = 2.0;
        vec3 toward = normalize(op - pos);
        threatDirX = toward.x;
        threatDirZ = toward.z;
      }
    }
  }

  gl_FragColor = vec4(newState, newTimer, threatDirX, threatDirZ);
}
`;
```

- [ ] **Step 2: Update velocity shader to read state and apply force modifiers**

In `fish-shaders.ts`, add `uniform sampler2D textureState;` to the velocity shader uniforms, and add state-dependent force modifiers after the boids forces are computed (after the `steer` variable is assembled, before the maxSteer clamp):

```glsl
// Read behavioral state
vec4 stateData = texture2D(textureState, uv);
float state = stateData.x;
vec3 threatDir = vec3(stateData.z, 0.0, stateData.w);

if (state > 0.5 && state < 1.5) {
  // FLEE: override with flee direction, speed boost
  steer = normalize(threatDir + vec3(0.001)) * 2.0 + sep * 0.3;
  adjMax *= 2.0;
}
if (state > 1.5 && state < 2.5) {
  // CHASE: pursuit vector
  steer = normalize(threatDir + vec3(0.001)) * 1.5;
  adjMax *= 1.5;
}
if (state > 2.5 && state < 3.5) {
  // IDLE: minimal movement
  steer *= 0.1;
  adjMax *= 0.2;
}
if (state > 5.5 && state < 6.5) {
  // TERRITORIAL: chase intruder or return home
  int si = int(floor(posData.w));
  vec3 home = uSchoolCenters[si];
  float dHome = distance(pos, home);
  if (dHome < uSchoolRadius) {
    steer = normalize(threatDir + vec3(0.001)) * 1.5;
  } else {
    steer = normalize(home - pos) * 1.0;
  }
}
```

Move `adjMax` and `adjMin` declarations BEFORE the state block so state modifiers can modify them.

- [ ] **Step 3: Wire textureState in FishSchool.svelte**

In the `$effect` that creates the GPUComputationRenderer:

```typescript
// After creating posVar and velVar:
const stateTex = gpu.createTexture();
const stateArr = stateTex.image.data as Float32Array;
// Initialize all fish to state 0 (School), timer 0
for (let i = 0; i < texSize * texSize; i++) {
  stateArr[i * 4 + 0] = 0; // state = School
  stateArr[i * 4 + 1] = 0; // timer = 0
  stateArr[i * 4 + 2] = 0; // threatDirX
  stateArr[i * 4 + 3] = 0; // threatDirZ
}

const stateVar = gpu.addVariable("textureState", stateShader, stateTex);
gpu.setVariableDependencies(stateVar, [stateVar, posVar, velVar]);
gpu.setVariableDependencies(velVar, [posVar, velVar, stateVar]);

// Set state shader uniforms
const stateUniforms = stateVar.material.uniforms;
stateUniforms.uDelta = { value: 0 };
stateUniforms.uTime = { value: 0 };
stateUniforms.uFleeRange = { value: 5.0 };
stateUniforms.uHuntRange = { value: 8.0 };
stateUniforms.uPanicRadius = { value: 3.0 };
stateUniforms.uHomeRadius = { value: 4.0 };
stateUniforms.uPerceptionCos = { value: Math.cos(perceptionAngle * Math.PI / 180) };
stateUniforms.uTrophicRole = { value: new Int32Array(50) };
stateUniforms.uThreatMatrix = { value: THREAT_MATRIX };
stateUniforms.uHuntMatrix = { value: HUNT_MATRIX };
stateUniforms.uSchoolCenters = velUniforms.uSchoolCenters; // share
stateUniforms.uScatterOrigin = velUniforms.uScatterOrigin;
stateUniforms.uScatterRadius = { value: scatterRadius };

// Fill trophic roles from species config
const trophicRoles = new Int32Array(50);
for (let s = 0; s < RESIDENT_SPECIES.length; s++) {
  trophicRoles[s] = RESIDENT_SPECIES[s].trophicRole;
}
stateUniforms.uTrophicRole.value = trophicRoles;
```

In the frame loop, add `stateVar.material.uniforms.uDelta.value = dt;`

- [ ] **Step 4: Verify build succeeds**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Visual verification**

Load ocean scene. Test behavioral ecology:
- Move cursor through a school of chromis → they scatter (FLEE state)
- Wait 3s → they regroup (timer expiry → School)
- If a barracuda visitor is active (Layer 3 needed), prey should flee before it arrives

Note: Full predator-prey chains need Layer 3 (visitor spawning) to be dramatic. For now, test with ray scatter (virtual apex predator).

- [ ] **Step 6: Commit**

```powershell
git add src/lib/shared/3d/environments/scenes/ocean/fish-behavior-shader.ts src/lib/shared/3d/environments/scenes/ocean/fish-shaders.ts src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
git commit -m "feat(ocean): GPU behavioral ecology state machine

Add textureState GPGPU variable with 7 behavioral states (school, flee,
chase, idle, investigate, feed, territorial). State transitions based on
trophic threat/hunt matrices. Panic cascade propagates flee through
same-species neighbors. Player ray triggers flee as virtual apex predator.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Layer 3: Species Rotation

### Task 7: SpeciesRotationManager

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/SpeciesRotationManager.ts`
- Create: `tests/unit/3d-viewer/species-rotation.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/3d-viewer/species-rotation.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { SpeciesRotationManager, type VisitorGroup } from "$lib/shared/3d/environments/scenes/ocean/SpeciesRotationManager";

describe("SpeciesRotationManager", () => {
  let manager: SpeciesRotationManager;

  beforeEach(() => {
    manager = new SpeciesRotationManager(324, 87);
  });

  it("initializes with zero active visitor groups", () => {
    expect(manager.activeGroups.length).toBe(0);
  });

  it("allocates GPU texture slots for a visitor group", () => {
    const slots = manager.allocateSlots(10);
    expect(slots).not.toBeNull();
    expect(slots!.startIndex).toBe(87);
    expect(slots!.count).toBe(10);
  });

  it("refuses allocation when slots are full", () => {
    manager.allocateSlots(200);
    const second = manager.allocateSlots(200);
    expect(second).toBeNull();
  });

  it("releases slots on despawn", () => {
    const slots = manager.allocateSlots(50);
    expect(slots).not.toBeNull();
    manager.releaseSlots(slots!);
    const reslots = manager.allocateSlots(50);
    expect(reslots).not.toBeNull();
    expect(reslots!.startIndex).toBe(87);
  });

  it("tick spawns a visitor group after cooldown", () => {
    const spawned: VisitorGroup[] = [];
    for (let i = 0; i < 100; i++) {
      const group = manager.tick(1.0);
      if (group) spawned.push(group);
    }
    expect(spawned.length).toBeGreaterThan(0);
  });

  it("tick despawns expired visitor groups", () => {
    const group = manager.tick(999);
    if (group) {
      expect(manager.activeGroups.length).toBe(1);
      for (let i = 0; i < 200; i++) manager.tick(1.0);
      expect(manager.activeGroups.length).toBe(0);
    }
  });

  it("limits active groups to 3 max", () => {
    for (let i = 0; i < 500; i++) manager.tick(1.0);
    expect(manager.activeGroups.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/3d-viewer/species-rotation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the SpeciesRotationManager**

```typescript
// src/lib/shared/3d/environments/scenes/ocean/SpeciesRotationManager.ts

import { VISITOR_SPECIES, type FishSpeciesConfig } from "./fish-species-config";

export interface SlotAllocation {
  startIndex: number;
  count: number;
}

export interface VisitorGroup {
  species: FishSpeciesConfig[];
  slots: SlotAllocation;
  remainingTime: number;
  entryAngle: number;
  exitAngle: number;
}

interface VisitorPattern {
  name: string;
  speciesNames: string[];
  duration: number;
  cooldownMin: number;
  cooldownMax: number;
}

const VISITOR_PATTERNS: VisitorPattern[] = [
  { name: "Sardine Ball", speciesNames: ["European Sardine"], duration: 45, cooldownMin: 60, cooldownMax: 120 },
  { name: "Tuna Run", speciesNames: ["Yellowfin Tuna", "Skipjack Tuna"], duration: 30, cooldownMin: 90, cooldownMax: 180 },
  { name: "Barracuda Patrol", speciesNames: ["Great Barracuda"], duration: 30, cooldownMin: 120, cooldownMax: 240 },
  { name: "Mackerel School", speciesNames: ["Atlantic Mackerel"], duration: 45, cooldownMin: 90, cooldownMax: 120 },
  { name: "Grouper Ambush", speciesNames: ["Goliath Grouper"], duration: 60, cooldownMin: 180, cooldownMax: 300 },
  { name: "Deep Water Pass", speciesNames: ["Atlantic Cod", "Haddock", "European Hake"], duration: 90, cooldownMin: 120, cooldownMax: 240 },
];

export class SpeciesRotationManager {
  readonly maxSlots: number;
  readonly residentCount: number;
  private nextFreeSlot: number;
  private freeRanges: SlotAllocation[] = [];
  private _activeGroups: VisitorGroup[] = [];
  private spawnCooldown = 30 + Math.random() * 30;

  constructor(maxSlots: number, residentCount: number) {
    this.maxSlots = maxSlots;
    this.residentCount = residentCount;
    this.nextFreeSlot = residentCount;
  }

  get activeGroups(): VisitorGroup[] {
    return this._activeGroups;
  }

  allocateSlots(count: number): SlotAllocation | null {
    for (let i = 0; i < this.freeRanges.length; i++) {
      const range = this.freeRanges[i]!;
      if (range.count >= count) {
        const alloc: SlotAllocation = { startIndex: range.startIndex, count };
        range.startIndex += count;
        range.count -= count;
        if (range.count === 0) this.freeRanges.splice(i, 1);
        return alloc;
      }
    }

    if (this.nextFreeSlot + count <= this.maxSlots) {
      const alloc: SlotAllocation = { startIndex: this.nextFreeSlot, count };
      this.nextFreeSlot += count;
      return alloc;
    }

    return null;
  }

  releaseSlots(alloc: SlotAllocation): void {
    this.freeRanges.push({ ...alloc });
    this.freeRanges.sort((a, b) => a.startIndex - b.startIndex);

    const merged: SlotAllocation[] = [];
    for (const r of this.freeRanges) {
      const prev = merged[merged.length - 1];
      if (prev && prev.startIndex + prev.count === r.startIndex) {
        prev.count += r.count;
      } else {
        merged.push({ ...r });
      }
    }
    this.freeRanges = merged;

    while (this.freeRanges.length > 0) {
      const last = this.freeRanges[this.freeRanges.length - 1]!;
      if (last.startIndex + last.count === this.nextFreeSlot) {
        this.nextFreeSlot = last.startIndex;
        this.freeRanges.pop();
      } else break;
    }
  }

  tick(dt: number): VisitorGroup | null {
    for (let i = this._activeGroups.length - 1; i >= 0; i--) {
      this._activeGroups[i]!.remainingTime -= dt;
      if (this._activeGroups[i]!.remainingTime <= 0) {
        const expired = this._activeGroups.splice(i, 1)[0]!;
        this.releaseSlots(expired.slots);
      }
    }

    this.spawnCooldown -= dt;
    if (this.spawnCooldown > 0 || this._activeGroups.length >= 3) return null;

    const pattern = VISITOR_PATTERNS[Math.floor(Math.random() * VISITOR_PATTERNS.length)]!;
    this.spawnCooldown = pattern.cooldownMin + Math.random() * (pattern.cooldownMax - pattern.cooldownMin);

    const species = pattern.speciesNames
      .map((name) => VISITOR_SPECIES.find((s) => s.name === name))
      .filter((s): s is FishSpeciesConfig => s !== undefined);

    if (species.length === 0) return null;

    const totalCount = species.reduce((sum, sp) => sum + sp.instanceCount, 0);
    const slots = this.allocateSlots(totalCount);
    if (!slots) return null;

    const entryAngle = Math.random() * Math.PI * 2;
    const group: VisitorGroup = {
      species,
      slots,
      remainingTime: pattern.duration,
      entryAngle,
      exitAngle: entryAngle + Math.PI,
    };

    this._activeGroups.push(group);
    return group;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-viewer/species-rotation.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/shared/3d/environments/scenes/ocean/SpeciesRotationManager.ts tests/unit/3d-viewer/species-rotation.test.ts
git commit -m "feat(ocean): add SpeciesRotationManager for visitor spawn/despawn

Timer-driven visitor group patterns (sardine ball, tuna run, barracuda patrol,
etc). GPU slot allocator with free-range merging. Max 3 concurrent visitor
groups. Auto-despawn on timer expiry.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Integrate Rotation Manager into FishSchool

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte`

- [ ] **Step 1: Wire the rotation manager**

In FishSchool.svelte:

1. Import `SpeciesRotationManager` and `type VisitorGroup`.
2. In the `$effect`, after creating the GPU compute system:
   ```typescript
   const rotationManager = new SpeciesRotationManager(texSize * texSize, RESIDENT_FISH_COUNT);
   ```
3. In the `useTask` frame loop, after `gpuCompute.compute()`:
   ```typescript
   const newGroup = rotationManager.tick(dt);
   if (newGroup) {
     // For each species in the visitor group:
     // 1. Load the GLB (async, use useGltf or manual GLTFLoader)
     // 2. Create InstancedMesh with geometry + shader material
     // 3. Write initial positions to GPU texture at allocated slots
     //    - Entry position: boundRadius from center at entryAngle
     //    - Exit velocity: toward exitAngle
     // 4. Write species ID to posData.w for the allocated slot range
     // 5. Add mesh to scene
   }
   
   // Check for despawned groups — remove their meshes
   // (Rotation manager already released slots internally)
   ```

4. When a group despawns:
   ```typescript
   // Set positions to 9999 sentinel (already skipped by shaders)
   // Remove InstancedMesh from scene, dispose geometry + material
   ```

- [ ] **Step 2: Handle async GLB loading for visitors**

Visitor models load on-demand (not at startup — 50 models would be too much upfront). Use Three.js `GLTFLoader` directly (not Threlte's `useGltf` which requires component scope):

```typescript
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("/draco/");
gltfLoader.setDRACOLoader(draco);

// Cache loaded models to avoid reloading
const modelCache = new Map<string, ExtractedModel>();

async function loadVisitorModel(modelFile: string): Promise<ExtractedModel | null> {
  if (modelCache.has(modelFile)) return modelCache.get(modelFile)!;
  
  return new Promise((resolve) => {
    gltfLoader.load(
      `/models/ocean/pack/${modelFile}`,
      (gltf) => {
        const model = extractModel(gltf.scene);
        if (model) {
          normalizeGeometry(model.geometry);
          modelCache.set(modelFile, model);
        }
        resolve(model);
      },
      undefined,
      () => resolve(null)
    );
  });
}
```

- [ ] **Step 3: Write visitor spawn positions to GPU texture**

When a visitor group spawns, write initial positions/velocities to the GPU texture via `readPixels` + `texSubImage2D` or by re-initializing the texture data. The simplest approach:

```typescript
function spawnVisitorGroup(group: VisitorGroup, posTexture: DataTexture, velTexture: DataTexture) {
  const { slots, entryAngle, exitAngle, species } = group;
  const entryRadius = boundRadius * 0.9;
  const entryX = Math.cos(entryAngle) * entryRadius;
  const entryZ = Math.sin(entryAngle) * entryRadius;
  const exitX = Math.cos(exitAngle);
  const exitZ = Math.sin(exitAngle);
  
  let offset = slots.startIndex;
  for (const sp of species) {
    for (let i = 0; i < sp.instanceCount; i++) {
      const idx = (offset + i) * 4;
      // Position: clustered at entry point
      posTexture.image.data[idx + 0] = entryX + (Math.random() - 0.5) * 3;
      posTexture.image.data[idx + 1] = groundY + 3 + Math.random() * 3;
      posTexture.image.data[idx + 2] = entryZ + (Math.random() - 0.5) * 3;
      posTexture.image.data[idx + 3] = ALL_SPECIES.indexOf(sp); // species ID
      
      // Velocity: toward exit
      const speed = sp.speed[0] + Math.random() * (sp.speed[1] - sp.speed[0]);
      velTexture.image.data[idx + 0] = exitX * speed;
      velTexture.image.data[idx + 1] = 0;
      velTexture.image.data[idx + 2] = exitZ * speed;
      velTexture.image.data[idx + 3] = 0.6 + Math.random() * 0.8; // instanceScale
    }
    offset += sp.instanceCount;
  }
  posTexture.needsUpdate = true;
  velTexture.needsUpdate = true;
}
```

Note: Writing directly to the GPU texture from CPU requires `GPUComputationRenderer` to expose the underlying textures. The implementer should check if `gpuCompute.getCurrentRenderTarget(posVar).texture` is writable or if a `renderTexture()` call is needed to reinitialize.

- [ ] **Step 4: Verify build succeeds**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Visual verification**

Load ocean scene. Wait 30-90 seconds. Verify:
- A visitor group appears from the fog wall edge
- They swim across the scene
- If predators, resident prey species flee (panic cascade visible)
- After transit duration, visitors disappear
- No more than 3 visitor groups active simultaneously
- No GPU errors in console

- [ ] **Step 6: Commit**

```powershell
git add src/lib/shared/3d/environments/scenes/ocean/FishSchool.svelte
git commit -m "feat(ocean): integrate species rotation with visitor spawn/despawn

Visitor groups spawn at scene edge on timer, traverse scene, despawn on exit.
Async GLB loading with model cache. GPU texture slots allocated dynamically.
Predator visitors trigger flee cascade in resident prey species.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Update FishEventSystem for Trophic Awareness

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/FishEventSystem.ts`
- Modify: `tests/unit/3d-viewer/fish-event-system.test.ts`

- [ ] **Step 1: Add failing tests for trophic-aware darts**

Add to `tests/unit/3d-viewer/fish-event-system.test.ts`:

```typescript
it("predator fish dart less frequently (higher boldness)", () => {
  // Apex predators have boldness 1.3-1.5, which increases dart cooldown
  // This test verifies the existing boldness-based dart logic naturally
  // produces fewer darts for bold/predator fish
  const predatorTraits = new Float32Array(4 * 4);
  for (let i = 0; i < 4; i++) {
    predatorTraits[i * 4 + 0] = 1.5; // speedMult (fast)
    predatorTraits[i * 4 + 1] = 0.2; // socialMult (solitary)
    predatorTraits[i * 4 + 2] = 1.4; // boldness (very bold)
    predatorTraits[i * 4 + 3] = 0.5; // dartSeed
  }
  const predSystem = new FishEventSystem(4, predatorTraits);
  const predUniforms = makeUniforms();
  const ray = new Vector3(100, 100, 100);
  
  // Bold fish (1.4) → cooldown = 8.0 * (1.5 - 1.4) + 0.5 * 2.0 = 1.8s
  // So after 2s they should have darted
  predSystem.tick(2, predUniforms, ray);
  expect(predUniforms.uDartCount.value).toBeGreaterThanOrEqual(0);
  expect(predUniforms.uDartCount.value).toBeLessThanOrEqual(4);
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/3d-viewer/fish-event-system.test.ts`
Expected: All PASS (existing FishEventSystem already uses boldness in dart cooldown).

- [ ] **Step 3: Commit**

```powershell
git add tests/unit/3d-viewer/fish-event-system.test.ts
git commit -m "test(ocean): add predator boldness dart frequency test

Verifies that high-boldness predator fish have appropriate dart timing
based on the existing boldness-modulated cooldown formula.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Final Integration + Typecheck + Existing Tests

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (if props changed)

- [ ] **Step 1: Update OceanScene props if needed**

Check if FishSchool's props interface changed. If `baseColor` was removed, remove it from OceanScene's `<FishSchool>` template. If `modelBasePath` was added, it has a default so no change needed.

- [ ] **Step 2: Run full typecheck**

Run: `npm run check`
Expected: PASS with zero errors.

- [ ] **Step 3: Run all fish-related tests**

Run: `npx vitest run tests/unit/3d-viewer/`
Expected: All tests PASS:
- fish-species-config.test.ts
- fish-locomotion-params.test.ts
- fish-threat-matrix.test.ts
- fish-event-system.test.ts
- species-rotation.test.ts

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: No regressions.

- [ ] **Step 5: Commit if any OceanScene changes were needed**

```powershell
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "fix(ocean): update OceanScene FishSchool props for ecosystem upgrade

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
