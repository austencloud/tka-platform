<script lang="ts">
  /**
   * A world-space performer whose avatar, hands, props, and tip effects all
   * come from the production sequence stack.
   */
  import { onDestroy, untrack } from "svelte";
  import {
    PerformerRig,
    Plane,
    PlaneMode,
    userProportionsState,
    type AvatarId,
  } from "@austencloud/scene-3d";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    createAvatarInstanceState,
    makeStandaloneDeps,
  } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";
  import { buildTipEffectMap } from "$lib/shared/animation-engine/domain/tip-effect-map";
  import EffectOrchestrator3D from "$lib/shared/3d/effects/EffectOrchestrator3D.svelte";

  interface Props {
    id: string;
    position: { x: number; y: number; z: number };
    facingAngle: number;
    avatarId: AvatarId;
    propType: PropType;
    sequence: SequenceData;
    effectId: string;
    effectQualityTier?: "low" | "medium" | "high";
    phaseOffsetSteps?: number;
    playbackSpeed?: number;
    active?: boolean;
    onReady?: () => void;
  }

  const props: Props = $props();
  const tipEffectMap = $derived(buildTipEffectMap(props.effectId));
  const rigGroundOffset = $derived(
    props.position.y - userProportionsState.groundY
  );
  const performerState = createAvatarInstanceState(
    {
      id: props.id,
      positionX: props.position.x,
      positionZ: props.position.z,
      avatarModelId: props.avatarId,
      persistent: false,
    },
    makeStandaloneDeps()
  );
  let readyReported = false;

  $effect(() => {
    const sequence = props.sequence;
    const phase = props.phaseOffsetSteps ?? 0;
    untrack(() => {
      performerState.loadSequence(sequence);
      performerState.loop = true;
      if (sequence.steps.length > 0) {
        const wrapped =
          ((phase % sequence.steps.length) + sequence.steps.length) %
          sequence.steps.length;
        performerState.goToStep(Math.floor(wrapped));
        performerState.setProgress(wrapped - Math.floor(wrapped));
      }
      performerState.speed = props.playbackSpeed ?? 1;
      if (props.active !== false) performerState.play();
    });
  });

  $effect(() => {
    const active = props.active !== false;
    const speed = props.playbackSpeed ?? 1;
    untrack(() => {
      performerState.speed = speed;
      if (active) performerState.play();
      else performerState.pause();
    });
  });

  onDestroy(() => performerState.destroy());
</script>

<PerformerRig
  position={{ x: props.position.x, z: props.position.z }}
  facingAngle={props.facingAngle}
  planeMode={PlaneMode.WALL}
  avatarState={performerState}
  avatarId={props.avatarId}
  showGrid={false}
  visiblePlanes={new Set([Plane.WALL])}
  bluePropType={toScenePropType(props.propType)}
  redPropType={toScenePropType(props.propType)}
  groundOffset={rigGroundOffset}
  enableLocomotion={true}
  enableFootPlanting={true}
  showEffects={true}
  {tipEffectMap}
  isPlaying={performerState.isPlaying}
  onAvatarSwapped={() => {
    if (readyReported) return;
    readyReported = true;
    props.onReady?.();
  }}
>
  {#snippet effectsSlot({
    bluePropState,
    redPropState,
    blueHandPos,
    redHandPos,
    isPlaying,
    staffHalfLength,
    effectsParentRef,
  })}
    <EffectOrchestrator3D
      {bluePropState}
      {redPropState}
      bluePropType={toScenePropType(props.propType)}
      redPropType={toScenePropType(props.propType)}
      {isPlaying}
      {staffHalfLength}
      {tipEffectMap}
      {blueHandPos}
      {redHandPos}
      {effectsParentRef}
      currentStep={performerState.currentStepIndex + performerState.progress}
      totalSteps={performerState.totalSteps}
      seamlesslyLoopable={performerState.isCircular}
      qualityTierOverride={props.effectQualityTier}
    />
  {/snippet}
</PerformerRig>
