<!--
  ButtonPanel.svelte

  Unified action button panel for workbench layout.
  Pure orchestration component - composes individual button components.

  Layout:
  - LEFT ZONE: Undo + Clear (corrective actions)
  - CENTER ZONE: Play
  - RIGHT ZONE: Sequence Actions + Share

  Architecture:
  - Uses CreateModuleContext for state access
  - Derives all boolean flags locally from context
  - Only receives event handler callbacks as props
  - No business logic (delegated to services)
  - Just composition and prop passing
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { PresenceAnimation } from "../../../../../../shared/ui-animation/animations.svelte";
  import { getCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import ClearSequencePanelButton from "./buttons/ClearSequenceButton.svelte";
  import UndoButton from "./buttons/UndoButton.svelte";
  import SequenceActionsButton from "./buttons/SequenceActionsButton.svelte";
  import ViewSequenceButton from "./buttons/ViewSequenceButton.svelte";
  import ShareButton from "./buttons/ShareButton.svelte";
  import { workspaceButtonsInZone } from "../workspace-button-layout";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { shareTarget } from "$lib/shared/mobile/share-action.svelte";
  import {
    logConstructFullPlay,
    logConstructImmediateUndo,
  } from "$lib/features/create/construct/services/construct-analytics";

  // Get context - ButtonPanel is ONLY used inside CreateModule, so context is always available
  const { CreateModuleState, constructTutorialState, panelState, layout } =
    getCreateModuleContext();

  // Zone membership + order come from the shared workspace button layout, so the
  // create tutorial's diagram of this panel can never drift from it.
  const leftButtons = workspaceButtonsInZone("left");
  const centerButtons = workspaceButtonsInZone("center");
  const rightButtons = workspaceButtonsInZone("right");

  // Props interface - only event handler callbacks
  const {
    onClearSequence,
    onViewSequence,
    visible = true,
  }: {
    onClearSequence?: () => void;
    onViewSequence?: () => void;
    visible?: boolean;
  } = $props();

  // Derive computed values from context
  const showViewSequenceButton = $derived(
    CreateModuleState.canShowActionButtons()
  );
  const showSequenceActions = $derived(
    CreateModuleState.canShowSequenceActionsButton()
  );
  const canClearSequence = $derived(CreateModuleState.canClearSequence());
  const isExportPanelOpen = $derived(panelState.isExportPanelOpen);
  const canShareSequence = $derived(CreateModuleState.canShowActionButtons());
  const useMobileShareSheet = $derived(
    shareTarget.isMobile || !layout.shouldUseSideBySideLayout
  );
  const isAssembleTab = $derived(navigationState.activeTab === "assemble");
  const currentSequence = $derived.by(() => {
    const tabState = CreateModuleState.getActiveTabSequenceState();
    return tabState?.currentSequence ?? null;
  });
  const isConstructTab = $derived(navigationState.activeTab === "construct");
  const isPlayTutorialTarget = $derived(
    constructTutorialState.isActive &&
      constructTutorialState.stage === "play-sequence"
  );

  function handleUndoAction() {
    if (isConstructTab) {
      logConstructImmediateUndo();
    }
  }

  function handleFullSequencePlay() {
    onViewSequence?.();
    if (!isConstructTab) return;

    logConstructFullPlay(currentSequence?.steps.length ?? 0);
    constructTutorialState.recordFullPlay();
  }

  // Count center-zone buttons to key the container (for smooth cross-fade on
  // layout changes). Save is the only workspace action in the header.
  const centerZoneButtonCount = $derived(() => {
    let count = 0;
    if (showViewSequenceButton) count++;
    return count;
  });

  /**
   * Spring scale transition using unified animation system
   * Replaces old springScaleTransition with physics-based PresenceAnimation
   */
  function presenceTransition(
    _node: Element,
    { duration = 550, delay = 0 }: { duration?: number; delay?: number } = {}
  ) {
    const animation = new PresenceAnimation("snappy");

    // Trigger enter animation
    animation.enter();

    return {
      duration,
      delay,
      css: (t: number) => {
        // Interpolate between start (0.95 scale) and end (1.0 scale)
        const scale = 0.95 + (1 - 0.95) * t;
        return `
          transform: scale(${scale});
          opacity: ${t};
        `;
      },
    };
  }
</script>

{#if visible}
  <div class="button-panel-container">
    <div
      class="button-panel"
      class:assemble-layout={isAssembleTab}
      transition:fade={{ duration: 200 }}
    >
      <!-- LEFT ZONE: order/membership from the shared layout -->
      <div class="left-zone">
        {#each leftButtons as btn (btn.id)}
          {#if btn.id === "undo"}
            <div transition:presenceTransition>
              <UndoButton {CreateModuleState} onAction={handleUndoAction} />
            </div>
            {#if isAssembleTab}
              <div transition:presenceTransition>
                <UndoButton {CreateModuleState} direction="redo" />
              </div>
            {/if}
          {:else if btn.id === "clear" && canClearSequence && onClearSequence}
            <div transition:presenceTransition>
              <ClearSequencePanelButton onclick={onClearSequence} />
            </div>
          {/if}
        {/each}
      </div>

      <!-- CENTER ZONE: Primary Play action -->
      <div class="center-zone-wrapper">
        {#key centerZoneButtonCount()}
          <div
            class="center-zone"
            out:fade={{ duration: 150 }}
            in:fade={{ duration: 150, delay: 150 }}
          >
            {#each centerButtons as btn (btn.id)}
              {#if btn.id === "view" && showViewSequenceButton && onViewSequence}
                <div
                  class:tutorial-target={isPlayTutorialTarget}
                  data-tutorial-target={isPlayTutorialTarget
                    ? "play-sequence"
                    : undefined}
                >
                  <ViewSequenceButton
                    onclick={handleFullSequencePlay}
                    isActive={isExportPanelOpen}
                    purpose="play"
                  />
                </div>
              {/if}
            {/each}
          </div>
        {/key}
      </div>

      <!-- RIGHT ZONE: order/membership from the shared layout -->
      <div class="right-zone">
        {#each rightButtons as btn (btn.id)}
          {#if btn.id === "sequence-actions" && showSequenceActions}
            <div transition:presenceTransition>
              <SequenceActionsButton
                onclick={() => panelState.openSequenceActionsPanel()}
              />
            </div>
          {:else if btn.id === "share" && canShareSequence}
            <div transition:presenceTransition>
              <ShareButton
                sequence={currentSequence}
                useMobileSheet={useMobileShareSheet}
              />
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .button-panel-container {
    container-type: inline-size;
    container-name: button-panel;
    width: 100%;
    pointer-events: none;
  }

  .button-panel {
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between; /* Space between left, center, right zones */
    width: 100%;
    border-radius: 24px;
    position: relative; /* Positioning context for absolutely-centered center zone */

    /* Intelligent reactive padding to prevent overlap */
    padding: clamp(2px, 0.3vh, 16px) clamp(2px, 1vw, 24px);

    /* Let taps pass through empty areas to step grid below */
    pointer-events: none;
  }

  /* LEFT ZONE: Undo + Clear at left edge */
  .left-zone {
    display: flex;
    align-items: center;
    gap: 12px; /* Slightly reduced for better mobile fit */
    flex-shrink: 0; /* Don't shrink */
    pointer-events: none;
  }

  /* CENTER ZONE WRAPPER: Maintains layout space during transitions */
  .center-zone-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-grow: 1; /* Take up available space in flex flow */
    min-height: var(--min-touch-target); /* Prevent collapse */
  }

  /* CENTER ZONE: Absolutely centered relative to full button panel width,
     not the wrapper - so asymmetric left/right zones don't push it off-center */
  .center-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    position: absolute;
    left: 50%;
    /* Play is larger than the surrounding controls. Anchor its bottom edge to
       theirs so it grows upward instead of crossing the workspace border. */
    bottom: calc((100% - var(--min-touch-target)) / 2);
    transform: translateX(-50%);
    pointer-events: none;
  }

  /* RIGHT ZONE: sequence transforms followed by Share at the outer edge */
  .right-zone {
    display: flex;
    align-items: center;
    gap: 12px; /* Slightly reduced for better mobile fit */
    flex-shrink: 0; /* Don't shrink */
    pointer-events: none;
  }

  /* Ensure transition wrappers don't interfere with layout */
  .left-zone > div,
  .center-zone > div,
  .right-zone > div {
    display: inline-block;
    pointer-events: auto;
  }

  .tutorial-target {
    border-radius: 999px;
    outline: 3px solid color-mix(in srgb, var(--theme-accent) 76%, transparent);
    outline-offset: 4px;
  }

  /* Remove mobile tap highlight (blue selection box) */
  .button-panel :global(button),
  .button-panel :global(a) {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Container-based responsive adjustments - Progressive gap reduction to fit 48px buttons */
  @container button-panel (max-width: 768px) {
    .button-panel {
      padding: clamp(6px, 1.2vh, 12px) clamp(10px, 1.8vw, 18px);
    }

    .left-zone,
    .center-zone,
    .right-zone {
      gap: 10px; /* Balanced spacing for 48px buttons */
    }
  }

  /* Tighter spacing on smaller containers to accommodate 48px buttons */
  @container button-panel (max-width: 480px) {
    .button-panel {
      padding: clamp(4px, 1vh, 10px) clamp(8px, 1.5vw, 12px);
    }

    .left-zone,
    .center-zone,
    .right-zone {
      gap: 8px; /* Compact but comfortable spacing */
    }
  }

  /* Very narrow containers - minimal gaps but NEVER shrink buttons */
  @container button-panel (max-width: 360px) {
    .button-panel {
      padding: 6px 8px;
    }

    .left-zone,
    .center-zone,
    .right-zone {
      gap: 6px; /* Tight spacing to fit all buttons */
    }
  }

  /* Extremely narrow containers */
  @container button-panel (max-width: 340px) {
    .button-panel {
      padding: 6px 6px;
    }

    .left-zone,
    .center-zone,
    .right-zone {
      gap: 5px; /* Minimum comfortable gap */
    }
  }

  /* 🎯 LANDSLOOPE MOBILE: Ultra-compact mode for devices like Z Fold 5 horizontal (882x344) */
  /* Matches app's isLandscapeMobile() criteria: aspectRatio > 1.7 AND height < 500px */
  /* This preserves precious vertical space on wide but short screens */
  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .button-panel {
      border-radius: 16px;
      /* Reduce vertical footprint - minimal padding */
      min-height: 0;
      padding: 4px 12px;
    }

    .left-zone,
    .center-zone,
    .right-zone {
      gap: 16px;
    }
  }

  /* 🔥 EXTREME CONSTRAINTS: Very narrow landscape mode */
  /* For devices in horizontal orientation with extreme width constraints */
  @media (max-width: 500px) and (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .button-panel {
      border-radius: 12px;
      padding: 3px 8px;
    }

    .left-zone,
    .center-zone,
    .right-zone {
      gap: 6px;
    }
  }

  /* Play stays at the true center while the two action groups hug their
     corners. Keeping each side at its natural width prevents spare room from
     turning into gaps between Actions and Save. */
  @container button-panel (max-width: 480px) {
    .button-panel {
      --min-touch-target: 48px;
      --settings-workspace-action-gap: 8px;
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        50px
        minmax(0, 1fr);
      align-items: center;
      padding: 6px;
    }

    .left-zone,
    .right-zone {
      display: flex;
      width: max-content;
      min-width: 0;
      gap: var(--settings-workspace-action-gap);
    }

    .left-zone {
      justify-self: start;
    }

    .right-zone {
      justify-self: end;
    }

    .center-zone-wrapper {
      width: 50px;
      min-width: 50px;
      min-height: 50px;
      flex-grow: 0;
    }

    .center-zone {
      position: static;
      width: 50px;
      min-width: 50px;
      gap: 0;
      transform: none;
    }

    .left-zone > div,
    .center-zone > div,
    .right-zone > div {
      display: grid;
      place-items: center;
      min-width: 0;
    }
  }

  /* One Share trigger keeps the five controls in a single row. The surrounding
     controls step down to 44px while Play stays prominent. */
  @container button-panel (max-width: 390px) {
    .button-panel {
      --min-touch-target: 44px;
    }
  }

  @container button-panel (max-width: 340px) {
    .button-panel {
      --settings-workspace-action-gap: 4px;
      padding-inline: 4px;
    }
  }

  @container button-panel (max-width: 330px) {
    .button-panel.assemble-layout {
      grid-template-areas:
        "left left left"
        ". center ."
        "right right right";
      row-gap: 4px;
    }

    .button-panel.assemble-layout .left-zone {
      grid-area: left;
    }

    .button-panel.assemble-layout .center-zone-wrapper {
      grid-area: center;
    }

    .button-panel.assemble-layout .right-zone {
      grid-area: right;
      justify-self: end;
    }
  }
</style>
