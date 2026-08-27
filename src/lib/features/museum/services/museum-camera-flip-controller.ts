/**
 * MuseumCameraFlipController
 *
 * Manages the animated camera transition between top-down (bird's-eye) and
 * first-person (FPS) views. Owns the TOP_DOWN / FPS state objects, the flip
 * animation progress, easing, and the two sync helpers that align the FPS
 * target with either the player position or the live camera.
 *
 * All Svelte reactive state ($state) stays in the component — this class
 * receives current values via method parameters and returns results for the
 * component to apply.
 */

import { Vector3, Quaternion, Euler } from "three";
import type { PerspectiveCamera } from "three";


const TOP_DOWN_FOV = 50;
const CAMERA_SMOOTHING = 0.08;
const ZOOM_SMOOTHING = 0.12;
const UCC_FP_HEIGHT = 0.75;
const UCC_FP_FORWARD_OFFSET = 0.05;
const UCC_FPS_FOV = 65;
const UCC_FAR_PLANE = 10000;

export interface CameraFlipState {
  progress: number;
  animating: boolean;
  goingDown: boolean;
  initialized: boolean;
  lastFlipCount: number;
}

export interface CameraFlipResult {
  progress: number;
  animating: boolean;
  goingDown: boolean;
  initialized: boolean;
  lastFlipCount: number;
  /** True when the flip animation just completed going down (entering FPS) */
  justEnteredFps: boolean;
  /** Snapshot yaw to hand to UCC's initialYaw */
  fpsInitialYaw?: number;
  /** Snapshot pitch to hand to UCC's initialPitch */
  fpsInitialPitch?: number;
}

export class MuseumCameraFlipController {
  readonly topDown: {
    position: Vector3;
    quaternion: Quaternion;
    fov: number;
  };

  readonly fps: {
    position: Vector3;
    quaternion: Quaternion;
    fov: number;
  };

  // Current top-down height (lerps toward target)
  private currentTopDownHeight: number;

