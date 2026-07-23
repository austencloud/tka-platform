<!--
CodexControlPanel - Modern control panel for codex operations

Provides sleek control buttons and orientation selector for
rotating, mirroring, and color-swapping pictographs.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  // Props
  let {
    onRotate,
    onMirror,
    onColorSwap,
    onOrientationChange,
    currentOrientation = "Diamond",
    showOrientation = true,
  } = $props<{
    onRotate?: () => void;
    onMirror?: () => void;
    onColorSwap?: () => void;
    onOrientationChange?: (orientation: string) => void;
    currentOrientation?: string;
    showOrientation?: boolean;
  }>();

  // Services
  const hapticService = getHapticFeedback();

  // Available orientations (matches desktop options)
  const orientationOptions = [
    { value: "Diamond", label: "Diamond" },
    { value: "Box", label: "Box" },
    { value: "Skewed", label: "Skewed" },
  ];

  // Handle orientation change
  function handleOrientationChange(orientation: string) {
    hapticService?.trigger("selection");
    onOrientationChange?.(orientation);
  }

  // Button click handlers
  function handleRotateClick() {
    hapticService?.trigger("selection");
    onRotate?.();
  }

  function handleMirrorClick() {
    hapticService?.trigger("selection");
    onMirror?.();
  }

  function handleColorSwapClick() {
    hapticService?.trigger("selection");
    onColorSwap?.();
  }
</script>

<div class="codex-control-panel">
  <!-- Row with orientation and controls -->
  <div class="control-row">
    <!-- Orientation Selector -->
    {#if showOrientation}
      <div class="orientation-wrapper">
        <SegmentedControl
          options={orientationOptions}
          value={currentOrientation}
          onchange={handleOrientationChange}
          color="accent"
          size="sm"
        />
      </div>
    {/if}

    <!-- Control Buttons -->
    <div class="control-buttons">
      <button
        class="control-button"
        onclick={handleRotateClick}
        title="Rotate 90° clockwise"
        aria-label="Rotate pictographs"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0115-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 01-15 6.7L3 16" />
        </svg>
      </button>

      <button
        class="control-button"
        onclick={handleMirrorClick}
        title="Mirror horizontally"
        aria-label="Mirror pictographs"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3" />
          <path d="M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3" />
          <path d="M12 20v2" />
          <path d="M12 14v2" />
          <path d="M12 8v2" />
          <path d="M12 2v2" />
        </svg>
      </button>

      <button
        class="control-button swap-button"
        onclick={handleColorSwapClick}
        title="Swap colors"
        aria-label="Swap colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle
            cx="8"
            cy="8"
            r="5"
            fill="color-mix(in srgb, var(--prop-red) 60%, transparent)"
          />
          <circle
            cx="16"
            cy="16"
            r="5"
            fill="color-mix(in srgb, var(--prop-blue) 60%, transparent)"
          />
          <path d="M13 7l3 3-3 3" />
          <path d="M11 17l-3-3 3-3" />
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .codex-control-panel {
    display: flex;
    flex-direction: column;
    padding: 12px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    margin-bottom: 12px;
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  /* Orientation selector wrapper */
  .orientation-wrapper {
    flex: 1;
    max-width: 260px;
  }

  /* Control buttons */
  .control-buttons {
    display: flex;
    gap: 8px;
  }

  .control-button {
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-normal) ease;
  }

  .control-button:hover {
    background: var(--theme-stroke);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .control-button:active {
    transform: translateY(0) scale(0.96);
    background: var(--theme-card-bg);
  }

  .control-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* Swap button with colored circles */
  .swap-button svg circle:first-of-type {
    transition: fill var(--duration-normal) ease;
  }

  .swap-button svg circle:last-of-type {
    transition: fill var(--duration-normal) ease;
  }

  .swap-button:hover svg circle:first-of-type {
    fill: color-mix(in srgb, var(--prop-blue) 70%, transparent);
  }

  .swap-button:hover svg circle:last-of-type {
    fill: color-mix(in srgb, var(--prop-red) 70%, transparent);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .codex-control-panel {
      padding: 10px 12px;
      border-radius: 12px;
    }

    .orientation-wrapper {
      max-width: 200px;
    }

    .control-button {
      /* Touch target remains 48px for WCAG AAA */
      border-radius: 8px;
    }

    .control-button svg {
      width: 16px;
      height: 16px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .control-button {
      transition: none;
    }
  }
</style>
