<!--
OptionCard.svelte - Single clickable option in the picker grid

Single responsibility: Render one pictograph option as a clickable card.
Receives pre-calculated data, just renders it.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/PreparedPictographData";
  import { getLetterBorderColors } from "$lib/shared/pictograph/shared/utils/letter-border-utils";
  import OptionCardContent from "./OptionCardContent.svelte";

  interface Props {
    pictograph: PreparedPictographData;
    size: number;
    disabled?: boolean;
    blueReversal?: boolean;
    redReversal?: boolean;
    onSelect: (pictograph: PreparedPictographData) => void;
  }

  const {
    pictograph,
    size,
    disabled = false,
    blueReversal = false,
    redReversal = false,
    onSelect,
  }: Props = $props();

  const borderColors = $derived(getLetterBorderColors(pictograph.letter));

  function handleClick() {
    if (!disabled) {
      onSelect(pictograph);
    }
  }
</script>

<button
  class="option-card"
  onclick={handleClick}
  {disabled}
  style:width="{size}px"
  style:height="{size}px"
  style:--border-primary={borderColors.primary}
  style:--border-secondary={borderColors.secondary}
  data-testid="option-card"
  data-letter={pictograph.letter}
>
  <OptionCardContent {pictograph} {blueReversal} {redReversal} />
</button>

<style>
  .option-card {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.06);
    transition:
      transform 0.3s ease,
      filter 0.3s ease,
      box-shadow 0.3s ease;
  }

  .option-card:disabled {
    cursor: not-allowed;
    pointer-events: none;
  }

  @media (hover: hover) {
    .option-card:hover {
      transform: scale(1.05);
      filter: brightness(1.05);
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.12),
        0 4px 8px rgba(0, 0, 0, 0.08),
        0 8px 16px rgba(0, 0, 0, 0.06);
    }
  }

  .option-card:active {
    transform: scale(0.97);
    transition: transform 0.1s ease;
  }

  .option-card:focus {
    outline: none;
    filter: brightness(1.05);
  }
</style>
