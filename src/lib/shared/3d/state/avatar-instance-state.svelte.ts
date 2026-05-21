/**
 * Avatar Instance State
 *
 * Per-avatar state factory for multi-avatar 3D viewer.
 * Each avatar has independent sequence loading, playback, and locomotion.
 */

import type { MotionConfig3D } from "../domain/models/MotionData3D";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { Plane } from "@austencloud/scene-3d";
import { PlaneMode } from "@austencloud/scene-3d";
import { PLANE_MODE_CONFIGS, type PlaneModeConfig } from "@austencloud/scene-3d";
import { createPlaybackState } from "./playback-state.svelte";
import { calculatePropState } from "../services/prop-state-interpolator";
import {
  sequenceToMotionConfigs,
  getStartPositionConfigs,
} from "../services/sequence-converter";
import type { StepMotionConfigs } from "../services/sequence-converter";
import type { AvatarId } from "@austencloud/scene-3d";
import { DEFAULT_AVATAR_ID } from "@austencloud/scene-3d";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { EffortTimeline } from "$lib/shared/effort/domain/effort-timeline-types";
import { findPhraseAtBeat } from "$lib/shared/effort/domain/effort-timeline-types";
import { interpolatePhrase } from "$lib/shared/phrase-effort-lab/services/phrase-interpolator";
import {
  makeDefaultPerformerSettings,
  type PerformerSettings,
  type EffectId,
} from "./performer-settings-types";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

// ============================================
// Position Constants (all in meters)
// ============================================

/** Default Z position for avatars - same as grid plane so hands are at prop positions */
const FIGURE_Z = 0;

/**
 * Derive the PlaneMode that matches a given pair of hand-plane assignments.
 *
 * When both hands are on the same preset plane, use the matching preset mode
 * (WALL or DUAL_WHEEL) so the renderer produces the intended spatial layout.
 * DUAL_WHEEL is required when both hands are on WHEEL - a single wheel plane
 * can't hold both hands without overlap through the avatar.
 *
 * Any other combination falls back to CUSTOM (per-hand independent).
 */
export function derivePlaneModeFromHands(bluePlane: Plane, redPlane: Plane): PlaneMode {
  if (bluePlane === Plane.WALL && redPlane === Plane.WALL) return PlaneMode.WALL;
  if (bluePlane === Plane.WHEEL && redPlane === Plane.WHEEL) return PlaneMode.DUAL_WHEEL;
  return PlaneMode.CUSTOM;
}

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
export type AvatarInstanceDeps = Record<string, unknown>;

/**
 * Create per-avatar animation state
 */
