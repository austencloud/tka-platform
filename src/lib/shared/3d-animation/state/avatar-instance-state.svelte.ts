/**
 * Avatar Instance State
 *
 * Per-avatar state factory for multi-avatar 3D viewer.
 * Each avatar has independent sequence loading, playback, and locomotion.
 */

import type { MotionConfig3D } from "../domain/models/MotionData3D";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { Plane } from "../domain/enums/Plane";
import { createPlaybackState } from "./playback-state.svelte";
import type { IPropStateInterpolator } from "../services/contracts/IPropStateInterpolator";
import type {
  ISequenceConverter,
  StepMotionConfigs,
} from "../services/contracts/ISequenceConverter";
import type { AvatarId } from "../config/avatar-definitions";
import { DEFAULT_AVATAR_ID } from "../config/avatar-definitions";

// ============================================
// Locomotion Constants
// ============================================

/** Default Z position for avatars - same as grid plane so hands are at prop positions */
const FIGURE_Z = 0;

/** Movement speed in scene units per second */
const MOVE_SPEED = 150;

/** Rotation speed for smooth turning */
const ROTATION_SPEED = 8;

/** Scene bounds to keep avatars within visible area */
const SCENE_BOUNDS = {
  minX: -400,
  maxX: 400,
  minZ: -400,
  maxZ: 200,
};

/**
 * Check if a sequence is seamlessly loopable (ends where it starts).
 * Mirrors SequenceLoopabilityChecker logic from the 2D animator.
 */
function isSeamlesslyLoopable(sequence: SequenceData): boolean {
  if (!sequence.steps || sequence.steps.length === 0) {
    return false;
  }

  const firstStep = sequence.steps[0];
  const lastStep = sequence.steps[sequence.steps.length - 1];

  if (!firstStep || !lastStep) {
    return false;
  }

  // Check if positions match
  if (firstStep.startPosition !== lastStep.endPosition) {
    return false;
  }

  // Check blue prop orientations
  const blueFirst = firstStep.motions?.blue;
  const blueLast = lastStep.motions?.blue;
  if (blueFirst && blueLast) {
    if (blueFirst.startOrientation !== blueLast.endOrientation) {
      return false;
    }
  } else if (blueFirst || blueLast) {
    return false;
  }

  // Check red prop orientations
  const redFirst = firstStep.motions?.red;
  const redLast = lastStep.motions?.red;
  if (redFirst && redLast) {
    if (redFirst.startOrientation !== redLast.endOrientation) {
      return false;
    }
  } else if (redFirst || redLast) {
    return false;
  }

  return true;
}

/**
 * Configuration for an avatar instance
 */
export interface AvatarInstanceConfig {
  id: string;
  positionX: number;
  positionZ?: number;
  avatarModelId?: AvatarId;
}

/**
 * Dependencies for avatar instance state
 */
export interface AvatarInstanceDeps {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
}

/**
 * Create per-avatar animation state
 */
