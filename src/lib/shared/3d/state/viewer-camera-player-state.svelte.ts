/**
 * Viewer Camera Player State
 *
 * Drives UnifiedCameraController in fly mode from the sequence viewer.
 * This is the CAMERA's avatar, not a performer - WASD moves this object,
 * not the dancer on stage. Position is a plain mutable reference shared
 * with the flycam physics provider so both sides mutate the same values
 * each frame.
 */

import type { AvatarState, PhysicsProvider } from "../camera/types";
import { createFlycamPhysicsProvider } from "./flycam-physics-provider";

export function createViewerCameraPlayerState(): {
  avatarState: AvatarState;
  physicsProvider: PhysicsProvider;
  resetSpawn: () => void;
} {
  // Spawn roughly where the orbit camera's default sits: in front of the
  // performer, slightly elevated (eye near shoulder height once the
  // controller adds its +1.6m first-person offset, which is ~0.1m above
  // shoulder in TKA's shoulder-centric world).
  const SPAWN_X = 0;
  const SPAWN_Y = -1.5; // feet near ground plane (groundY ≈ -1.5)
  const SPAWN_Z = 2.5;

  const position = { x: SPAWN_X, y: SPAWN_Y, z: SPAWN_Z };
  let facingAngle = Math.PI; // face the performer (toward -Z origin)
  let targetYaw = Math.PI;
  let isMoving = false;
  let moveDir = { x: 0, z: 0 };
  const ROTATION_SPEED = 8;

  const avatarState: AvatarState = {
    get position() {
      return position;
    },
    get facingAngle() {
      return facingAngle;
    },
    get isMoving() {
      return isMoving;
    },
    get moveDirection() {
      return moveDir;
    },
    setMoveInput(input: { x: number; z: number }) {
      moveDir = input;
      isMoving = input.x !== 0 || input.z !== 0;
    },
    updateMovement() {
      // No-op - the kinematic branch is unused here because we always
      // supply a physics provider. Position is written by the provider.
    },
    setFacingAngle(angle: number) {
      targetYaw = angle;
    },
    snapFacingAngle(angle: number) {
      facingAngle = angle;
      targetYaw = angle;
    },
    updateLocomotion(delta: number) {
      let diff = targetYaw - facingAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) < 0.01) {
        facingAngle = targetYaw;
      } else {
        const maxStep = ROTATION_SPEED * delta;
        facingAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
      }
    },
  };

  function resetSpawn() {
    position.x = SPAWN_X;
    position.y = SPAWN_Y;
    position.z = SPAWN_Z;
    facingAngle = Math.PI;
    targetYaw = Math.PI;
    isMoving = false;
    moveDir = { x: 0, z: 0 };
  }

  const physicsProvider = createFlycamPhysicsProvider(position);

  return { avatarState, physicsProvider, resetSpawn };
}
