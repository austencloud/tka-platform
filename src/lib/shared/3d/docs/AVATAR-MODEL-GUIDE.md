# Avatar Model Guide

This document explains how to obtain or create a rigged humanoid model for the TKA 3D Viewer.

## Requirements

The avatar system needs a GLTF/GLB model with:

1. **Armature (Skeleton)** with bones following standard naming conventions
2. **Skinned meshes** bound to the skeleton
3. **T-pose or A-pose** as the rest pose
4. **Reasonable poly count** (5k-20k triangles for performance)

## Bone Naming Conventions

The `AvatarSkeletonService` recognizes these bone names (case-insensitive, with aliases):

```
Root: Hips / pelvis / hip / root
Spine: Spine / spine / spine1
  Spine1: Spine1 / spine2 / chest
    Spine2: Spine2 / spine3 / upper_chest
      Neck: Neck / neck
        Head: Head / head
      LeftShoulder: LeftShoulder / l_shoulder / shoulder.L / clavicle_l
        LeftArm: LeftArm / l_arm / arm.L / upperarm_l
          LeftForeArm: LeftForeArm / l_forearm / forearm.L / lowerarm_l
            LeftHand: LeftHand / l_hand / hand.L / hand_l
      RightShoulder: (same pattern)
        RightArm:
          RightForeArm:
            RightHand:
Legs:
  LeftUpLeg: LeftUpLeg / l_thigh / thigh.L / upperleg_l
    LeftLeg: LeftLeg / l_shin / shin.L / lowerleg_l
      LeftFoot: LeftFoot / l_foot / foot.L / foot_l
  RightUpLeg: (same pattern)
```

## Option 1: Mixamo (Recommended for Quick Start)

1. Go to [mixamo.com](https://www.mixamo.com) (free with Adobe account)
2. Upload any character or use their free characters
3. Download as **FBX for Unity** (binary FBX)
4. Convert to GLTF using Blender:
   - Import FBX into Blender
   - Export as GLTF 2.0 (GLB format recommended)
   - Include: Mesh, Armature, Skinning
   - Exclude: Animations (we use IK, not keyframes)

Mixamo uses standard bone naming that our service automatically recognizes.

## Option 2: ReadyPlayerMe

1. Go to [readyplayer.me](https://readyplayer.me)
2. Create a free avatar
3. Export as GLTF/GLB
4. Uses standard bone naming

Note: RPM avatars have more detail (clothes, hair) - may need optimization.

## Option 3: Create in Blender (Full Control)

### Step 1: Model the Mesh

- Create a simple humanoid mesh (low-poly is fine)
- Use mirror modifier for symmetry
- Apply modifiers before rigging

### Step 2: Create Armature

```python
# Blender Python script to create humanoid armature
import bpy

bpy.ops.object.armature_add()
armature = bpy.context.object
armature.name = "Armature"

# Enter edit mode
bpy.ops.object.mode_set(mode='EDIT')

# Create bones...
# (See create_humanoid_armature.py script)
```

### Step 3: Skin the Mesh

1. Select mesh, then armature
2. Ctrl+P → Armature Deform with Automatic Weights
3. Fine-tune weights in Weight Paint mode

### Step 4: Export as GLTF

1. File → Export → GLTF 2.0 (.glb/.gltf)
2. Settings:
   - Format: GLB (binary)
   - Include: Selected Objects
   - Transform: +Y Up
   - Data: Mesh, Skinning
   - Exclude: Animations, Materials (optional)

## Option 4: Use Our Procedural Fallback

The current implementation uses `IKFigure3D.svelte` which procedurally
generates a simple humanoid using Three.js primitives. This works without
any external model file.

To switch from procedural to GLTF:

```svelte
<Avatar3D {bluePropState} {redPropState} modelUrl="/models/avatar.glb" />
```

## File Location

Place GLTF models in: `static/models/`

Example: `static/models/tka-avatar.glb`

Access URL: `/models/tka-avatar.glb`

## Testing the Model

1. Load the 3D Viewer module
2. Check browser console for skeleton loading messages
3. Verify arm IK is working by loading a sequence
4. Check that hands reach prop positions

## Troubleshooting

### "No bones found"

- Check bone naming matches aliases
- Verify armature is exported with mesh

### "IK not working"

- Ensure left/right arm chains are detected
- Check bone hierarchy (arm → forearm → hand)

### "Avatar too big/small"

- Use `skeletonService.setHeight(1.9)` to scale
- 1.9 meters = ~190cm (our scale: 1 unit = 1 meter)

### "Arms not reaching targets"

- Verify hand point radius (0.5 meters = 50cm)
- Check IK solver convergence threshold

## Future Enhancements

1. **Finger IK** - Grip animation for holding props
2. **Facial expressions** - For performance personality
3. **Clothing system** - Swappable outfits
4. **Performance capture** - MediaPipe → IK targets
