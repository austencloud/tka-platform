<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type { SequenceTransformCommandId } from "$lib/shared/create/domain/sequence-action-types";

  interface Props {
    available: boolean;
    onAction: (action: SequenceTransformCommandId) => void | Promise<void>;
    onMoreActions: () => void;
  }

  let { available, onAction, onMoreActions }: Props = $props();

  const actions: Array<{
    id: SequenceTransformCommandId;
    label: string;
    ariaLabel: string;
    icon: string;
  }> = [
    {
      id: "mirror",
      label: "Mirror",
      ariaLabel: "Mirror the entire sequence left to right",
      icon: "fa-left-right",
    },
    {
      id: "flip",
      label: "Flip",
      ariaLabel: "Flip the entire sequence up and down",
      icon: "fa-up-down",
    },
    {
      id: "swap",
      label: "Swap",
      ariaLabel: "Swap hands in the entire sequence",
      icon: "fa-right-left",
    },
    {
      id: "invert",
      label: "Invert",
      ariaLabel: "Invert turn directions in the entire sequence",
      icon: "fa-repeat",
    },
    {
      id: "rotate_counterclockwise",
      label: "Rotate L",
      ariaLabel: "Rotate the entire sequence left 45 degrees",
      icon: "fa-rotate-left",
    },
    {
      id: "rotate_clockwise",
      label: "Rotate R",
      ariaLabel: "Rotate the entire sequence right 45 degrees",
      icon: "fa-rotate-right",
    },
  ];
</script>

<div
  class="sequence-action-rail"
  class:available
  aria-hidden={!available}
  data-testid="create-sequence-action-rail"
>
  {#each actions as action (action.id)}
    <span class="action-control" data-action={action.id}>
      <PanelButton
        disabled={!available}
        ariaLabel={action.ariaLabel}
        onclick={() => void onAction(action.id)}
      >
        <i class="fas {action.icon}" aria-hidden="true"></i>
        <span>{action.label}</span>
      </PanelButton>
    </span>
  {/each}

  <span class="action-control more-actions-control">
    <PanelButton
      disabled={!available}
      ariaLabel="Open all sequence actions"
      onclick={onMoreActions}
    >
      <i class="fas fa-ellipsis" aria-hidden="true"></i>
      <span>More</span>
    </PanelButton>
  </span>
</div>

<style>
  .sequence-action-rail {
    display: none;
    width: 100%;
    height: var(--min-touch-target, 44px);
    align-items: center;
    justify-content: flex-end;
    gap: clamp(3px, 0.35cqi, 6px);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity var(--transition-fast),
      visibility 0s linear var(--duration-fast);
  }

  .sequence-action-rail.available {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition-delay: 0s;
  }

  .action-control {
    display: inline-flex;
    flex: 0 0 auto;
  }

  .action-control :global(.panel-btn) {
    width: auto;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    padding: 7px 9px;
    gap: 6px;
    white-space: nowrap;
    background: transparent;
    border-color: transparent;
  }

  .action-control :global(.panel-btn:hover:not(:disabled)) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke);
  }

  .action-control i {
    width: 16px;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .action-control span {
    font-size: var(--font-size-min, 14px);
  }

  .more-actions-control {
    margin-left: 2px;
  }

  @container create-module-workspace (min-width: 1180px) {
    .sequence-action-rail {
      display: flex;
    }
  }

  @media (hover: none) and (pointer: coarse) {
    .sequence-action-rail {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sequence-action-rail {
      transition: none;
    }
  }
</style>
