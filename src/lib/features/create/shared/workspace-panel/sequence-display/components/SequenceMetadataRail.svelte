<script lang="ts">
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { analyzeDifficulty } from "$lib/shared/browse/services/sequence-difficulty-calculator";
  import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type {
    LOOPType,
    Period,
  } from "$lib/shared/foundation/domain/models/generation/circular-models";

  let {
    sequence = null,
    loopType = null,
    period = null,
  } = $props<{
    sequence?: SequenceData | null;
    loopType?: LOOPType | null;
    period?: Period | null;
  }>();

  const hasSteps = $derived((sequence?.steps.length ?? 0) > 0);
  const difficultyLevel = $derived(
    analyzeDifficulty(sequence ? [...sequence.steps] : []).level
  );
  const loopComponents = $derived(parseLoopComponents(loopType));
  const hasLoop = $derived(loopComponents.size > 0);
</script>

<div class="metadata-rail" aria-label="Sequence metadata">
  <div
    class="difficulty-slot"
    class:visible={hasSteps}
    aria-hidden={!hasSteps}
    aria-label="Difficulty level {difficultyLevel}"
  >
    <DifficultyBadge level={difficultyLevel} size="20px" fontSize="12px" />
  </div>

  <div class="loop-slot" class:visible={hasLoop} aria-hidden={!hasLoop}>
    <LOOPIconStrip
      activeComponents={loopComponents}
      rotationPeriod={period ?? undefined}
      inversionPeriod={period ?? undefined}
      size={18}
      darkMode={true}
      showFreeformWhenEmpty={false}
    />
  </div>
</div>

<style>
  .metadata-rail {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    height: 20px;
    flex: 0 0 20px;
  }

  .difficulty-slot,
  .loop-slot {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    visibility: hidden;
    opacity: 0;
  }

  .difficulty-slot.visible,
  .loop-slot.visible {
    position: relative;
    visibility: visible;
    opacity: 1;
  }

  .difficulty-slot {
    width: 20px;
  }

  .loop-slot {
    min-width: 18px;
    width: max-content;
    line-height: 1;
  }

  .loop-slot :global(.loop-icon-strip) {
    line-height: 1;
  }
</style>
