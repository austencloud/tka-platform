/**
 * Migration script: rewrite $lib/shared/3d/* imports → @austencloud/scene-3d or @austencloud/environments-3d
 */
import fs from 'fs';
import path from 'path';

function walk(dir, exts) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.svelte-kit', 'dist', '.git'].includes(entry.name)) continue;
      results = results.concat(walk(full, exts));
    } else if (exts.some(e => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

// Named-import path rewrites: just swap the module specifier
const SCENE_3D = '@austencloud/scene-3d';
const ENV_3D = '@austencloud/environments-3d';

const PATH_MAP = new Map([
  // Domain enums
  ['$lib/shared/3d/domain/enums/Plane', SCENE_3D],
  ['$lib/shared/3d/domain/enums/PlaneMode', SCENE_3D],
  ['$lib/shared/3d/domain/enums/RotationDirection', SCENE_3D],
  // Domain models
  ['$lib/shared/3d/domain/models/PropState3D', SCENE_3D],
  ['$lib/shared/3d/domain/models/GripPose', SCENE_3D],
  // Domain constants
  ['$lib/shared/3d/domain/constants/grid-layout', SCENE_3D],
  ['$lib/shared/3d/domain/constants/plane-mode-configs', SCENE_3D],
  // Domain utils
  ['$lib/shared/3d/domain/utils/plane-mode-utils', SCENE_3D],
  ['$lib/shared/3d/domain/formation', SCENE_3D],
  ['$lib/shared/3d/domain/camera-choreography', SCENE_3D],
  // Domain types
  ['$lib/shared/3d/domain/types/AvatarInstanceState', SCENE_3D],
  ['$lib/shared/3d/domain/types/TipEffectTypes', SCENE_3D],
  ['$lib/shared/3d/domain/types/CameraStateSnapshot', SCENE_3D],
  // Scale & layers
  ['$lib/shared/3d/layers/layer-constants', SCENE_3D],
  ['$lib/shared/3d/scale/scale-constants', SCENE_3D],
  // Config
  ['$lib/shared/3d/config/avatar-definitions', SCENE_3D],
  ['$lib/shared/3d/config/avatar-proportions', SCENE_3D],
  ['$lib/shared/3d/config/user-proportions', SCENE_3D],
  ['$lib/shared/3d/config/formation-presets', SCENE_3D],
  // State
  ['$lib/shared/3d/state/user-proportions-state.svelte', SCENE_3D],
  // Context (viewer-visibility only — viewer-3d stays local due to PopoverId)
  ['$lib/shared/3d/context/viewer-visibility-context', SCENE_3D],
  // Services - contracts (only those exported by the package)
  ['$lib/shared/3d/services/contracts/IAvatarAnimator', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IAvatarSkeletonBuilder', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IIKSolver', SCENE_3D],
  ['$lib/shared/3d/services/contracts/ILocomotionAnimator', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IAnimationStateMachine', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IFootPlanter', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IRootMotionExtractor', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IFingerAnimator', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IClavicleRaiser', SCENE_3D],
  ['$lib/shared/3d/services/contracts/ISpineTwister', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IElbowPoleComputer', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IAngleMathCalculator', SCENE_3D],
  ['$lib/shared/3d/services/contracts/ICollisionDetector', SCENE_3D],
  ['$lib/shared/3d/services/contracts/ICameraChoreographer', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IFormationManager', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IContactCurveCache', SCENE_3D],
  ['$lib/shared/3d/services/contracts/ILegAnimator', SCENE_3D],
  ['$lib/shared/3d/services/contracts/ILegIKSolver', SCENE_3D],
  ['$lib/shared/3d/services/contracts/ITurnAnimator', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IAvatarCustomizer', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IPerformerSynchronizer', SCENE_3D],
  ['$lib/shared/3d/services/contracts/ISceneOrchestrator', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IViewer3DEffectPlugin', SCENE_3D],
  ['$lib/shared/3d/services/contracts/IViewer3DUndoManager', SCENE_3D],
  // Services - implementations (only those exported by the package)
  ['$lib/shared/3d/services/implementations/AvatarServicesFactory', SCENE_3D],
  ['$lib/shared/3d/services/implementations/AngleMathCalculator', SCENE_3D],
  ['$lib/shared/3d/services/implementations/AvatarAnimator', SCENE_3D],
  ['$lib/shared/3d/services/implementations/AvatarSkeletonBuilder', SCENE_3D],
  ['$lib/shared/3d/services/implementations/IKSolver', SCENE_3D],
  ['$lib/shared/3d/services/implementations/LocomotionAnimator', SCENE_3D],
  ['$lib/shared/3d/services/implementations/AnimationStateMachine', SCENE_3D],
  ['$lib/shared/3d/services/implementations/FootPlanter', SCENE_3D],
  ['$lib/shared/3d/services/implementations/RootMotionExtractor', SCENE_3D],
  ['$lib/shared/3d/services/implementations/FingerAnimator', SCENE_3D],
  ['$lib/shared/3d/services/implementations/ClavicleRaiser', SCENE_3D],
  ['$lib/shared/3d/services/implementations/SpineTwister', SCENE_3D],
  ['$lib/shared/3d/services/implementations/ElbowPoleComputer', SCENE_3D],
  ['$lib/shared/3d/services/implementations/CollisionDetector', SCENE_3D],
  ['$lib/shared/3d/services/implementations/HingeConstrainedLegIKSolver', SCENE_3D],
  ['$lib/shared/3d/services/implementations/ContactCurveCache', SCENE_3D],
  ['$lib/shared/3d/services/implementations/ClipBasedTurnAnimator', SCENE_3D],
  ['$lib/shared/3d/services/implementations/CameraChoreographer', SCENE_3D],
  ['$lib/shared/3d/services/implementations/FormationManager', SCENE_3D],
  ['$lib/shared/3d/services/implementations/AvatarCustomizer', SCENE_3D],
  ['$lib/shared/3d/services/implementations/KneeHingeAxisCalibrator', SCENE_3D],
  ['$lib/shared/3d/services/implementations/LegAnimator', SCENE_3D],
  ['$lib/shared/3d/services/implementations/CylinderGraspSolver', SCENE_3D],
  ['$lib/shared/3d/services/implementations/PerformerSynchronizer', SCENE_3D],
  ['$lib/shared/3d/services/implementations/Viewer3DUndoManager', SCENE_3D],
  ['$lib/shared/3d/services/implementations/SeatedAudienceLoader', SCENE_3D],
  // Utilities
  ['$lib/shared/3d/getAngleMath3D', SCENE_3D],
  ['$lib/shared/3d/getAngleMathCalculator', SCENE_3D],
  // Debug
  ['$lib/shared/3d/debug/avatar-debug-hooks', SCENE_3D],
  ['$lib/shared/3d/debug/mocap-debug', SCENE_3D],
  // Data
  ['$lib/shared/3d/data/grip-poses/staff-grip-poses', SCENE_3D],
  ['$lib/shared/3d/components/props/prop-model-registry', SCENE_3D],
  // ── environments-3d ──
  ['$lib/shared/3d/environments/domain/models/scene-configs', ENV_3D],
  ['$lib/shared/3d/environments/domain/models/environment-models', ENV_3D],
]);

// Default-import Svelte components → named import from package barrel
const DEFAULT_TO_NAMED = [
  { name: 'Avatar3D',     from: '$lib/shared/3d/components/Avatar3D.svelte',                pkg: SCENE_3D },
  { name: 'PerformerRig', from: '$lib/shared/3d/components/PerformerRig.svelte',             pkg: SCENE_3D },
  { name: 'Staff3D',      from: '$lib/shared/3d/components/Staff3D.svelte',                  pkg: SCENE_3D },
  { name: 'IKFigure3D',   from: '$lib/shared/3d/components/IKFigure3D.svelte',               pkg: SCENE_3D },
  { name: 'LimbSegment',  from: '$lib/shared/3d/components/LimbSegment.svelte',              pkg: SCENE_3D },
  { name: 'AvatarLoadingIndicator', from: '$lib/shared/3d/components/AvatarLoadingIndicator.svelte', pkg: SCENE_3D },
  { name: 'Prop3D',       from: '$lib/shared/3d/components/props/Prop3D.svelte',             pkg: SCENE_3D },
  { name: 'Ball3D',       from: '$lib/shared/3d/components/props/Ball3D.svelte',             pkg: SCENE_3D },
  { name: 'Buugeng3D',    from: '$lib/shared/3d/components/props/Buugeng3D.svelte',          pkg: SCENE_3D },
  { name: 'Chicken3D',    from: '$lib/shared/3d/components/props/Chicken3D.svelte',          pkg: SCENE_3D },
  { name: 'Club3D',       from: '$lib/shared/3d/components/props/Club3D.svelte',             pkg: SCENE_3D },
  { name: 'Doublestar3D', from: '$lib/shared/3d/components/props/Doublestar3D.svelte',       pkg: SCENE_3D },
  { name: 'Eightrings3D', from: '$lib/shared/3d/components/props/Eightrings3D.svelte',       pkg: SCENE_3D },
  { name: 'Fan3D',        from: '$lib/shared/3d/components/props/Fan3D.svelte',              pkg: SCENE_3D },
  { name: 'GltfProp3D',   from: '$lib/shared/3d/components/props/GltfProp3D.svelte',         pkg: SCENE_3D },
  { name: 'Guitar3D',     from: '$lib/shared/3d/components/props/Guitar3D.svelte',           pkg: SCENE_3D },
  { name: 'Hoop3D',       from: '$lib/shared/3d/components/props/Hoop3D.svelte',             pkg: SCENE_3D },
  { name: 'Poi3D',        from: '$lib/shared/3d/components/props/Poi3D.svelte',              pkg: SCENE_3D },
  { name: 'Sword3D',      from: '$lib/shared/3d/components/props/Sword3D.svelte',            pkg: SCENE_3D },
  { name: 'Torch3D',      from: '$lib/shared/3d/components/props/Torch3D.svelte',            pkg: SCENE_3D },
  { name: 'Triad3D',      from: '$lib/shared/3d/components/props/Triad3D.svelte',            pkg: SCENE_3D },
  { name: 'Triquetra3D',  from: '$lib/shared/3d/components/props/Triquetra3D.svelte',        pkg: SCENE_3D },
  // environments-3d
  { name: 'ForestScene',        from: '$lib/shared/3d/environments/scenes/ForestScene.svelte',        pkg: ENV_3D },
  { name: 'WinterScene',        from: '$lib/shared/3d/environments/scenes/WinterScene.svelte',        pkg: ENV_3D },
  { name: 'CosmicScene',        from: '$lib/shared/3d/environments/scenes/CosmicScene.svelte',        pkg: ENV_3D },
  { name: 'OceanScene',         from: '$lib/shared/3d/environments/scenes/OceanScene.svelte',         pkg: ENV_3D },
  { name: 'EmberScene',         from: '$lib/shared/3d/environments/scenes/EmberScene.svelte',         pkg: ENV_3D },
  { name: 'CherryBlossomScene', from: '$lib/shared/3d/environments/scenes/CherryBlossomScene.svelte', pkg: ENV_3D },
  { name: 'Environment3D',      from: '$lib/shared/3d/environments/components/Environment3D.svelte',  pkg: ENV_3D },
  { name: 'FallingParticles',   from: '$lib/shared/3d/environments/primitives/FallingParticles.svelte', pkg: ENV_3D },
  { name: 'SkyGradient',        from: '$lib/shared/3d/environments/primitives/SkyGradient.svelte',     pkg: ENV_3D },
  { name: 'GroundPlane',        from: '$lib/shared/3d/environments/primitives/GroundPlane.svelte',     pkg: ENV_3D },
  { name: 'TexturedGroundPlane', from: '$lib/shared/3d/environments/primitives/TexturedGroundPlane.svelte', pkg: ENV_3D },
  { name: 'VolumetricFireComponent', from: '$lib/shared/3d/environments/effects/volumetric-fire/VolumetricFireComponent.svelte', pkg: ENV_3D },
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
}

const srcDir = path.resolve('E:/tka-platform/src');
const files = walk(srcDir, ['.ts', '.svelte', '.js']);

let totalFiles = 0;
const changedFiles = [];

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // 1. Default-to-named conversions (must run before path rewrites to avoid double-matching)
  for (const { name, from: oldPath, pkg } of DEFAULT_TO_NAMED) {
    const esc = escapeRegex(oldPath);
    const re = new RegExp(`import\\s+${name}\\s+from\\s+["']${esc}["']`, 'g');
    content = content.replace(re, `import { ${name} } from "${pkg}"`);
  }

  // 2. Path rewrites (named/type imports — just swap the module specifier)
  for (const [oldPath, newPkg] of PATH_MAP) {
    const esc = escapeRegex(oldPath);
    // Static import: from "old" → from "new"
    content = content.replace(
      new RegExp(`from\\s+["']${esc}["']`, 'g'),
      `from "${newPkg}"`
    );
    // Dynamic import(): import("old") → import("new")
    content = content.replace(
      new RegExp(`import\\(\\s*["']${esc}["']\\s*\\)`, 'g'),
      `import("${newPkg}")`
    );
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    totalFiles++;
    changedFiles.push(path.relative(srcDir, filePath));
  }
}

console.log(`\n✓ Migrated ${totalFiles} files:\n`);
changedFiles.sort().forEach(f => console.log(`  ${f}`));
console.log();
