<!-- StartTile.svelte - Reusable start position tile for all grid modes -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import StepCell from "./StepCell.svelte";

  let {
    startPosition,
    shouldAnimate = false,
    isSelected = false,
    isPracticeStep = false,
    activeMode = null,
    onStartClick,
    onLongPress,
    onDelete,
    animationEpoch = 0,
    isTimelineMode = false,
  } = $props<{
    startPosition: StartPositionData | StepData;
    shouldAnimate?: boolean;
    isSelected?: boolean;
    isPracticeStep?: boolean;
    activeMode?: BuildModeId | null;
    onStartClick?: () => void;
    onLongPress?: (stepNumber: number) => void;
    onDelete?: (stepNumber: number) => void;
    animationEpoch?: number;
    isTimelineMode?: boolean;
  }>();

  const hapticService: HapticFeedback | null = getHapticFeedback();

  function handleStartClick() {
    hapticService?.trigger("selection");
    onStartClick?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleStartClick();
    } else if (e.key === " ") {
      // Prevent browser default click, let global shortcuts handle Space
      e.preventDefault();
    }
  }
</script>

<div
  class="start-tile"
  class:has-pictograph={true}
  title="Start Position"
  role="button"
  tabindex="0"
  onclick={handleStartClick}
  onkeydown={handleKeydown}
  aria-label="Start Position"
>
  <StepCell
    step={startPosition}
    index={-1}
    {shouldAnimate}
    {isSelected}
    {isPracticeStep}
    {activeMode}
    onLongPress={onLongPress}
    onDelete={() => onDelete?.(0)}
    {isTimelineMode}
    {animationEpoch}
  />
</div>

<style>
  .start-tile {
    margin: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }
</style>
