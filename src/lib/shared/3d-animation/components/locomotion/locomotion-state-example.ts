/**
 * Locomotion State Example (WASD + Third-Person Camera)
 *
 * This file shows how to extend avatar-instance-state.svelte.ts
 * to support WASD locomotion with camera-relative movement.
 *
 * This is a REFERENCE ONLY - not meant to be imported.
 * When implementing, copy the relevant parts into avatar-instance-state.svelte.ts
 */

// ============================================
// ADD THESE CONSTANTS (at top of file)
// ============================================

/** Default Z position for avatars */
const _FIGURE_Z = -80;

/** Movement speed in scene units per second */
const _MOVE_SPEED = 150;

/** Rotation speed for smooth turning (radians per second equivalent) */
const _ROTATION_SPEED = 8;

/** Scene bounds to keep avatars within visible area */
const _SCENE_BOUNDS = {
  minX: -400,
  maxX: 400,
  minZ: -400,
  maxZ: 200,
};

// ============================================
// REPLACE positionX with full position state
// ============================================

// OLD:
// let positionX = $state(config.positionX);

// NEW:
// let position = $state({
//   x: config.positionX,
//   y: 0,  // Y is calculated from ground
//   z: config.positionZ ?? FIGURE_Z
// });

// ============================================
// ADD THESE STATE VARIABLES
// ============================================

// Movement input from WASD keys (-1 to 1 for each axis)
// let moveInput = $state({ x: 0, z: 0 });

// Whether avatar is currently moving
// let isMoving = $state(false);

// Current facing angle in radians (0 = facing +Z)
// let facingAngle = $state(0);

// Target facing angle for smooth rotation
// let targetFacingAngle = $state(0);

// ============================================
// ADD THESE METHODS
// ============================================

/**
 * Set movement input from WASD keys.
 * @param input.x - Strafe: -1 (A/left) to 1 (D/right)
 * @param input.z - Forward/back: -1 (S/back) to 1 (W/forward)
 */
function _setMoveInput(_input: { x: number; z: number }): void {
  // moveInput = input;
  // isMoving = input.x !== 0 || input.z !== 0;
  // Pause sequence playback while moving
  // if (isMoving && playback.isPlaying) {
  //   playback.pause();
  // }
}

/**
 * Update movement each frame.
 * Movement direction is relative to the camera angle.
 *
 * @param delta - Time since last frame in seconds
 * @param cameraAngle - Camera's Y rotation in radians (for camera-relative movement)
 */
function _updateMovement(_delta: number, _cameraAngle: number): void {
  // if (!isMoving) return;
  // Transform input by camera rotation for camera-relative movement
  // const sin = Math.sin(cameraAngle);
  // const cos = Math.cos(cameraAngle);
  // World-space direction (rotated by camera angle)
  // const worldX = moveInput.x * cos - moveInput.z * sin;
  // const worldZ = moveInput.x * sin + moveInput.z * cos;
  // Normalize for consistent speed when moving diagonally
  // const length = Math.sqrt(worldX * worldX + worldZ * worldZ);
  // const nx = length > 0 ? worldX / length : 0;
  // const nz = length > 0 ? worldZ / length : 0;
  // Update target facing angle (avatar turns to face movement direction)
  // if (length > 0) {
  //   targetFacingAngle = Math.atan2(nx, nz);
  // }
  // Smooth rotation toward target angle
  // let angleDiff = targetFacingAngle - facingAngle;
  // Normalize to -PI to PI for shortest rotation
  // while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  // while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  // facingAngle += angleDiff * Math.min(1, ROTATION_SPEED * delta);
  // Apply movement
  // const moveAmount = MOVE_SPEED * delta;
  // let newX = position.x + nx * moveAmount;
  // let newZ = position.z + nz * moveAmount;
  // Clamp to scene bounds
  // newX = Math.max(SCENE_BOUNDS.minX, Math.min(SCENE_BOUNDS.maxX, newX));
  // newZ = Math.max(SCENE_BOUNDS.minZ, Math.min(SCENE_BOUNDS.maxZ, newZ));
  // position.x = newX;
  // position.z = newZ;
}

/**
 * Stop all movement immediately.
 */
function _stopMovement(): void {
  // moveInput = { x: 0, z: 0 };
  // isMoving = false;
}

// ============================================
// ADD TO RETURN OBJECT
// ============================================

// return {
//   // ... existing properties ...
//
//   // Position (full 3D, not just X)
//   get position() { return position; },
//
//   // Facing angle for rotation
//   get facingAngle() { return facingAngle; },
//
//   // Movement state
//   get isMoving() { return isMoving; },
//
//   // Movement methods
//   setMoveInput,
//   updateMovement,
//   stopMovement,
// };

// ============================================
// UPDATE Avatar3D.svelte PROPS
// ============================================

// Change from:
// <Avatar3D positionX={avatarState.positionX} ... />

// To:
// <Avatar3D
//   position={avatarState.position}
//   facingAngle={avatarState.facingAngle}
//   ...
// />

// ============================================
// UPDATE Avatar3D.svelte TEMPLATE
// ============================================

// Change from:
// <T.Group position={[positionX, groupY, FIGURE_Z]}>

// To:
// <T.Group
//   position={[position.x, groupY, position.z]}
//   rotation.y={facingAngle}
// >

// ============================================
// WIRE UP IN Viewer3DModule.svelte
// ============================================

// Add toggle for locomotion mode:
// let locomotionMode = $state(false);

// Conditionally render LocomotionController:
// {#if locomotionMode && activeState}
//   <LocomotionController
//     avatarState={activeState}
//     enabled={locomotionMode}
//   />
// {/if}

// Add button to toggle mode:
// <button onclick={() => locomotionMode = !locomotionMode}>
//   {locomotionMode ? 'Exit Walk Mode' : 'Enter Walk Mode'}
// </button>

export {}; // Make this a module
