<!--
AssemblyPhaseHeader.svelte - Phase indicator and instructions for Assembly mode

Shows current phase (Blue Hand, Red Hand, Rotation), progress, and contextual instructions.
Undo is handled by the workspace-level undo button, not here.
-->
<script lang="ts">
  import type { HandPathPhase } from "../state/handpath-assemble-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const { phase, bluePathLength, redPathLength } = $props<{
    phase: HandPathPhase;
    bluePathLength: number;
    redPathLength: number;
  }>();

  // Phase display info - title is now the main instruction
  const phaseInfo = $derived.by(() => {
    switch (phase) {
      case "blue": {
        // First position is the start position, subsequent are steps
        const title =
          bluePathLength === 0
            ? t("assembly_select_starting_position")
            : t("assembly_select_beat", { beat: bluePathLength });
        return {
          title,
          color: "var(--semantic-info)",
          step: 1,
        };
      }
      case "red": {
        const title =
          redPathLength === 0
            ? t("assembly_select_starting_position")
            : t("assembly_select_beat", { beat: redPathLength });
        return {
          title,
          color: "var(--semantic-error)",
          step: 2,
        };
      }
      case "rotation-selection":
        return {
          title: t("assembly_choose_rotation"),
          color: "var(--semantic-success)",
          step: 3,
        };
      case "complete":
        return {
          title: t("assembly_complete"),
          color: "var(--semantic-success)",
          step: 3,
        };
      default:
        return {
          title: t("assembly_assembly"),
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
  <!-- Phase badge with hand icon -->
  <div class="phase-badge">
    <div class="phase-icon">
      <svg viewBox="0 0 75 100" class="hand-icon">
        <path
          d="M11.17 44.59h3.37V12.7a5.61 5.61 0 1 1 11.2-.01v31.9h3.32V5.72A5.5 5.5 0 0 1 34.66 0a5.55 5.55 0 0 1 5.58 5.77v38.81h3.32V13.56c0-2.99 1.95-5.19 4.97-5.64 3.08-.45 6.18 2.1 6.19 5.15q.02 5.73 0 11.46v38.13c0 .79.16 1.47.94 1.87.85.44 1.73.15 2.27-.77l6.41-10.87c1.64-2.79 4.42-3.73 7.43-2.48 3.04 1.26 4.15 4.73 2.41 7.7L65.3 73.19c-2.17 3.68-4.29 7.4-6.55 11.03a18 18 0 0 1-2.81 3.27 46 46 0 0 1-14.76 9.87c-5.01 2.03-10.23 3.03-15.63 2.51-9.85-.94-17.1-5.78-21.71-14.35A32 32 0 0 1 .26 73a76 76 0 0 1-.25-6.23L0 25.08a5.6 5.6 0 0 1 5.74-5.7 5.5 5.5 0 0 1 5.42 5.41z"
        />
      </svg>
    </div>
    <span class="phase-title">{phaseInfo.title}</span>
  </div>
</div>

<!-- Segmented progress bar -->
<div class="progress-bar-container">
  <div class="progress-segment" class:active={phaseInfo.step >= 1} class:complete={phaseInfo.step > 1} style:--segment-color="var(--semantic-info)"></div>
  <div class="progress-segment" class:active={phaseInfo.step >= 2} class:complete={phaseInfo.step > 2} style:--segment-color="var(--semantic-error)"></div>
  <div class="progress-segment" class:active={phaseInfo.step >= 3} style:--segment-color="var(--semantic-success)"></div>
</div>

<style>
  .phase-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--theme-panel-bg);
  }

  .phase-badge {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .phase-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 2px 8px var(--phase-color));
  }

  .hand-icon {
    width: 100%;
    height: 100%;
    fill: var(--phase-color);
    transition: fill 0.3s ease;
  }

  .phase-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  /* Segmented progress bar */
  .progress-bar-container {
    display: flex;
    gap: 4px;
    padding: 0 16px 12px;
    background: var(--theme-panel-bg);
  }

  .progress-segment {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--theme-stroke);
    transition: all 0.3s ease;
  }

  .progress-segment.active {
    background: var(--segment-color);
    box-shadow: 0 0 8px color-mix(in srgb, var(--segment-color) 50%, transparent);
  }

  .progress-segment.complete {
    background: var(--segment-color);
    opacity: 0.6;
    box-shadow: none;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .phase-header {
      padding: 12px;
    }

    .phase-icon {
      width: 28px;
      height: 28px;
    }

    .phase-title {
      font-size: var(--font-size-base);
    }

    .progress-bar-container {
      padding: 0 12px 10px;
    }
  }
</style>
