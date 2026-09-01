<!-- Gives responsive layout tests explicit picker dimensions and workspace mode. -->
<script lang="ts">
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { TurnLevel } from "$lib/shared/create/services/level-turn-values";
  import OptionPickerContent from "./OptionPickerContent.svelte";

  const {
    width = 900,
    height = 700,
    sideBySide = true,
    topOffset = 0,
    level = 2,
  } = $props<{
    width?: number;
    height?: number;
    sideBySide?: boolean;
    topOffset?: number;
    level?: TurnLevel;
  }>();
</script>

<div
  class="harness"
  style:width={`${width}px`}
  style:height={`${height}px`}
  style:margin-top={`${topOffset}px`}
>
  <OptionPickerContent
    options={[]}
    organizerService={() => []}
    sizerService={() => ({
      pictographSize: 80,
      pictographSizeString: "80px",
      gridGap: "8px",
      deviceConfig: {
        padding: { horizontal: 8, vertical: 8 },
        gap: 8,
        minItemSize: 60,
        maxItemSize: 120,
        scaleFactor: 1,
      },
    })}
    onSelect={() => {}}
    isSideBySideLayout={() => sideBySide}
    leftTurns={0}
    rightTurns={0}
    {level}
    onLevelChange={() => {}}
    leftRotation={RotationDirection.CLOCKWISE}
    rightRotation={RotationDirection.CLOCKWISE}
    onLeftTurnsChange={() => {}}
    onRightTurnsChange={() => {}}
    onLeftRotationChange={() => {}}
    onRightRotationChange={() => {}}
  />
</div>

<style>
  .harness {
    --min-touch-target: 44px;
    --theme-panel-bg: #ffffff;
    --theme-card-bg: #f3f4f6;
    --theme-card-hover-bg: #e5e7eb;
    --theme-stroke: #9ca3af;
    --theme-stroke-strong: #6b7280;
    --theme-text: #111827;
    --theme-text-dim: #4b5563;
    --theme-accent: #6d28d9;
  }
</style>
