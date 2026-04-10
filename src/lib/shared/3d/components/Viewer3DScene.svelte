<script lang="ts">
  /**
   * Viewer3DScene
   *
   * Inner 3D scene content for the sequence viewer. Renders inside a Threlte
   * <Canvas>. Drives avatar pose purely through the useTask sync loop — the
   * orchestrator controls currentStep and this component puppets the avatar
   * to match. avatarState.play() is never called here.
   *
   * All avatar/grid/prop/effect wiring is delegated to PerformerRig, which
   * owns the unified transform hierarchy. This component handles environment,
   * lighting, dual-wheel prop swapping, and the puppet-mode sync loop.
   */

  import { T, useTask } from "@threlte/core";
  import PerformerRig from "./PerformerRig.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { container } from "$lib/shared/di";
  import { BackgroundType } from "@austencloud/backgrounds";
  import Environment3D from "../environments/components/Environment3D.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { Plane } from "../domain/enums/Plane";
  import { PlaneMode } from "../domain/enums/PlaneMode";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import type { PropState3D } from "../domain/models/PropState3D";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    avatarState: AvatarInstanceState;
  }

  let { sequenceData, currentStep, isPlaying, avatarState }: Props = $props();
  const viewer3DState = getViewer3DContext();

  // GLTF models face -Z at facingAngle=0 (OpenGL convention).
  // Camera at +Z looks toward -Z and sees the avatar's back.
  // From +Z looking -Z (right-handed): +X = screen right = east ✓
  // In dual wheel mode, the avatar turns 90° — read from avatar state.
  const facingAngle = $derived(avatarState.facingAngle);

  // Read the global tip effect map so the 3D orchestrator knows which effect
  // each tip should use (trails, led, fire, etc.).
  // The visibility manager uses an observer pattern (not Svelte runes), so we
  // bridge it into reactive state with $state + registerObserver.
  const visibilityManager = getAnimationVisibilityManager();
  let globalTipEffectMap = $state<TipEffectMap>(visibilityManager.getTipEffectMap());

  $effect(() => {
    // Sync on mount and whenever visibility settings change
    const updateMap = () => {
      globalTipEffectMap = visibilityManager.getTipEffectMap();
    };
    visibilityManager.registerObserver(updateMap);
    updateMap();
    return () => visibilityManager.unregisterObserver(updateMap);
  });

  // Puppet-mode sync loop: convert the orchestrator's floating-point currentStep
  // into avatar beat index + sub-beat progress each frame.
  //
  // currentStep is a continuous float: integer part = beat index, fractional
  // part = sub-beat interpolation 0..1. Beat 0 = start position, beats 1+ = motion.
  //
  // stepConfigs now includes the start position at index 0, so the mapping
  // is direct: 2D beat N → 3D index N (no offset needed).
  useTask(() => {
    const beatIndex = Math.floor(currentStep);
    const subBeatProgress = currentStep - beatIndex;

    // When currentStep exceeds the last valid index (end of sequence or
    // end-position hold), show the final step at full progress instead of
    // clamping the index and resetting progress to 0 (which causes a jerk).
    if (beatIndex >= avatarState.totalSteps) {
      avatarState.goToStep(avatarState.totalSteps - 1);
      avatarState.setProgress(1);
    } else {
      avatarState.goToStep(beatIndex);
      avatarState.setProgress(subBeatProgress);
    }
  });

  const rawBlue = $derived(avatarState.bluePropState);
  const rawRed = $derived(avatarState.redPropState);
  const isDualWheelMode = $derived(avatarState.planeMode === PlaneMode.DUAL_WHEEL);

  // No swap needed: blue prop → LeftHand bone → blueLateralOffset (+X),
  // red prop → RightHand bone → redLateralOffset (-X). The hand anchor
  // positions in PerformerRig already place each hand at the correct grid.
  const bluePropState = $derived(rawBlue);
  const redPropState = $derived(rawRed);

  // Resolve prop type: prefer sequence's intended prop, fall back to settings
  const bluePropType = $derived.by((): PropType => {
    if (sequenceData?.intendedProp?.bluePropType) return sequenceData.intendedProp.bluePropType;
    if (sequenceData?.creatorIntent?.propConfig?.bluePropType) return sequenceData.creatorIntent.propConfig.bluePropType;
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.bluePropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });
  const redPropType = $derived.by((): PropType => {
    if (sequenceData?.intendedProp?.redPropType) return sequenceData.intendedProp.redPropType;
    if (sequenceData?.creatorIntent?.propConfig?.redPropType) return sequenceData.creatorIntent.propConfig.redPropType;
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.redPropType ?? PropType.STAFF;
    } catch { return PropType.STAFF; }
  });

  // Convert string-keyed Set from state into the typed Plane Set that Grid3D expects.
  // The state layer uses Plane enum values as strings so it doesn't need to import
  // the enum — we do the conversion here at the scene boundary.
  const gridVisiblePlanes = $derived(viewer3DState.visiblePlanes as Set<Plane>);

  // Read background type from settings for themed 3D environment
  const backgroundType = $derived.by((): BackgroundType => {
    try {
      const settings = container.items.settingsState;
      return (settings as any)?.settings?.backgroundType ?? BackgroundType.SOLID_COLOR;
    } catch { return BackgroundType.SOLID_COLOR; }
  });

  const hasEnvironment = $derived(
    backgroundType !== BackgroundType.SOLID_COLOR &&
    backgroundType !== BackgroundType.LINEAR_GRADIENT
  );

  // Night environments need reduced default lighting since the environment provides its own
  const isNightEnvironment = $derived(
    backgroundType === BackgroundType.FIREFLY_FOREST ||
    backgroundType === BackgroundType.NIGHT_SKY ||
    backgroundType === BackgroundType.DEEP_OCEAN
  );
</script>

<!-- Environment (no STAGE_LIFT wrapper — sits at ground level) -->
{#if hasEnvironment}
  <Environment3D {backgroundType} />
{/if}

<!-- Lighting — reduced when the environment provides its own -->
<T.AmbientLight intensity={isNightEnvironment ? 0.2 : hasEnvironment ? 0.3 : 0.4} />
<T.DirectionalLight position={[5, 10, 5]} intensity={isNightEnvironment ? 0.4 : hasEnvironment ? 0.6 : 0.8} />

<!-- Ground disc (only when no environment provides its own ground) -->
{#if !hasEnvironment}
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.CircleGeometry args={[2, 64]} />
    <T.MeshStandardMaterial color="#1a1a2e" />
  </T.Mesh>
{/if}

<!-- Single PerformerRig replaces all sibling wiring (avatar, grid, props, effects) -->
<PerformerRig
  position={{ x: 0, z: 0 }}
  {facingAngle}
  planeMode={avatarState.planeMode}
  {avatarState}
  showGrid={viewer3DState.showGrid}
  visiblePlanes={gridVisiblePlanes}
  gridMode={(sequenceData?.gridMode ?? "diamond") as import("../domain/constants/grid-layout").GridMode}
  {bluePropType}
  {redPropType}
  {bluePropState}
  {redPropState}
  tipEffectMap={globalTipEffectMap}
  {isPlaying}
/>
