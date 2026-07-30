<!--
  OptionPickerControlsPopover.svelte

  Continuous compact layouts have no letter-type header, so their settings
  remain in this anchored popover. Sectioned swipe layouts render the same
  OptionPickerHeader inside their shared utility tray instead.
-->
<script lang="ts">
  import { Popover } from "bits-ui";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import type { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    formatTurnValue,
    type TurnLevel,
    type TurnValue,
  } from "$lib/shared/create/services/level-turn-values";
  import OptionPickerHeader from "./OptionPickerHeader.svelte";
  import OptionPickerIconButton from "./OptionPickerIconButton.svelte";

  interface Props {
    showFilter: boolean;
    showTurnControls?: boolean;
    isContinuousOnly: boolean;
    onToggleContinuous?: (value: boolean) => void;
    level: TurnLevel;
    onLevelChange: (level: TurnLevel) => void;
    blueTurns: TurnValue;
    redTurns: TurnValue;
    blueRotation: RotationDirection;
    redRotation: RotationDirection;
    onBlueChange: (value: TurnValue) => void;
    onRedChange: (value: TurnValue) => void;
    onBlueRotationChange: (dir: RotationDirection) => void;
    onRedRotationChange: (dir: RotationDirection) => void;
    open?: boolean;
    triggerDensity?: "standard" | "compact";
  }

  let {
    showFilter,
    showTurnControls = true,
    isContinuousOnly,
    onToggleContinuous,
    level,
    onLevelChange,
    blueTurns,
    redTurns,
    blueRotation,
    redRotation,
    onBlueChange,
    onRedChange,
    onBlueRotationChange,
    onRedRotationChange,
    open = $bindable(false),
    triggerDensity = "standard",
  }: Props = $props();

  const modeLabel = $derived(isContinuousOnly ? "Continuous" : "All");
  const blueTurnLabel = $derived(formatTurnValue(blueTurns));
  const redTurnLabel = $derived(formatTurnValue(redTurns));

  const triggerLabel = $derived.by(() => {
    const details = ["Option settings"];
    if (showFilter) details.push(`Showing ${modeLabel.toLowerCase()}`);
    if (showTurnControls) {
      details.push(`Level ${level}`);
      details.push(`Blue turns ${blueTurnLabel}`);
      details.push(`Red turns ${redTurnLabel}`);
    }
    return details.join(". ");
  });
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <OptionPickerIconButton
        {...props}
        icon="fa-sliders"
        density={triggerDensity}
        active={open}
        aria-label={triggerLabel}
        title="Option settings"
      />
    {/snippet}
  </Popover.Trigger>

  <Popover.Portal>
    <Popover.Overlay
      class="controls-overlay"
      data-testid="option-settings-overlay"
    />

    <Popover.Content
      side="top"
      align="start"
      sideOffset={6}
      avoidCollisions={true}
      collisionPadding={8}
      forceMount
    >
      {#snippet child({ open: contentOpen, wrapperProps, props })}
        <div {...wrapperProps}>
          {#if contentOpen}
            <div
              {...props}
              class="controls-popover themed-scrollbar"
              role="dialog"
              aria-label="Option settings"
              transition:flyFade={{ y: 8, duration: DURATION.normal }}
            >
              <!-- Visible close: the trigger toggle / Escape / backdrop tap all
                   dismiss, but none is discoverable. An ✕ top-right is the
                   affordance an average user looks for first. Sticky so it stays
                   reachable while the Level 3 palette scrolls. -->
              <div class="popover-topbar">
                <button
                  type="button"
                  class="popover-close"
                  aria-label="Close option settings"
                  title="Close"
                  onclick={() => (open = false)}
                >
                  <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
              </div>

              <OptionPickerHeader
                layout="compact"
                {showFilter}
                {showTurnControls}
                {isContinuousOnly}
                {onToggleContinuous}
                {level}
                {onLevelChange}
                {blueTurns}
                {redTurns}
                {blueRotation}
                {redRotation}
                {onBlueChange}
                {onRedChange}
                {onBlueRotationChange}
                {onRedRotationChange}
              />
            </div>
          {/if}
        </div>
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
  .controls-popover {
    width: min(
      32rem,
      var(--bits-popover-content-available-width, calc(100vw - 16px))
    );
    max-height: min(
      26rem,
      var(--bits-popover-content-available-height, calc(100dvh - 16px))
    );
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    background: var(--theme-panel-bg, rgba(10, 18, 30, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: var(--radius-xl, 16px);
    box-shadow:
      0 18px 48px var(--theme-shadow, rgba(0, 0, 0, 0.58)),
      inset 0 1px 0
        color-mix(in srgb, var(--theme-accent, #22b8db) 24%, transparent);
    transform-origin: var(
      --bits-popover-content-transform-origin,
      bottom center
    );
    z-index: var(--z-dropdown, 1000);
  }

  /* Sticky close bar. Shares the panel wash so the palette scrolls under it. */
  .popover-topbar {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 6px 6px 0;
    background: var(--theme-panel-bg, rgba(10, 18, 30, 0.98));
  }

  /* Reads as a button, not a bare glyph: subtle fill + border + hover. */
  .popover-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    padding: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: var(--radius-md, 10px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .popover-close:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.24));
    color: var(--theme-text, #fff);
  }

  .popover-close:active {
    transform: scale(0.94);
  }

  .popover-close:focus-visible {
    outline: 2px solid var(--theme-accent, #22b8db);
    outline-offset: -2px;
  }

  .popover-close i {
    font-size: 1.05rem;
  }

  /* Portaling the veil with the panel lets it cover the workspace above the
     picker instead of being clipped to the option grid's own bounds. */
  :global(.controls-overlay) {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-dropdown, 1000) - 1);
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.48) 0%,
      rgba(0, 0, 0, 0.34) 52%,
      rgba(0, 0, 0, 0.24) 100%
    );
    opacity: 1;
    transition: opacity var(--duration-normal, 200ms) ease-out;
  }

  :global(.controls-overlay[data-starting-style]),
  :global(.controls-overlay[data-ending-style]) {
    opacity: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .popover-close {
      transition: none;
    }

    .popover-close:active {
      transform: none;
    }

    :global(.controls-overlay) {
      transition: none;
    }
  }
</style>
