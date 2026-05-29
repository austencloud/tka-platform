<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { MotionType, MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { getPathD } from "$lib/features/hand-paths/hand-path-builder/services/hand-path-animator";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { getMotionColor } from "$lib/shared/utils/svg-color-utils";

  let {
    sequenceData = null,
    currentStep = 0,
  }: {
    sequenceData?: SequenceData | null;
    currentStep?: number;
  } = $props();

  function resolvePathTypeForMotion(motion: MotionData): "arc" | "linear" | "concave" {
    if (motion.pathShape) return motion.pathShape;
    if (motion.motionType === MotionType.DASH) return "linear";
    if (motion.motionType === MotionType.STATIC) return "arc";

    const vm = getAnimationVisibilityManager();
    if (vm.getMotionAwarePaths()) {
      if (motion.motionType === MotionType.PRO) return "arc";
      if (motion.motionType === MotionType.ANTI) return "concave";
    }
    return vm.getPathShape();
  }

  function buildPathD(motion: MotionData): string | null {
    if (motion.startLocation === motion.endLocation) return null;
    if (motion.motionType === MotionType.STATIC) return null;
    const pathType = resolvePathTypeForMotion(motion);
    return getPathD(motion.startLocation, motion.endLocation, pathType);
  }

  const stepIndex = $derived(Math.floor(currentStep) - 1);

  const currentStepData = $derived.by(() => {
    if (!sequenceData?.steps?.length) return null;
    if (stepIndex < 0 || stepIndex >= sequenceData.steps.length) return null;
    return sequenceData.steps[stepIndex] ?? null;
  });

  const bluePathD = $derived.by(() => {
    const motion = currentStepData?.motions?.blue;
    return motion ? buildPathD(motion) : null;
  });

  const redPathD = $derived.by(() => {
    const motion = currentStepData?.motions?.red;
    return motion ? buildPathD(motion) : null;
  });

  const blueColor = $derived(getMotionColor(MotionColor.BLUE, "dark"));
  const redColor = $derived(getMotionColor(MotionColor.RED, "dark"));
  const hasAnyPath = $derived(bluePathD !== null || redPathD !== null);
</script>

{#if hasAnyPath}
  <svg class="path-lines-overlay" viewBox="0 0 950 950" preserveAspectRatio="xMidYMid meet">
    {#if bluePathD}
      <path
        d={bluePathD}
        fill="none"
        stroke={blueColor}
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="8 6"
        opacity="0.5"
      />
    {/if}
    {#if redPathD}
      <path
        d={redPathD}
        fill="none"
        stroke={redColor}
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="8 6"
        opacity="0.5"
      />
    {/if}
  </svg>
{/if}

<style>
  .path-lines-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 4;
    pointer-events: none;
  }
</style>
