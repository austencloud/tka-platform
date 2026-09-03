<script lang="ts">
  /**
   * A world-space performer whose character, hands, props, and tip effects all
   * come from the production sequence stack.
   */
  import { onDestroy, untrack, type Snippet } from "svelte";
  import {
    cmToUnits,
    PerformerRig,
    Plane,
    PlaneMode,
    userProportionsState,
  } from "@austencloud/scene-3d";
  import type {
    AvatarGripDiagnostics,
    AvatarPoseDiagnostics,
    CollisionEvent,
  } from "@austencloud/scene-3d";
  import type { CharacterId } from "$lib/shared/3d/domain/character-model";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    createCharacterInstanceState,
    makeStandaloneDeps,
  } from "$lib/shared/3d/state/character-instance-state.svelte";
  import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";
  import { planUpperBodyStanceForPropStates } from "$lib/shared/3d/collision/upper-body-stance-planner";
  import {
    fitStaffLengthForHug,
    measurePerformerReach,
    type PerformerReachMeasurements,
  } from "$lib/shared/3d/domain/performer-reach-measurements";
  import { buildTipEffectMap } from "$lib/shared/animation-engine/domain/tip-effect-map";
  import EffectOrchestrator3D from "$lib/shared/3d/effects/EffectOrchestrator3D.svelte";

  interface Props {
    id: string;
    position: { x: number; y: number; z: number };
    facingAngle: number;
    characterId: CharacterId;
    propType: PropType;
    sequence: SequenceData;
    effectId: string;
    effectQualityTier?: "low" | "medium" | "high";
    phaseOffsetSteps?: number;
    playbackSpeed?: number;
    active?: boolean;
    weldGrip?: boolean;
    showEffects?: boolean;
    enableLocomotion?: boolean;
    enableFootPlanting?: boolean;
    /**
     * Scene markers drawn inside the rig's own root group, so they inherit the
     * performer's world position, ground offset, and facing instead of sitting
     * at the world origin. Hosts pass the same wrapper the sequence viewer
     * uses: a group at GRID_OFFSETS[planeMode] around Grid3D.
     */
    gridSlot?: Snippet;
    onReady?: () => void;
    onCollisionEvents?: (
      events: CollisionEvent[],
      diagnostics: AvatarPoseDiagnostics,
      gripDiagnostics: AvatarGripDiagnostics
    ) => void;
  }

  const props: Props = $props();
  const tipEffectMap = $derived(buildTipEffectMap(props.effectId));
  const rigGroundOffset = $derived(
    props.position.y - userProportionsState.groundY
  );
  const performerState = createCharacterInstanceState(
    {
      id: props.id,
      positionX: props.position.x,
      positionZ: props.position.z,
      characterId: props.characterId,
      persistent: false,
    },
    makeStandaloneDeps()
  );
  // Measured off the rig's own skeleton the first frame the arm chains report
  // real lengths. Held rather than re-derived per frame so the prop length and
  // the hug lane stay stable while the arms move.
  let reachMeasurements = $state<PerformerReachMeasurements | null>(null);
  const staffFit = $derived(
    reachMeasurements ? fitStaffLengthForHug(reachMeasurements) : null
  );
  // A body that cannot hold any supported staff keeps the global default
  // rather than rendering a nonsense prop; the fit result says so explicitly.
  const propLength = $derived(
    staffFit?.fits ? cmToUnits(staffFit.recommendedStaffLengthCm) : undefined
  );
  const upperBodyStance = $derived(
    planUpperBodyStanceForPropStates(
      PlaneMode.WALL,
      performerState.leftPropState,
      performerState.rightPropState,
      reachMeasurements
    )
  );
  let readyReported = false;

  function captureReach(diagnostics: AvatarPoseDiagnostics): void {
    if (reachMeasurements) return;
    const measured = measurePerformerReach({
      leftUpperArmM: diagnostics.leftUpperArmLength,
      leftForearmM: diagnostics.leftForearmLength,
      rightUpperArmM: diagnostics.rightUpperArmLength,
      rightForearmM: diagnostics.rightForearmLength,
      shoulderWidthM: diagnostics.shoulderWidth,
    });
    if (measured) reachMeasurements = measured;
  }

  $effect(() => {
    const sequence = props.sequence;
    const phase = props.phaseOffsetSteps;
    untrack(() => {
      performerState.loadSequence(sequence);
      performerState.loop = true;
      if (phase == null) {
        performerState.goToStep(0);
      } else if (sequence.steps.length > 0) {
        const wrapped =
          ((phase % sequence.steps.length) + sequence.steps.length) %
          sequence.steps.length;
        // A live phase is motion-relative: 0.00 is the beginning of beat 1 and
        // 7.99 the end of beat 8. The state owner says where beat 1 lives,
        // because it reserves index 0 for a static start pose when one exists.
        performerState.goToStep(
          Math.floor(wrapped) + performerState.motionStepOffset
        );
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
  avatarId={props.characterId}
  showGrid={props.gridSlot != null}
  visiblePlanes={new Set([Plane.WALL])}
  bluePropType={toScenePropType(props.propType)}
  redPropType={toScenePropType(props.propType)}
  bluePropState={performerState.leftPropState}
  redPropState={performerState.rightPropState}
  groundOffset={rigGroundOffset}
  enableLocomotion={props.enableLocomotion ?? true}
  enableFootPlanting={props.enableFootPlanting ?? true}
  weldGrip={props.weldGrip ?? false}
  {propLength}
  headDodge={true}
  stanceYaw={upperBodyStance.yawRad}
  spinePitchOffset={upperBodyStance.pitchRad}
  blueHandDepthOffset={upperBodyStance.leftDepthOffsetM}
  redHandDepthOffset={upperBodyStance.rightDepthOffsetM}
  showEffects={props.showEffects ?? true}
  {tipEffectMap}
  isPlaying={performerState.isPlaying}
  onCollisionEvents={(events, diagnostics, gripDiagnostics) => {
    captureReach(diagnostics);
    props.onCollisionEvents?.(events, diagnostics, gripDiagnostics);
  }}
  gridSlot={props.gridSlot}
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
    {#if props.showEffects !== false}
      <EffectOrchestrator3D
        leftPropState={bluePropState}
        rightPropState={redPropState}
        leftPropType={toScenePropType(props.propType)}
        rightPropType={toScenePropType(props.propType)}
        {isPlaying}
        {staffHalfLength}
        {tipEffectMap}
        leftHandPos={blueHandPos}
        rightHandPos={redHandPos}
        {effectsParentRef}
        currentStep={performerState.currentStepIndex + performerState.progress}
        totalSteps={performerState.totalSteps}
        seamlesslyLoopable={performerState.isCircular}
        qualityTierOverride={props.effectQualityTier}
      />
    {/if}
  {/snippet}
</PerformerRig>
