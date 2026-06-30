<!--
  ButtonPanel.svelte

  Unified action button panel for workbench layout.
  Pure orchestration component - composes individual button components.

  Layout:
  - LEFT ZONE: Undo + Clear (corrective actions)
  - CENTER ZONE: Export Panel
  - RIGHT ZONE: Tools + Save (constructive actions)

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
  import SaveToLibraryButton from "./buttons/SaveToLibraryButton.svelte";
  import { workspaceButtonsInZone } from "../workspace-button-layout";

  // Get context - ButtonPanel is ONLY used inside CreateModule, so context is always available
  const { CreateModuleState, panelState } = getCreateModuleContext();

  // Zone membership + order come from the shared workspace button layout, so the
  // create tutorial's diagram of this panel can never drift from it.
  const leftButtons = workspaceButtonsInZone("left");
  const centerButtons = workspaceButtonsInZone("center");
  const rightButtons = workspaceButtonsInZone("right");

  // Props interface - only event handler callbacks
  const {
    onClearSequence,
    onSequenceActionsClick,
    onViewSequence,
    onSaveToLibrary,
    visible = true,
  }: {
    onClearSequence?: () => void;
    onSequenceActionsClick?: () => void;
    onViewSequence?: () => void;
    onSaveToLibrary?: () => void;
    visible?: boolean;
  } = $props();

  // Derive computed values from context
  const showViewSequenceButton = $derived(CreateModuleState.canShowActionButtons());
  const showSequenceActions = $derived(
    CreateModuleState.canShowSequenceActionsButton()
  );
  const canClearSequence = $derived(CreateModuleState.canClearSequence());
  const isExportPanelOpen = $derived(panelState.isExportPanelOpen);
  const canSaveToLibrary = $derived(CreateModuleState.canShowActionButtons());
  const currentSequence = $derived.by(() => {
    const tabState = CreateModuleState.getActiveTabSequenceState();
    return tabState?.currentSequence ?? null;
  });

  // Count center-zone buttons to key the container (for smooth cross-fade on layout changes)
  // Note: SequenceActions is now in left zone, not center
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
  <div class="button-panel" transition:fade={{ duration: 200 }}>
    <!-- LEFT ZONE: order/membership from the shared layout -->
    <div class="left-zone">
      {#each leftButtons as btn (btn.id)}
        {#if btn.id === "undo"}
          <div transition:presenceTransition>
            <UndoButton {CreateModuleState} />
          </div>
        {:else if btn.id === "clear" && canClearSequence && onClearSequence}
          <div transition:presenceTransition>
            <ClearSequencePanelButton onclick={onClearSequence} />
          </div>
        {/if}
      {/each}
    </div>

    <!-- CENTER ZONE: Main action button (Export Panel) -->
    <div class="center-zone-wrapper">
      {#key centerZoneButtonCount()}
        <div
          class="center-zone"
          out:fade={{ duration: 150 }}
          in:fade={{ duration: 150, delay: 150 }}
        >
          {#each centerButtons as btn (btn.id)}
            {#if btn.id === "view" && showViewSequenceButton && onViewSequence}
              <div>
                <ViewSequenceButton onclick={onViewSequence} isActive={isExportPanelOpen} />
              </div>
            {/if}
          {/each}
        </div>
      {/key}
    </div>

    <!-- RIGHT ZONE: order/membership from the shared layout -->
    <div class="right-zone">
      {#each rightButtons as btn (btn.id)}
        {#if btn.id === "sequence-actions" && showSequenceActions && onSequenceActionsClick}
          <div transition:presenceTransition>
            <SequenceActionsButton onclick={onSequenceActionsClick} />
          </div>
        {:else if btn.id === "save" && canSaveToLibrary && onSaveToLibrary}
          <div transition:presenceTransition>
            <SaveToLibraryButton
              sequence={currentSequence}
              onclick={onSaveToLibrary}
            />
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .button-panel {
    /* Enable container queries for responsive spacing */
    container-type: inline-size;
    container-name: button-panel;

    display: flex;
    flex-direction: row;
    align-items: center;
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
    pointer-events: auto;
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
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }

  /* RIGHT ZONE: Tools + Save at right edge */
  .right-zone {
    display: flex;
    align-items: center;
    gap: 12px; /* Slightly reduced for better mobile fit */
    flex-shrink: 0; /* Don't shrink */
    pointer-events: auto;
  }

  /* Ensure transition wrappers don't interfere with layout */
  .left-zone > div,
  .center-zone > div,
  .right-zone > div {
    display: inline-block;
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

  /* Compact mobile (iPhone SE, etc.) - use alt touch target */
  @container button-panel (max-width: 390px) {
    .button-panel {
      --min-touch-target: var(--alt-touch-target);
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


</style>