  constructor(spawnWorldX: number, spawnWorldZ: number, initialTopDownHeight: number) {
    this.currentTopDownHeight = initialTopDownHeight;

    this.topDown = {
      position: new Vector3(spawnWorldX, initialTopDownHeight, spawnWorldZ),
      quaternion: new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0)),
      fov: TOP_DOWN_FOV,
    };

    this.fps = {
      position: new Vector3(
        spawnWorldX,
        0.85 + UCC_FP_HEIGHT,
        spawnWorldZ + UCC_FP_FORWARD_OFFSET,
      ),
      quaternion: new Quaternion(),
      fov: UCC_FPS_FOV,
    };
  }


  /**
   * Compute FPS target from the player's current position + yaw.
   * Used when ENTERING FPS from top-down.
   */
  syncFpsFromPlayer(
    playerPos: { x: number; y: number; z: number },
    playerYaw: number,
    playerPitch: number,
    camera: PerspectiveCamera | undefined,
  ): void {
    const camX = playerPos.x + Math.sin(playerYaw) * UCC_FP_FORWARD_OFFSET;
    const camY = playerPos.y + UCC_FP_HEIGHT;
    const camZ = playerPos.z + Math.cos(playerYaw) * UCC_FP_FORWARD_OFFSET;
    this.fps.position.set(camX, camY, camZ);
    this.fps.fov = UCC_FPS_FOV;

    if (camera) {
      const savedPos = camera.position.clone();
      const savedQuat = camera.quaternion.clone();
      const savedFov = camera.fov;

      camera.position.set(camX, camY, camZ);
      camera.up.set(0, 1, 0);
      const lookDist = 100;
      camera.lookAt(
        camX + Math.sin(playerYaw) * lookDist * Math.cos(playerPitch),
        camY - Math.sin(playerPitch) * lookDist,
        camZ + Math.cos(playerYaw) * lookDist * Math.cos(playerPitch),
      );
      this.fps.quaternion.copy(camera.quaternion);

      camera.position.copy(savedPos);
      camera.quaternion.copy(savedQuat);
      camera.fov = savedFov;
    } else {
      this.fps.quaternion.setFromEuler(new Euler(0, playerYaw, 0));
    }
  }

  /**
   * Capture the camera's ACTUAL state into FPS.
   * Used when EXITING FPS so the flip-back animation starts from
   * exactly where UCC had the camera.
   */
  syncFpsFromCamera(camera: PerspectiveCamera): void {
    this.fps.position.copy(camera.position);
    this.fps.quaternion.copy(camera.quaternion);
    this.fps.fov = camera.fov;
  }

  // ── Camera follow (top-down mode) ──

  /**
   * Smooth-follow the player in top-down mode. Updates TOP_DOWN position
   * and applies it to the camera.
   */
  updateTopDownFollow(
    camera: PerspectiveCamera,
    playerPos: { x: number; y: number; z: number },
    targetTopDownHeight: number,
  ): void {
    this.topDown.position.x += (playerPos.x - this.topDown.position.x) * CAMERA_SMOOTHING;
    this.topDown.position.z += (playerPos.z - this.topDown.position.z) * CAMERA_SMOOTHING;

    this.currentTopDownHeight += (targetTopDownHeight - this.currentTopDownHeight) * ZOOM_SMOOTHING;
    this.topDown.position.y = this.currentTopDownHeight;

    camera.position.copy(this.topDown.position);
    camera.quaternion.copy(this.topDown.quaternion);
    camera.fov = this.topDown.fov;
    camera.near = 0.1;
    camera.far = UCC_FAR_PLANE;
    camera.updateProjectionMatrix();
  }

  /**
   * Snap the top-down camera to the player's position (no lag).
   * Used after teleport/reset.
   */
  snapTopDownToPlayer(playerPos: { x: number; z: number }): void {
    this.topDown.position.x = playerPos.x;
    this.topDown.position.z = playerPos.z;
  }


  /**
   * Initialize camera on the first frame.
   * Returns true if initialization was performed.
   */
  initializeCamera(
    camera: PerspectiveCamera,
    initialFpsActive: boolean,
  ): void {
    if (initialFpsActive) {
      camera.position.copy(this.fps.position);
      camera.quaternion.copy(this.fps.quaternion);
      camera.fov = this.fps.fov;
    } else {
      camera.position.copy(this.topDown.position);
      camera.quaternion.copy(this.topDown.quaternion);
      camera.fov = this.topDown.fov;
    }
    camera.near = 0.1;
    camera.far = UCC_FAR_PLANE;
    camera.updateProjectionMatrix();
  }


  /**
   * Check for a new flip request and start the animation if needed.
   * Returns updated state values.
   */
  checkFlipRequest(
    flipRequested: number,
    state: CameraFlipState,
    playerPos: { x: number; y: number; z: number },
    playerYaw: number,
    playerPitch: number,
    camera: PerspectiveCamera | undefined,
  ): CameraFlipState {
    if (flipRequested !== state.lastFlipCount) {
      const updated = { ...state, lastFlipCount: flipRequested };
      if (!state.animating) {
        this.syncFpsFromPlayer(playerPos, playerYaw, playerPitch, camera);
        updated.animating = true;
        updated.goingDown = state.progress < 0.5;
      }
      return updated;
    }
    return state;
  }

  /**
   * Complete a requested view change on the next render frame.
   *
   * The previous 0.8-second camera flight crossed a large portion of the
   * museum. That exposed unrelated room materials to the camera and forced the
   * browser to link their shaders in the middle of an interaction. Snapping to
   * the already-warmed endpoint keeps the switch bounded to one frame.
   *
   * Returns updated state. If justEnteredFps is true, the caller should
   * activate FPS mode and set initial yaw/pitch from the returned values.
   */
  updateFlipAnimation(
    camera: PerspectiveCamera,
    _delta: number,
    state: CameraFlipState,
    playerYaw: number,
    playerPitch: number,
  ): CameraFlipResult {
    const { goingDown } = state;
    const progress = goingDown ? 1 : 0;
    const target = goingDown ? this.fps : this.topDown;

    camera.position.copy(target.position);
    camera.quaternion.copy(target.quaternion);
    camera.fov = target.fov;
    camera.near = 0.1;
    camera.far = UCC_FAR_PLANE;
    camera.updateProjectionMatrix();

    return {
      progress,
      animating: false,
      goingDown,
      initialized: state.initialized,
      lastFlipCount: state.lastFlipCount,
      justEnteredFps: goingDown,
      fpsInitialYaw: goingDown ? playerYaw : undefined,
      fpsInitialPitch: goingDown ? playerPitch : undefined,
    };
  }
}
