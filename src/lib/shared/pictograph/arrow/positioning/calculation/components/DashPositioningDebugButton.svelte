<!--
DashPositioningDebugButton.svelte

Drop-in debug button for testing dash arrow positioning.
Place this anywhere in your UI to debug pictographs with dash motions.

Usage:
<DashPositioningDebugButton
  pictographData={yourPictographData}
  isBlueArrow={true}
/>
-->
<script lang="ts">
  import type { PictographData } from "../../../../shared/domain/models/PictographData";
  // TODO: Restore when useDashPositioningDebug.svelte is implemented
  // import { useDashPositioningDebug } from "../services/implementations/useDashPositioningDebug.svelte";

  let {
    pictographData,
    isBlueArrow: _isBlueArrow = true,
    debugBoth: _debugBoth = false,
    label = "Debug Dash Arrow",
  }: {
    pictographData: PictographData;
    isBlueArrow?: boolean;
    debugBoth?: boolean;
    label?: string;
  } = $props();

  // TODO: Restore when useDashPositioningDebug.svelte is implemented
  // const { debugPictograph, debugBothArrows } = useDashPositioningDebug();

  let isDebugging = $state(false);

  async function handleDebug() {
    isDebugging = true;
    console.clear(); // Clear console for cleaner output

    try {
      // TODO: Restore when useDashPositioningDebug.svelte is implemented
      console.warn(
        "Debug functionality not yet implemented - useDashPositioningDebug.svelte missing"
      );
      // if (debugBoth) {
      //   await debugBothArrows(pictographData);
      // } else {
      //   await debugPictograph(pictographData, isBlueArrow);
      // }
    } catch (error) {
      console.error("Debug failed:", error);
    } finally {
      isDebugging = false;
    }
  }

  // Check if the pictograph has any dash motions
  const hasDash = $derived(
    pictographData.motions?.blue?.motionType?.toLowerCase() === "dash" ||
      pictographData.motions?.red?.motionType?.toLowerCase() === "dash"
  );

  // Check turn count for display
  const blueHasTurns = $derived(
    Number(pictographData.motions?.blue?.turns || 0) > 0
  );
  const redHasTurns = $derived(
    Number(pictographData.motions?.red?.turns || 0) > 0
  );
</script>

<button
  class="debug-button"
  onclick={handleDebug}
  disabled={isDebugging || !hasDash}
  title={hasDash
    ? "Click to run comprehensive dash positioning diagnostic (check console)"
    : "No dash motions in this pictograph"}
>
  {#if isDebugging}
    🔍 Debugging...
  {:else if !hasDash}
    ⚠️ No Dash
  {:else}
    🔍 {label}
  {/if}
</button>

<div class="debug-info">
  {#if hasDash}
    <div class="motion-info">
      {#if pictographData.motions?.blue?.motionType?.toLowerCase() === "dash"}
        <span class="badge blue">
          Blue: DASH {pictographData.motions.blue.turns || 0}T
          {pictographData.motions.blue.rotationDirection || "no-rot"}
        </span>
      {/if}
      {#if pictographData.motions?.red?.motionType?.toLowerCase() === "dash"}
        <span class="badge red">
          Red: DASH {pictographData.motions.red.turns || 0}T
          {pictographData.motions.red.rotationDirection || "no-rot"}
        </span>
      {/if}
      {#if blueHasTurns || redHasTurns}
        <span class="badge warning">⚠️ Has turns</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .debug-button {
    padding: 8px 16px;
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      var(--theme-accent-strong) 100%
    );
    color: white;
    border: none;
    border-radius: 6px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .debug-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .debug-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .debug-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #ccc;
  }

  .debug-info {
    margin-top: 8px;
    font-size: var(--font-size-compact);
  }

  .motion-info {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: var(--font-size-compact);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge.blue {
    background: rgba(59, 130, 246, 0.2);
    color: #1e40af;
    border: 1px solid var(--semantic-info);
  }

  .badge.red {
    background: rgba(239, 68, 68, 0.2);
    color: #991b1b;
    border: 1px solid var(--semantic-error);
  }

  .badge.warning {
    background: rgba(245, 158, 11, 0.2);
    color: #92400e;
    border: 1px solid var(--semantic-warning);
  }
</style>
