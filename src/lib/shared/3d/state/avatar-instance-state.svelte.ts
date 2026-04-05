/**
 * Avatar Instance State
 *
 * Per-avatar state factory for multi-avatar 3D viewer.
 * Each avatar has independent sequence loading, playback, and locomotion.
 */

import type { MotionConfig3D } from "../domain/models/MotionData3D";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { Plane } from "../domain/enums/Plane";
import { PlaneMode } from "../domain/enums/PlaneMode";
import { PLANE_MODE_CONFIGS, type PlaneModeConfig } from "../domain/constants/plane-mode-configs";
import { createPlaybackState } from "./playback-state.svelte";
import type { IPropStateInterpolator } from "../services/contracts/IPropStateInterpolator";
import type {
  ISequenceConverter,
  StepMotionConfigs,
} from "../services/contracts/ISequenceConverter";
import type { AvatarId } from "../config/avatar-definitions";
import { DEFAULT_AVATAR_ID } from "../config/avatar-definitions";
import { SCALE } from "$lib/shared/3d/scale/scale-constants";

// ============================================
// Position Constants (all in meters)
// ============================================

/** Default Z position for avatars - same as grid plane so hands are at prop positions */
const FIGURE_Z = 0;

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

  // Rotation speed in radians per second — fast enough to feel responsive,
  // slow enough to look smooth. 12 rad/s ≈ 180° in ~0.26s.
  const ROTATION_SPEED = 12;

  // Visibility - start hidden until a sequence is loaded
  let showBlue = $state(false);
  let showRed = $state(false);

  // Sequence mode state
  let loadedSequence = $state<SequenceData | null>(null);
  let stepConfigs = $state<StepMotionConfigs[]>([]);
  let currentStepIndex = $state(0);
  let planeMode = $state<PlaneMode>(PlaneMode.WALL);

  /**
   * Debug: cycle through rotation plane variants for dual wheel mode.
   * 0 = WALL, 1 = WHEEL, 2 = FLOOR. Helps find the correct spin axis.
   */
  const ROTATION_VARIANTS: Plane[] = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];
  const ROTATION_LABELS: string[] = ["Wall rot", "Wheel rot", "Floor rot"];
  let rotationVariantIndex = $state(1); // Default to WHEEL

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
    const modeConfig = getEffectiveModeConfig(planeMode);

    // Get motion configs (beats 1+) and prepend start position (beat 0)
    // so the full sequence including initial orientation is available.
    const motionConfigs = sequenceConverter.sequenceToMotionConfigs(
      sequence,
      Plane.WALL,
      modeConfig
    );
    const startConfig = sequenceConverter.getStartPositionConfigs(
      sequence,
      Plane.WALL,
      modeConfig
    );
    stepConfigs = startConfig
      ? [startConfig, ...motionConfigs]
      : motionConfigs;

    // DIAG: Dump raw start position and configs
    if (sequence.startPosition) {
      const sp = sequence.startPosition;
      const bm = sp.motions?.blue;
      const rm = sp.motions?.red;
    }
    if (stepConfigs[0]) {
      const s = stepConfigs[0];
    }

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
   * Switch between plane modes (wall vs dual wheel).
   * Re-converts the loaded sequence with the new mode's per-hand
   * plane assignments and lateral offsets, and rotates the avatar
   * to match the mode's facing angle.
   */
  /** Build an effective mode config with the current rotation variant override */
  function getEffectiveModeConfig(mode: PlaneMode): PlaneModeConfig {
    const base = PLANE_MODE_CONFIGS[mode];
    if (mode === PlaneMode.DUAL_WHEEL) {
      const rotPlane = ROTATION_VARIANTS[rotationVariantIndex] ?? Plane.WALL;
      return {
        ...base,
        rotationPlane: rotPlane,
        skipFacingTransform: true, // Always skip in dual wheel — positions stay in world YZ
      };
    }
    return base;
  }

  function setPlaneMode(mode: PlaneMode) {
    planeMode = mode;
    const modeConfig = getEffectiveModeConfig(mode);

    // Snap avatar rotation to match mode orientation immediately
    facingAngle = modeConfig.facingAngle;
    targetFacingAngle = modeConfig.facingAngle;

    // Re-convert loaded sequence with new plane assignments
    reconvertWithConfig(modeConfig);
  }

  /**
   * Debug: cycle through rotation plane variants and re-convert.
   * Returns the label of the new variant so the UI can show it.
   */
  function cycleRotationVariant(): string {
    rotationVariantIndex = (rotationVariantIndex + 1) % ROTATION_VARIANTS.length;
    const modeConfig = getEffectiveModeConfig(planeMode);
    reconvertWithConfig(modeConfig);
    return ROTATION_LABELS[rotationVariantIndex] ?? "Unknown";
  }

  /** Re-convert the loaded sequence with the given mode config */
  function reconvertWithConfig(modeConfig: PlaneModeConfig) {
    if (!loadedSequence) return;
    const motionConfigs = sequenceConverter.sequenceToMotionConfigs(
      loadedSequence,
      Plane.WALL,
      modeConfig
    );
    const startConfig = sequenceConverter.getStartPositionConfigs(
      loadedSequence,
      Plane.WALL,
      modeConfig
    );
    stepConfigs = startConfig
      ? [startConfig, ...motionConfigs]
      : motionConfigs;

    updateVisibilityFromStep(stepConfigs[currentStepIndex] ?? stepConfigs[0]);
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
   * Used by UnifiedCameraController to update animation state.
   * @param input.x - Strafe: -1 (A/left) to 1 (D/right)
   * @param input.z - Forward/back: -1 (S/back) to 1 (W/forward)
   */
  function setMoveInput(input: { x: number; z: number }) {
    moveInput = input;
    isMoving = input.x !== 0 || input.z !== 0;
  }

  /**
   * @deprecated Movement is now handled by UnifiedCameraController.
   * This method exists only for interface compatibility.
   * Position updates happen directly via avatarState.position.x/z mutation.
   */
  function updateMovement(_delta: number, _cameraAngle: number) {
    // NO-OP: Movement calculation moved to UnifiedCameraController
    // for unified behavior across Stage and Infinite Worlds.
    // Position is now mutated directly by the controller.
  }

  /**
   * Stop all movement immediately.
   */
  function stopMovement() {
    moveInput = { x: 0, z: 0 };
    isMoving = false;
  }

  /**
   * Set facing angle target.
   * Called by UnifiedCameraController to tell the avatar where to face.
   * In third-person mode this sets a TARGET that the avatar lerps toward
   * smoothly. In first-person mode, use snapFacingAngle for instant response.
   */
  function setFacingAngle(value: number) {
    targetFacingAngle = value;
  }

  /**
   * Snap facing angle instantly (no lerp). Used for first-person mode
   * where the avatar body must exactly match the camera direction.
   */
  function snapFacingAngle(value: number) {
    facingAngle = value;
    targetFacingAngle = value;
  }

  /**
   * Update locomotion state each frame. Lerps facing angle toward
   * target for smooth avatar rotation in third-person mode.
   * @param delta - frame time in seconds
   */
  function updateLocomotion(delta: number) {
    // Smoothly rotate toward target facing angle.
    // Use shortest-path rotation (handle angle wrapping around ±π).
    let diff = targetFacingAngle - facingAngle;

    // Normalize to [-π, π] for shortest rotation path
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    // If close enough, snap to avoid oscillation
    if (Math.abs(diff) < 0.01) {
      facingAngle = targetFacingAngle;
    } else {
      // Lerp at constant angular speed, capped to not overshoot
      const maxStep = ROTATION_SPEED * delta;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
      facingAngle += step;
    }
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
    updateLocomotion,
    stopMovement,
    setFacingAngle,
    snapFacingAngle,

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
    get planeMode() {
      return planeMode;
    },
    setPlaneMode,
    cycleRotationVariant,
    get rotationVariantLabel() {
      return ROTATION_LABELS[rotationVariantIndex];
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
