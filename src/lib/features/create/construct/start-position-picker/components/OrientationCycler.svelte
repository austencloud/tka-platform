<!--
OrientationCycler.svelte - Orientation trigger button
Tap to open the orientation picker drawer (mounted at CreateModule level).
-->
<script lang="ts">
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { orientationPickerState } from "../state/orientation-picker-state.svelte";

  interface Props {
    orientation: Orientation;
    onOrientationChange: (orientation: Orientation) => void;
    color?: "blue" | "red";
  }

  const { orientation, onOrientationChange, color }: Props = $props();

  const ORIENTATION_DISPLAY: Record<string, { label: string; icon: string }> = {
    [Orientation.IN]: { label: "In", icon: "fa-compress-arrows-alt" },
    [Orientation.CLOCK]: { label: "Clock", icon: "fa-redo" },
    [Orientation.OUT]: { label: "Out", icon: "fa-expand-arrows-alt" },
    [Orientation.COUNTER]: { label: "Counter", icon: "fa-undo" },
  };

  const currentDisplay = $derived(
    ORIENTATION_DISPLAY[orientation] ?? ORIENTATION_DISPLAY[Orientation.IN]!
  );

  const colorLabel = $derived(color === "blue" ? "Blue" : color === "red" ? "Red" : "");

  function handleClick() {
    orientationPickerState.open(
      color ?? "blue",
      orientation,
      onOrientationChange
    );
  }
</script>

<button
  class="orientation-trigger"
  class:color-blue={color === "blue"}
  class:color-red={color === "red"}
  onclick={handleClick}
  aria-label="{colorLabel} orientation: {currentDisplay.label}. Tap to change."
>
  <i class="fas {currentDisplay.icon}" aria-hidden="true"></i>
  <span class="trigger-label">{currentDisplay.label}</span>
</button>

<style>
  .orientation-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    min-height: var(--min-touch-target, 48px);
    padding: 10px 16px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 12px;
    font-size: var(--font-size-min);
    font-weight: 600;
    color: var(--theme-text);
    letter-spacing: 0.3px;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.15s ease;
  }

  .orientation-trigger i {
    font-size: 14px;
    opacity: 0.85;
  }

  .orientation-trigger.color-blue {
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.08);
  }

  .orientation-trigger.color-red {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
  }

  @media (hover: hover) {
    .orientation-trigger:hover {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      transform: translateY(-1px);
    }
  }

  .orientation-trigger:active {
    transform: translateY(0) scale(0.98);
    transition: transform var(--duration-instant) ease;
  }

  .orientation-trigger:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @container (max-width: 500px) {
    .orientation-trigger {
      padding: 8px 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .orientation-trigger {
      transition: none;
    }

    .orientation-trigger:hover,
    .orientation-trigger:active {
      transform: none;
    }
  }
</style>
