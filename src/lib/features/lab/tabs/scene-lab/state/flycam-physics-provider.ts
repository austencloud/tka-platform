/**
 * Flycam Physics Provider
 *
 * A minimal, physics-less PhysicsProvider for the Scene Lab walkthrough.
 * Reports noclip as permanently enabled so UnifiedCameraController takes its
 * free-fly code path: full 3D forward vector (pitch lifts you), no gravity,
 * no ground clamp. The actual position is a shared mutable reference with
 * the SceneLabPlayerState so both sides mutate the same object each frame.
 */

import type { PhysicsProvider, Vector3 } from "$lib/shared/3d/camera/types";

export function createFlycamPhysicsProvider(
  position: { x: number; y: number; z: number }
): PhysicsProvider {
  return {
    movePlayer(desiredMovement: Vector3, _deltaTime: number) {
      position.x += desiredMovement.x;
      position.y += desiredMovement.y;
      position.z += desiredMovement.z;
    },
    getPlayerPosition(): Vector3 {
      return { x: position.x, y: position.y, z: position.z };
    },
    isGrounded() {
      return false;
    },
    getVelocity(): Vector3 {
      return { x: 0, y: 0, z: 0 };
    },
    isNoclipEnabled() {
      return true;
    },
    toggleNoclip() {
      return true;
    },
    setNoclip(_enabled: boolean) {
      // permanent noclip — ignore
    },
  };
}
