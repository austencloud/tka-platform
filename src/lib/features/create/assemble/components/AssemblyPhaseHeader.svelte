<!--
AssemblyPhaseHeader.svelte - Phase indicator and instructions for Assembly mode

Shows current phase (Blue Hand, Red Hand, Rotation), progress, and contextual instructions.
Undo is handled by the workspace-level undo button, not here.
-->
<script lang="ts">
  import type { HandPathPhase } from "../state/handpath-assemble-state.svelte";
  import * as m from "$lib/paraglide/messages.js";

  const { phase, bluePathLength, redPathLength } = $props<{
    phase: HandPathPhase;
    bluePathLength: number;
    redPathLength: number;
  }>();

  // Phase display info - title is now the main instruction
  const phaseInfo = $derived.by(() => {
    switch (phase) {
      case "blue": {
        // First position is the start position, subsequent are beats
        const title =
          bluePathLength === 0
            ? m.assembly_select_starting_position()
            : m.assembly_select_beat({ beat: bluePathLength });
        return {
          title,
          color: "var(--semantic-info)",
          step: 1,
        };
      }
      case "red": {
        const title =
          redPathLength === 0
            ? m.assembly_select_starting_position()
            : m.assembly_select_beat({ beat: redPathLength });
        return {
          title,
          color: "var(--semantic-error)",
          step: 2,
        };
      }
      case "rotation-selection":
        return {
          title: m.assembly_choose_rotation(),
          color: "var(--semantic-success)",
          step: 3,
        };
      case "complete":
        return {
          title: m.assembly_complete(),
          color: "var(--semantic-success)",
          step: 3,
        };
      default:
        return {
          title: m.assembly_assembly(),
          color: "#8b5cf6",
          step: 0,
        };
    }
  });

  // Progress percentage
  const progressPercent = $derived.by(() => {
    if (phase === "blue") {
      return bluePathLength > 0 ? 25 : 0;
    } else if (phase === "red") {
      const redProgress =
        bluePathLength > 0 ? (redPathLength / bluePathLength) * 50 : 0;
      return 25 + redProgress;
    } else if (phase === "rotation-selection") {
      return 85;
    } else if (phase === "complete") {
      return 100;
    }
    return 0;
  });
</script>

<div class="phase-header" style:--phase-color={phaseInfo.color}>
  <!-- Phase info -->
  <div class="phase-info">
    <div class="phase-badge">
      <span class="phase-dot"></span>
      <span class="phase-title">{phaseInfo.title}</span>
    </div>
  </div>

  <!-- Step indicator -->
  <div class="step-indicator">
    <span class="step-current">{phaseInfo.step}</span>
    <span class="step-divider">/</span>
    <span class="step-total">3</span>
  </div>
</div>

<!-- Progress bar -->
<div class="progress-bar-container">
  <div class="progress-bar" style:width="{progressPercent}%"></div>
</div>

<style>
  .phase-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--theme-panel-bg);
    border-bottom: 1px solid var(--theme-stroke);
    gap: 12px;
  }

  .phase-info {
    flex: 1;
    min-width: 0;
    text-align: center;
  }

  .phase-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .phase-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--phase-color);
    box-shadow: 0 0 8px var(--phase-color);
  }

  .phase-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  .step-indicator {
    display: flex;
    align-items: baseline;
    gap: 2px;
    font-size: var(--font-size-sm);
    flex-shrink: 0;
    padding: 6px 12px;
    background: var(--theme-card-bg);
    border-radius: 8px;
  }

  .step-current {
    font-weight: 700;
    color: var(--phase-color);
    font-size: var(--font-size-base);
  }

  .step-divider {
    color: var(--theme-stroke);
  }

  .step-total {
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Progress bar */
  .progress-bar-container {
    height: 3px;
    background: var(--theme-stroke);
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--phase-color), var(--phase-color));
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .phase-header {
      padding: 10px 12px;
    }

    .phase-title {
      font-size: var(--font-size-sm);
    }
  }
</style>
