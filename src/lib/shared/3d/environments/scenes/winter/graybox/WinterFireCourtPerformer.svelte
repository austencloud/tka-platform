<script lang="ts">
  /**
   * One live fire-court performer composed from the canonical avatar, prop,
   * sequence-playback, and 3D effect owners.
   */
  import { onDestroy, untrack } from "svelte";
  import {
    PerformerRig,
    Plane,
    PlaneMode,
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
    stationId: string;
    worldX: number;
    worldZ: number;
    facingAngle: number;
    surfaceElevation: number;
    avatarId: AvatarId;
    propType: PropType;
    sequence: SequenceData;
    onReady?: () => void;
  }

  const props: Props = $props();
  const fireTipMap = buildTipEffectMap("fire");
  const performerState = createAvatarInstanceState(
    {
      id: `winter-fire-court-${props.stationId}`,
      positionX: props.worldX,
      positionZ: props.worldZ,
    },
    makeStandaloneDeps()
  );
  let readyReported = false;

  $effect(() => {
    const sequence = props.sequence;
    untrack(() => {
      performerState.loadSequence(sequence);
      performerState.loop = true;
      performerState.play();
    });
  });

  onDestroy(() => performerState.destroy());
</script>

<PerformerRig
  position={{ x: props.worldX, z: props.worldZ }}
  facingAngle={props.facingAngle}
  planeMode={PlaneMode.WALL}
  avatarState={performerState}
  avatarId={props.avatarId}
  showGrid={false}
  visiblePlanes={new Set([Plane.WALL])}
  bluePropType={toScenePropType(props.propType)}
  redPropType={toScenePropType(props.propType)}
  groundOffset={props.surfaceElevation}
  enableFootPlanting={true}
  showEffects={true}
  tipEffectMap={fireTipMap}
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
      {isPlaying}
      {staffHalfLength}
      tipEffectMap={fireTipMap}
      {blueHandPos}
      {redHandPos}
      {effectsParentRef}
      currentStep={performerState.currentStepIndex + performerState.progress}
    />
  {/snippet}
</PerformerRig>
