/**
 * Migration pass 2: rewrite RELATIVE imports in staying-local 3D files
 * that reference extracted modules → @austencloud/scene-3d
 */
import fs from 'fs';
import path from 'path';

const SCENE_3D = '@austencloud/scene-3d';
const base = 'E:/tka-platform/src/lib/shared/3d';

// Map of relative path suffixes → package name
// These are the extracted modules. Any relative import resolving to one of these
// should be rewritten to import from the package.
const EXTRACTED_MODULES = [
  'domain/enums/Plane',
  'domain/enums/PlaneMode',
  'domain/enums/RotationDirection',
  'domain/models/PropState3D',
  'domain/models/GripPose',
  'domain/constants/grid-layout',
  'domain/constants/plane-mode-configs',
  'domain/constants/performer-positions',
  'domain/utils/plane-mode-utils',
  'domain/formation',
  'domain/camera-choreography',
  'domain/types/AvatarInstanceState',
  'domain/types/TipEffectTypes',
  'domain/types/CameraStateSnapshot',
  'layers/layer-constants',
  'scale/scale-constants',
  'config/avatar-definitions',
  'config/avatar-proportions',
  'config/user-proportions',
  'config/formation-presets',
  'services/contracts/IAvatarAnimator',
  'services/contracts/IAvatarSkeletonBuilder',
  'services/contracts/IIKSolver',
  'services/contracts/ILocomotionAnimator',
  'services/contracts/IAnimationStateMachine',
  'services/contracts/IFootPlanter',
  'services/contracts/IRootMotionExtractor',
  'services/contracts/IFingerAnimator',
  'services/contracts/IClavicleRaiser',
  'services/contracts/ISpineTwister',
  'services/contracts/IElbowPoleComputer',
  'services/contracts/IAngleMathCalculator',
  'services/contracts/ICollisionDetector',
  'services/contracts/ICameraChoreographer',
  'services/contracts/IFormationManager',
  'services/contracts/IContactCurveCache',
  'services/contracts/ILegAnimator',
  'services/contracts/ILegIKSolver',
  'services/contracts/ITurnAnimator',
  'services/contracts/IAvatarCustomizer',
  'services/contracts/IPerformerSynchronizer',
  'services/contracts/ISceneOrchestrator',
  'services/contracts/IViewer3DEffectPlugin',
  'services/contracts/IViewer3DUndoManager',
  'services/implementations/AvatarServicesFactory',
  'services/implementations/AngleMathCalculator',
  'services/implementations/AvatarAnimator',
  'services/implementations/AvatarSkeletonBuilder',
  'services/implementations/IKSolver',
  'services/implementations/LocomotionAnimator',
  'services/implementations/AnimationStateMachine',
  'services/implementations/FootPlanter',
  'services/implementations/RootMotionExtractor',
  'services/implementations/FingerAnimator',
  'services/implementations/ClavicleRaiser',
  'services/implementations/SpineTwister',
  'services/implementations/ElbowPoleComputer',
  'services/implementations/CollisionDetector',
  'services/implementations/HingeConstrainedLegIKSolver',
  'services/implementations/ContactCurveCache',
  'services/implementations/ClipBasedTurnAnimator',
  'services/implementations/CameraChoreographer',
  'services/implementations/FormationManager',
  'services/implementations/AvatarCustomizer',
  'services/implementations/KneeHingeAxisCalibrator',
  'services/implementations/LegAnimator',
  'services/implementations/CylinderGraspSolver',
  'services/implementations/PerformerSynchronizer',
  'services/implementations/Viewer3DUndoManager',
  'services/implementations/SeatedAudienceLoader',
  'data/grip-poses/staff-grip-poses',
  'getAngleMath3D',
  'getAngleMathCalculator',
  'debug/avatar-debug-hooks',
  'debug/mocap-debug',
  'context/viewer-visibility-context',
  'state/user-proportions-state.svelte',
];

function walk(dir, exts) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.svelte-kit', 'dist'].includes(entry.name)) continue;
      results = results.concat(walk(full, exts));
    } else if (exts.some(e => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

// Resolve a relative import from a file to an absolute path within the 3D dir
function resolveRelative(fromFile, relPath) {
  const fromDir = path.dirname(fromFile);
  let resolved = path.resolve(fromDir, relPath).replace(/\\/g, '/');
  // Normalize to be relative to the 3D base
  const baseNorm = base.replace(/\\/g, '/');
  if (resolved.startsWith(baseNorm + '/')) {
    return resolved.substring(baseNorm.length + 1);
  }
  return null;
}

const files = walk(base, ['.ts', '.svelte', '.js']);
let totalFiles = 0;
const changedFiles = [];

// Regex to match import lines with relative paths
const importRe = /^(\s*import\s+(?:type\s+)?(?:\{[^}]*\}|[\w]+)\s+from\s+)(["'])(\.\.?\/[^"']+)\2(\s*;?\s*)$/;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  const lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(importRe);
    if (!match) continue;

    const prefix = match[1];  // "import { X } from "
    const quote = match[2];   // quote char
    const relPath = match[3]; // relative path
    const suffix = match[4];  // trailing

    // Resolve to module ID relative to 3D base
    const moduleId = resolveRelative(filePath, relPath);
    if (!moduleId) continue;

    // Check if this resolves to an extracted module
    if (EXTRACTED_MODULES.includes(moduleId)) {
      lines[i] = `${prefix}"${SCENE_3D}"${suffix}`;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    totalFiles++;
    changedFiles.push(path.relative(base, filePath));
  }
}

console.log(`\n✓ Migrated ${totalFiles} files (relative imports):\n`);
changedFiles.sort().forEach(f => console.log(`  ${f}`));
console.log();