export function createAvatarInstanceState(
  config: AvatarInstanceConfig,
  deps: AvatarInstanceDeps
) {
  const { propInterpolator, sequenceConverter } = deps;

  // Avatar identity
  const id = config.id;
  let avatarModelId = $state<AvatarId>(
    config.avatarModelId ?? DEFAULT_AVATAR_ID
  );

  // ============================================
  // Locomotion State
  // ============================================

  // Full 3D position (replacing positionX)
  const position = $state({
    x: config.positionX,
    y: 0,
    z: config.positionZ ?? FIGURE_Z,
  });

  // Movement input from WASD keys (-1 to 1 for each axis)
  let moveInput = $state({ x: 0, z: 0 });

  // Whether avatar is currently moving
  let isMoving = $state(false);

  // Current facing angle in radians (0 = facing +Z)
  let facingAngle = $state(0);

  // Target facing angle for smooth rotation
  let targetFacingAngle = $state(0);

  // Visibility - start hidden until a sequence is loaded
  let showBlue = $state(false);
  let showRed = $state(false);

  // Sequence mode state
  let loadedSequence = $state<SequenceData | null>(null);
  let stepConfigs = $state<StepMotionConfigs[]>([]);
  let currentStepIndex = $state(0);

  // Per-avatar playback with unique persistence key
  const playback = createPlaybackState({
    onCycleComplete: () => handleCycleComplete(),
    persistenceKey: `tka-3d-playback-${id}`,
  });

  /**
   * Update visibility based on a beat's motion configs
   */
  function updateVisibilityFromStep(beat: StepMotionConfigs | undefined) {
    if (beat) {
      showBlue = beat.blue !== null;
      showRed = beat.red !== null;
    }
  }

  /**
   * Handle beat cycle completion - advances to next beat or loops
   */
  function handleCycleComplete(): boolean {
    if (!loadedSequence || stepConfigs.length === 0) {
      return false;
    }

    if (currentStepIndex < stepConfigs.length - 1) {
      // More steps to play
      currentStepIndex++;
      updateVisibilityFromStep(stepConfigs[currentStepIndex]);
      return true;
    } else if (playback.loop) {
      // Loop back to start
      currentStepIndex = 0;
      updateVisibilityFromStep(stepConfigs[0]);
      return true;
    } else {
      // Sequence complete (no loop) - reset to beat 0 for next play
      currentStepIndex = 0;
      updateVisibilityFromStep(stepConfigs[0]);
      return false;
    }
  }

  // Derived state
  const hasSequence = $derived(loadedSequence !== null);
  const isCircular = $derived(
    loadedSequence ? isSeamlesslyLoopable(loadedSequence) : false
  );
  const currentStep = $derived<StepMotionConfigs | null>(
    stepConfigs.length > 0 ? (stepConfigs[currentStepIndex] ?? null) : null
  );
  const totalSteps = $derived(stepConfigs.length);

  // Active configs from current beat
  const activeBlueConfig = $derived<MotionConfig3D | null>(
    currentStep?.blue ?? null
  );
  const activeRedConfig = $derived<MotionConfig3D | null>(
    currentStep?.red ?? null
  );

  // Computed prop states
  const bluePropState = $derived(
    activeBlueConfig
      ? propInterpolator.calculatePropState(activeBlueConfig, playback.progress)
      : null
  );
  const redPropState = $derived(
    activeRedConfig
      ? propInterpolator.calculatePropState(activeRedConfig, playback.progress)
      : null
  );

  /**
   * Load a sequence for this avatar.
   * Auto-enables looping for circular sequences (matching 2D animator behavior).
   */
  function loadSequence(sequence: SequenceData) {
    loadedSequence = sequence;
    stepConfigs = sequenceConverter.sequenceToMotionConfigs(
      sequence,
      Plane.WALL
    );
    currentStepIndex = 0;
    playback.reset();
    updateVisibilityFromStep(stepConfigs[0]);

    // Auto-enable loop for circular sequences
    if (isSeamlesslyLoopable(sequence)) {
      playback.loop = true;
    }
  }

  /**
   * Clear loaded sequence
   */
  function clearSequence() {
    loadedSequence = null;
    stepConfigs = [];
    currentStepIndex = 0;
    showBlue = false;
    showRed = false;
    playback.reset();
  }

  /**
   * Navigate to next beat
   */
  function nextStep() {
    if (stepConfigs.length === 0) return;
    currentStepIndex = Math.min(currentStepIndex + 1, stepConfigs.length - 1);
    playback.reset();
    updateVisibilityFromStep(stepConfigs[currentStepIndex]);
  }

  /**
   * Navigate to previous beat
   */
  function prevStep() {
    if (stepConfigs.length === 0) return;
    currentStepIndex = Math.max(currentStepIndex - 1, 0);
    playback.reset();
    updateVisibilityFromStep(stepConfigs[currentStepIndex]);
  }

  /**
   * Jump to specific beat
   */
  function goToStep(index: number) {
    if (stepConfigs.length === 0) return;
    currentStepIndex = Math.max(0, Math.min(index, stepConfigs.length - 1));
    playback.reset();
    updateVisibilityFromStep(stepConfigs[currentStepIndex]);
  }

  /**
   * Set avatar model
   */
  function setAvatarModel(modelId: AvatarId) {
    avatarModelId = modelId;
  }

  // ============================================
  // Locomotion Methods
  // ============================================

  /**
   * Set movement input from WASD keys.
   * @param input.x - Strafe: -1 (A/left) to 1 (D/right)
   * @param input.z - Forward/back: -1 (S/back) to 1 (W/forward)
   */
  function setMoveInput(input: { x: number; z: number }) {
    moveInput = input;
    isMoving = input.x !== 0 || input.z !== 0;
    // Sequence continues playing while moving - hands follow props via IK
  }

  /**
   * Update movement each frame.
   * Movement direction is relative to the camera angle.
   * Avatar faces where the camera looks (standard 3rd person controls).
   *
   * @param delta - Time since last frame in seconds
   * @param cameraAngle - Camera's Y rotation in radians (for camera-relative movement)
   */
  function updateMovement(delta: number, cameraAngle: number) {
    if (!isMoving) return;

    // Transform input by camera rotation for camera-relative movement
    // Standard Y-axis rotation matrix to convert local input to world space
    // Reference: https://sbcode.net/threejs/follow-cam/
    const sin = Math.sin(cameraAngle);
    const cos = Math.cos(cameraAngle);

    // World-space direction (rotated by camera yaw)
    // X is negated because in our coordinate system, screen-right is -X in world space
    // At yaw=0: forward (+Z local) → +Z world, right (D key) → -X world
    const worldX = -moveInput.x * cos + moveInput.z * sin;
    const worldZ = moveInput.x * sin + moveInput.z * cos;

    // Normalize for consistent speed when moving diagonally
    const length = Math.sqrt(worldX * worldX + worldZ * worldZ);
    const nx = length > 0 ? worldX / length : 0;
    const nz = length > 0 ? worldZ / length : 0;

    // Avatar faces camera direction (where the camera looks)
    // This is standard 3rd person behavior - avatar always faces forward relative to camera
    targetFacingAngle = cameraAngle;

    // Smooth rotation toward target angle
    let angleDiff = targetFacingAngle - facingAngle;
    // Normalize to -PI to PI for shortest rotation
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    facingAngle += angleDiff * Math.min(1, ROTATION_SPEED * delta);

    // Apply movement
    const moveAmount = MOVE_SPEED * delta;
    let newX = position.x + nx * moveAmount;
    let newZ = position.z + nz * moveAmount;

    // Clamp to scene bounds
    newX = Math.max(SCENE_BOUNDS.minX, Math.min(SCENE_BOUNDS.maxX, newX));
    newZ = Math.max(SCENE_BOUNDS.minZ, Math.min(SCENE_BOUNDS.maxZ, newZ));

    position.x = newX;
    position.z = newZ;
  }

  /**
   * Stop all movement immediately.
   */
  function stopMovement() {
    moveInput = { x: 0, z: 0 };
    isMoving = false;
  }

  /**
   * Set facing angle (for external mutation, e.g., from formation manager)
   */
  function setFacingAngle(value: number) {
    facingAngle = value;
    targetFacingAngle = value;
  }

  return {
    // Identity
    id,
    get config() {
      return config;
    },

    // Position (full 3D)
    get position() {
      return position;
    },

    // Facing angle for rotation
    get facingAngle() {
      return facingAngle;
    },
    set facingAngle(value: number) {
      facingAngle = value;
      targetFacingAngle = value;
    },

    // Movement state
    get isMoving() {
      return isMoving;
    },

    // Move direction for animation blending (raw input, not camera-rotated)
    get moveDirection() {
      return moveInput;
    },

    // Locomotion methods
    setMoveInput,
    updateMovement,
    stopMovement,
    setFacingAngle,

    // Avatar model
    get avatarModelId() {
      return avatarModelId;
    },
    setAvatarModel,

    // Sequence state
    get hasSequence() {
      return hasSequence;
    },
    get isCircular() {
      return isCircular;
    },
    get loadedSequence() {
      return loadedSequence;
    },
    get currentStepIndex() {
      return currentStepIndex;
    },
    get currentStep() {
      return currentStep;
    },
    get totalSteps() {
      return totalSteps;
    },

    // Visibility
    get showBlue() {
      return showBlue;
    },
    get showRed() {
      return showRed;
    },

    // Active configs
    get activeBlueConfig() {
      return activeBlueConfig;
    },
    get activeRedConfig() {
      return activeRedConfig;
    },

    // Prop states
    get bluePropState() {
      return bluePropState;
    },
    get redPropState() {
      return redPropState;
    },

    // Playback delegation
    get isPlaying() {
      return playback.isPlaying;
    },
    get progress() {
      return playback.progress;
    },
    get speed() {
      return playback.speed;
    },
    set speed(value: number) {
      playback.speed = value;
    },
    get loop() {
      return playback.loop;
    },
    set loop(value: boolean) {
      playback.loop = value;
    },

    // Playback methods
    play: playback.play,
    pause: playback.pause,
    togglePlay: playback.togglePlay,
    reset: playback.reset,
    setProgress: playback.setProgress,
    destroy: playback.destroy,
    autoStartIfNeeded: playback.autoStartIfNeeded,

    // Sequence methods
    loadSequence,
    clearSequence,
    nextStep,
    prevStep,
    goToStep,
  };
}

export type AvatarInstanceState = ReturnType<typeof createAvatarInstanceState>;