export function createAvatarInstanceState(
  config: AvatarInstanceConfig,
  deps: AvatarInstanceDeps
) {
  void deps; // deps retained for signature compatibility

  // Avatar identity
  const id = config.id;
  let avatarModelId = $state<AvatarId>(
    config.avatarModelId ?? DEFAULT_AVATAR_ID
  );

  // ============================================
  // Performer Settings (declared early so derived computations can read them)
  // ============================================

  let _settings = $state<PerformerSettings>(makeDefaultPerformerSettings());

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

  // Current facing angle in radians (0 = facing +Z).
  // Initialize from persisted plane mode so dual-wheel starts at π/2.
  const _initialPlaneMode = loadPersistedPlaneMode();
  const _initialFacing = _initialPlaneMode === PlaneMode.DUAL_WHEEL ? Math.PI / 2 : 0;
  let facingAngle = $state(_initialFacing);

  // Target facing angle for smooth rotation
  let targetFacingAngle = $state(_initialFacing);

  // Rotation speed in radians per second - fast enough to feel responsive,
  // slow enough to look smooth. 12 rad/s ≈ 180° in ~0.26s.
  const ROTATION_SPEED = 12;

  // Visibility - start hidden until a sequence is loaded
  let showBlue = $state(false);
  let showRed = $state(false);

  // Sequence mode state
  let loadedSequence = $state<SequenceData | null>(null);
  let stepConfigs = $state<StepMotionConfigs[]>([]);
  let currentStepIndex = $state(0);
  // Persist plane mode and rotation variant across HMR / page reloads
  const PLANE_MODE_KEY = `tka-3d-planeMode-${id}`;
  const ROT_VARIANT_KEY = `tka-3d-rotVariant-${id}`;

  function loadPersistedPlaneMode(): PlaneMode {
    try {
      const v = localStorage.getItem(PLANE_MODE_KEY);
      if (v === PlaneMode.DUAL_WHEEL) return PlaneMode.DUAL_WHEEL;
    } catch { /* ignore */ }
    return PlaneMode.WALL;
  }

  function loadPersistedRotVariant(): number {
    try {
      const v = localStorage.getItem(ROT_VARIANT_KEY);
      if (v !== null) return Math.max(0, Math.min(2, parseInt(v, 10) || 0));
    } catch { /* ignore */ }
    return 1;
  }

  let planeMode = $state<PlaneMode>(loadPersistedPlaneMode());
  let customBluePlane = $state<Plane>(Plane.WALL);
  let customRedPlane = $state<Plane>(Plane.WALL);

  // Per-beat plane overrides. Key = beat index, value = { blue?, red? }
  // Beats without an entry use Plane.WALL (the default).
  let beatPlaneOverrides = $state<Map<number, { blue?: Plane; red?: Plane }>>(new Map());

  // Whether we're editing planes per-beat (true) or whole-sequence (false)
  let beatEditMode = $state(false);

  const ROTATION_VARIANTS: Plane[] = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];
  const ROTATION_LABELS: string[] = ["Wall rot", "Wheel rot", "Floor rot"];
  let rotationVariantIndex = $state(loadPersistedRotVariant());

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

  // Effort easing: the 2D animator lets the user pick named easing profiles
  // (glide, punch, elastic, etc.) that reshape how progress flows within
  // each beat. The same curves apply cleanly here - we just transform the
  // raw progress that feeds into prop interpolation.
  // Timeline is sequence-scoped. Newer sequences store it under creatorIntent;
  // older ones use the top-level field.
  const effortTimeline = $derived<EffortTimeline | null>(
    loadedSequence?.creatorIntent?.effortTimeline ??
      loadedSequence?.effortTimeline ??
      null
  );

  // Resolves the active configs + eased progress for the current frame.
  // In phrase mode, easing can smear across beat boundaries, so the blue/red
  // configs here may come from a different step than currentStepIndex - this
  // matches how the 2D orchestrator picks a target step inside a phrase.
  // stepConfigs[0] is the start pose, so motion beat N lives at stepConfigs[N].
  const easedFrame = $derived.by(() => {
    const timeline = effortTimeline;
    const rawProgress = playback.progress;

    if (!timeline?.phrases?.length) {
      return {
        blue: activeBlueConfig,
        red: activeRedConfig,
        progress: applyEffort(_settings.effortId, rawProgress),
      };
    }

    const motionStepIndex = Math.max(0, currentStepIndex - 1);
    const currentStep = motionStepIndex + 1 + rawProgress;
    const phrase = findPhraseAtBeat(timeline, currentStep);

    if (!phrase) {
      // Gaps between phrases play linearly.
      return {
        blue: activeBlueConfig,
        red: activeRedConfig,
        progress: rawProgress,
      };
    }

    const totalMotionSteps = Math.max(1, stepConfigs.length - 1);
    const { stepIndex, localProgress } = interpolatePhrase(
      phrase,
      currentStep,
      totalMotionSteps,
    );

    const targetStep = stepConfigs[stepIndex + 1] ?? stepConfigs[stepIndex];
    return {
      blue: targetStep?.blue ?? null,
      red: targetStep?.red ?? null,
      progress: localProgress,
    };
  });

  // Computed prop states
  const bluePropState = $derived(
    easedFrame.blue
      ? calculatePropState(easedFrame.blue, easedFrame.progress)
      : null
  );
  const redPropState = $derived(
    easedFrame.red
      ? calculatePropState(easedFrame.red, easedFrame.progress)
      : null
  );

  /**
   * Load a sequence for this avatar.
   * Auto-enables looping for circular sequences (matching 2D animator behavior).
   */
  function loadSequence(sequence: SequenceData) {
    loadedSequence = sequence;
    beatPlaneOverrides = new Map(); // Reset per-beat overrides for new sequence
    const modeConfig = getEffectiveModeConfig(planeMode);

    // Get motion configs (beats 1+) and prepend start position (beat 0)
    // so the full sequence including initial orientation is available.
    const motionConfigs = sequenceToMotionConfigs(
      sequence,
      Plane.WALL,
      modeConfig
    );
    const startConfig = getStartPositionConfigs(
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
      const _bm = sp.motions?.blue;
      const _rm = sp.motions?.red;
    }
    if (stepConfigs[0]) {
      const _s = stepConfigs[0];
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
    if (mode === PlaneMode.CUSTOM) {
      return {
        facingAngle: 0,
        bluePlane: customBluePlane,
        redPlane: customRedPlane,
        // No rotationPlane - each hand rotates on its own position plane
        blueLateralOffset: 0,
        redLateralOffset: 0,
      };
    }
    const base = PLANE_MODE_CONFIGS[mode];
    // Dual-wheel no longer needs special overrides - the unified rotation
    // pipeline handles wheel plane correctly without skipFacingTransform
    // or rotationPlane overrides. Avatar faces forward, lateral offsets
    // place each hand's wheel plane to the sides.
    return base;
  }

  function setPlaneMode(mode: PlaneMode) {
    planeMode = mode;
    try { localStorage.setItem(PLANE_MODE_KEY, mode); } catch { /* ignore */ }

    // Sync custom plane trackers to the preset's planes when switching away from CUSTOM
    if (mode !== PlaneMode.CUSTOM) {
      const config = PLANE_MODE_CONFIGS[mode];
      customBluePlane = config.bluePlane;
      customRedPlane = config.redPlane;
    }

    const modeConfig = getEffectiveModeConfig(mode);

    // Snap avatar rotation to match mode orientation immediately
    facingAngle = modeConfig.facingAngle;
    targetFacingAngle = modeConfig.facingAngle;

    // Re-convert loaded sequence with new plane assignments
    reconvertWithConfig(modeConfig);
  }

  /**
   * Set a single hand's plane independently. The PlaneMode is derived from
   * the combined assignment - both hands on Wheel becomes DUAL_WHEEL (needed
   * for lateral rendering), both on Wall becomes WALL, anything else becomes
   * CUSTOM. Re-converts the sequence with the effective config.
   */
  function setHandPlane(hand: "blue" | "red", plane: Plane) {
    if (hand === "blue") customBluePlane = plane;
    else customRedPlane = plane;

    planeMode = derivePlaneModeFromHands(customBluePlane, customRedPlane);
    try { localStorage.setItem(PLANE_MODE_KEY, planeMode); } catch { /* ignore */ }

    reconvertWithConfig(getEffectiveModeConfig(planeMode));
  }

  /**
   * Set a specific beat's plane for one hand. Switches to CUSTOM mode
   * and re-applies all per-beat overrides to the step configs.
   *
   * Always forces CUSTOM - per-beat overrides are intentional deviations
   * from the sequence-wide setting, so they can never map to a preset mode
   * regardless of what the global hand assignment would derive.
   */
  function setStepHandPlane(stepNumber: number, hand: "blue" | "red", plane: Plane) {
    const current = beatPlaneOverrides.get(stepNumber) ?? {};
    const updated = { ...current, [hand]: plane };

    // If both hands are WALL (or undefined), remove the entry to keep the map clean
    if ((!updated.blue || updated.blue === Plane.WALL) &&
        (!updated.red || updated.red === Plane.WALL)) {
      beatPlaneOverrides.delete(stepNumber);
    } else {
      beatPlaneOverrides.set(stepNumber, updated);
    }

    // Trigger reactivity by reassigning
    beatPlaneOverrides = new Map(beatPlaneOverrides);

    // Switch to CUSTOM mode if not already
    if (planeMode !== PlaneMode.CUSTOM) {
      planeMode = PlaneMode.CUSTOM;
    }

    // Re-apply overrides to the step configs
    applyBeatPlaneOverrides();
  }

  /**
   * Get the plane assignments for a specific beat.
   * Returns the override if one exists, otherwise Plane.WALL.
   */
  function getStepPlanes(stepNumber: number): { blue: Plane; red: Plane } {
    const override = beatPlaneOverrides.get(stepNumber);
    return {
      blue: override?.blue ?? Plane.WALL,
      red: override?.red ?? Plane.WALL,
    };
  }

  /**
   * Re-convert the entire sequence with WALL defaults, then patch in
   * per-beat plane overrides for any beats that have them.
   */
  function applyBeatPlaneOverrides() {
    if (!loadedSequence) return;

    const motionConfigs = sequenceToMotionConfigs(
      loadedSequence,
      Plane.WALL
    );
    const startConfig = getStartPositionConfigs(
      loadedSequence,
      Plane.WALL
    );
    const allConfigs = startConfig ? [startConfig, ...motionConfigs] : motionConfigs;

    // Patch per-beat overrides into individual configs
    for (const [beatIdx, override] of beatPlaneOverrides) {
      const config = allConfigs[beatIdx];
      if (!config) continue;

      if (override.blue && config.blue) {
        config.blue = { ...config.blue, plane: override.blue };
      }
      if (override.red && config.red) {
        config.red = { ...config.red, plane: override.red };
      }
    }

    stepConfigs = allConfigs;
    updateVisibilityFromStep(stepConfigs[currentStepIndex] ?? stepConfigs[0]);
  }

  /**
   * Clear all per-beat plane overrides, resetting every beat to WALL.
   */
  function clearBeatPlaneOverrides() {
    beatPlaneOverrides = new Map();
    if (planeMode === PlaneMode.CUSTOM) {
      setPlaneMode(PlaneMode.WALL);
    }
  }

  // Derived: planes for the currently selected beat
  const currentStepPlanes = $derived(getStepPlanes(currentStepIndex));

  /**
   * Debug: cycle through rotation plane variants and re-convert.
   * Returns the label of the new variant so the UI can show it.
   */
  function cycleRotationVariant(): string {
    rotationVariantIndex = (rotationVariantIndex + 1) % ROTATION_VARIANTS.length;
    try { localStorage.setItem(ROT_VARIANT_KEY, String(rotationVariantIndex)); } catch { /* ignore */ }
    const modeConfig = getEffectiveModeConfig(planeMode);
    reconvertWithConfig(modeConfig);
    return ROTATION_LABELS[rotationVariantIndex] ?? "Unknown";
  }

  /** Re-convert the loaded sequence with the given mode config */
  function reconvertWithConfig(modeConfig: PlaneModeConfig) {
    if (!loadedSequence) return;
    const motionConfigs = sequenceToMotionConfigs(
      loadedSequence,
      Plane.WALL,
      modeConfig
    );
    const startConfig = getStartPositionConfigs(
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

  // ============================================
  // Performer Settings (setter functions - _settings declared near top)
  // ============================================

  function setEffort(effortId: EffortId): void {
    _settings = { ..._settings, effortId };
  }

  function setProp(prop: PropType): void {
    _settings = { ..._settings, prop };
  }

  function toggleEffect(effect: EffectId): void {
    const next = new Set(_settings.effects);
    if (next.has(effect)) next.delete(effect);
    else next.add(effect);
    _settings = { ..._settings, effects: next };
  }

  function setStaffLengthCm(cm: number | null): void {
    _settings = { ..._settings, staffLengthCm: cm };
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
    setHandPlane,
    setStepHandPlane,
    clearBeatPlaneOverrides,
    get customBluePlane() { return customBluePlane; },
    get customRedPlane() { return customRedPlane; },
    get currentStepBluePlane() { return currentStepPlanes.blue; },
    get currentStepRedPlane() { return currentStepPlanes.red; },
    get beatPlaneOverrides() { return beatPlaneOverrides; },
    get hasStepOverrides() { return beatPlaneOverrides.size > 0; },
    get beatEditMode() { return beatEditMode; },
    setStepEditMode(enabled: boolean) { beatEditMode = enabled; },
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

    // Effort state (for UI readouts / debugging)
    get effortPreset() {
      return _settings.effortId;
    },
    get effortTimeline() {
      return effortTimeline;
    },

    // Playback methods
    play: playback.play,
    pause: playback.pause,
    togglePlay: playback.togglePlay,
    reset: playback.reset,
    setProgress: playback.setProgress,
    destroy: () => {
      playback.destroy();
    },
    autoStartIfNeeded: playback.autoStartIfNeeded,

    // Sequence methods
    loadSequence,
    clearSequence,
    nextStep,
    prevStep,
    goToStep,

    // Performer settings
    get settings() { return _settings; },
    setEffort,
    setProp,
    toggleEffect,
    setStaffLengthCm,
  };
}

export type AvatarInstanceState = ReturnType<typeof createAvatarInstanceState>;
