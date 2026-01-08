# Museum Navigator - Archived

**Status:** Deprecated - Features merged into Gallery module

## Reason for Archive

The Museum Navigator module was an experimental single-room physics-based museum experience. Its best features have been successfully merged into the Gallery module:

### Features Merged into Gallery

1. **Rapier Physics Engine**
   - Character controller with auto-step and slope handling
   - Realistic physics-based movement
   - Now available as physics mode option in Gallery settings

2. **WebGPU Rendering**
   - WebGPU → WebGL fallback renderer
   - Now available as rendering backend option in Gallery settings

3. **Physics Utilities**
   - Extracted to `src/lib/shared/3d-core/physics/`
   - Reusable across all 3D destinations

## Gallery Advantages

The Gallery module provides:
- **Multiplayer support** (up to 25 players)
- **Procedural layout generation** (mansion with multiple rooms)
- **100+ exhibit capacity** (vs single-room limitation)
- **Chat and minimap** (social features)
- **Both physics modes** (raycasting + Rapier)
- **Settings panel** (user can choose physics/rendering)

## Removal Plan

This module can be safely deleted after verifying:
1. ✅ Gallery's Rapier physics mode works correctly
2. ✅ Gallery's WebGPU rendering option works correctly
3. ✅ Shared physics utilities are functioning in Gallery

**To delete:** Remove the entire `museum-navigator/` directory

---

*Archived: January 2026*
*Merged into: Gallery module*
