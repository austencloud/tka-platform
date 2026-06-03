<!--
OptionCard.svelte - Single clickable option in the picker grid

Single responsibility: Render one pictograph option as a clickable card.
Receives pre-calculated data, just renders it.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/prepared-pictograph-data";
  import { getLetterBorderColors } from "$lib/shared/pictograph/shared/utils/letter-border-utils";
  import OptionCardContent from "./OptionCardContent.svelte";
  import PictographContextMenuHost from "$lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte";

  interface Props {
    pictograph: PreparedPictographData;
    size: number;
    disabled?: boolean;
    blueReversal?: boolean;
    redReversal?: boolean;
    isContinuation?: boolean;
    onSelect: (pictograph: PreparedPictographData) => void;
  }

  const {
    pictograph,
    size,
    disabled = false,
    blueReversal = false,
    redReversal = false,
    isContinuation = false,
    onSelect,
  }: Props = $props();

  const borderColors = $derived(getLetterBorderColors(pictograph.letter));

  let contextMenuHost: PictographContextMenuHost;

  function handleClick() {
    if (!disabled) {
      onSelect(pictograph);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuHost.openContextMenu(e.clientX, e.clientY);
  }
</script>

<button
  class="option-card"
  class:continuation={isContinuation}
  onclick={handleClick}
  oncontextmenu={handleContextMenu}
  {disabled}
  style:width="{size}px"
  style:height="{size}px"
  style:--border-primary={borderColors.primary}
  style:--border-secondary={borderColors.secondary}
  data-testid="option-card"
  data-letter={pictograph.letter}
  aria-label="Select {pictograph.letter}"
>
  <OptionCardContent {pictograph} {blueReversal} {redReversal} />
</button>

<PictographContextMenuHost bind:this={contextMenuHost} />

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
    transition: transform var(--duration-instant) ease;
  }

  .option-card:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
    filter: brightness(1.05);
  }

  /* Continuation indicator - subtle accent border when this option continues the hand path */
  .option-card.continuation {
    box-shadow:
      0 0 0 2px var(--theme-accent, #3b82f6),
      0 1px 2px rgba(0, 0, 0, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.06);
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .option-card {
      transition: none;
    }

    .option-card:hover {
      transform: none;
    }

    .option-card:active {
      transform: scale(0.97);
    }
  }
</style>
