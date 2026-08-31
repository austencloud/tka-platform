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
  import { tryGetOptionAuditionContext } from "../context/option-audition-context";
  import { createHoldToAuditionAttachment } from "../services/hold-to-audition";

  interface Props {
    pictograph: PreparedPictographData;
    size: number;
    disabled?: boolean;
    leftReversal?: boolean;
    rightReversal?: boolean;
    isContinuation?: boolean;
    onSelect: (pictograph: PreparedPictographData) => void;
  }

  const {
    pictograph,
    size,
    disabled = false,
    leftReversal = false,
    rightReversal = false,
    isContinuation = false,
    onSelect,
  }: Props = $props();

  const borderColors = $derived(getLetterBorderColors(pictograph.letter));
  const auditionContext = tryGetOptionAuditionContext();
  const holdToAudition = createHoldToAuditionAttachment({
    isDisabled: () => disabled || !auditionContext,
    onStart: () => auditionContext?.start(pictograph) ?? false,
    onEnd: () => auditionContext?.end(),
  });

  let contextMenuHost: PictographContextMenuHost;

  /*
   * data-ghost-label carries JUST the letter. The presentation-mode ghost
   * narrates the control it is about to press, and with only an aria-label to
   * read it thought out loud in UI copy — "What does Add M. Hold to preview.
   * do?" A label is what a person would call the thing, not what a screen
   * reader says about it.
   */

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
  data-ghost="safe"
  data-ghost-kind="option"
  data-ghost-label={pictograph.letter}
  aria-label="Add {pictograph.letter}. Hold to preview."
  aria-keyshortcuts="Shift+Space"
  title="Tap to add. Hold to preview."
  {@attach holdToAudition}
>
  <OptionCardContent {pictograph} {leftReversal} {rightReversal} />
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
    box-shadow: var(--option-card-shadow);
    transition:
      transform 0.3s ease,
      filter 0.3s ease,
      box-shadow 0.3s ease;
    touch-action: manipulation;
    -webkit-touch-callout: none;
    user-select: none;
  }

  .option-card:disabled {
    cursor: not-allowed;
    pointer-events: none;
  }

  @media (hover: hover) {
    .option-card:hover {
      transform: scale(1.05);
      filter: brightness(1.05);
      box-shadow: var(--option-card-shadow-hover);
    }
  }

  .option-card:active {
    transform: scale(0.97);
    transition: transform var(--duration-instant) ease;
  }

  .option-card:global(.option-audition-active) {
    z-index: 4;
    transform: translateY(-6px) scale(1.08);
    filter: brightness(1.08);
    box-shadow:
      0 0 0 3px
        color-mix(in srgb, var(--theme-accent, #3b82f6) 70%, transparent),
      0 14px 28px -14px
        color-mix(in srgb, var(--border-primary) 70%, transparent),
      var(--option-card-shadow-hover);
    transition:
      transform 320ms cubic-bezier(0.2, 1.55, 0.35, 1),
      filter 160ms ease,
      box-shadow 160ms ease;
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
      var(--option-card-shadow);
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

    .option-card:global(.option-audition-active) {
      transform: none;
      filter: brightness(1.08);
      transition: none;
    }
  }
</style>
