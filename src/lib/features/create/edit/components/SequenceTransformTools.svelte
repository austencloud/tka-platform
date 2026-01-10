<!--
SequenceTransformTools.svelte - Sequence Transformation Tools

Responsive design:
- Desktop: Full descriptions always visible
- Mobile: Compact with expandable info buttons
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";

  interface TransformAction {
    id: string;
    icon: string;
    name: string;
    shortDesc: string;
    fullDesc: string;
    color: string;
    handler?: () => void;
  }

  let {
    disabled = false,
    hasSequence = false,
    onMirror,
    onSwapColors,
    onRotate,
    onRewind,
    renderExtra,
  } = $props<{
    disabled?: boolean;
    hasSequence?: boolean;
    onMirror?: () => void;
    onSwapColors?: () => void;
    onRotate?: () => void;
    onRewind?: () => void;
    renderExtra?: Snippet;
  }>();

  let hapticService: IHapticFeedback;
  let expandedAction = $state<string | null>(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handle(fn?: () => void) {
    if (disabled || !hasSequence) return;
    hapticService?.trigger("selection");
    fn?.();
  }

  function toggleExpand(id: string, event: MouseEvent) {
    event.stopPropagation();
    expandedAction = expandedAction === id ? null : id;
  }

  // Use $derived to keep handlers reactive when props change
  const actions: TransformAction[] = $derived([
    {
      id: "mirror",
      icon: "fa-left-right",
      name: "Mirror",
      shortDesc: "Flip left & right",
      fullDesc:
        "Creates a mirror image as if reflected in a vertical mirror. Clockwise spins become counter-clockwise.",
      color: "#a855f7",
      handler: onMirror,
    },
    {
      id: "swap-colors",
      icon: "fa-arrows-rotate",
      name: "Swap Hands",
      shortDesc: "Switch hand movements",
      fullDesc:
        "Your left hand's moves become your right hand's, and vice versa. Same sequence, opposite hands leading.",
      color: "var(--semantic-success)",
      handler: onSwapColors,
    },
    {
      id: "rotate",
      icon: "fa-rotate-right",
      name: "Rotate",
      shortDesc: "Pivot 45°",
      fullDesc:
        "Rotates the entire sequence 45° as if you turned your body. Repeat 4 times for a full 180° turn.",
      color: "var(--semantic-warning)",
      handler: onRotate,
    },
    {
      id: "reverse",
      icon: "fa-backward",
      name: "Reverse",
      shortDesc: "Retrace to start",
      fullDesc:
        "Creates a sequence that returns you to where you started. Each movement is inverted so you physically wind back.",
      color: "#f43f5e",
      handler: onRewind,
    },
  ]);
</script>

<div class="sequence-transform-tools">
  <div class="tools-header">
    <h4>Sequence Transforms</h4>
  </div>

  <div class="actions-list">
    {#each actions as action (action.id)}
      <button
        type="button"
        class="action-button"
        class:disabled={!hasSequence || disabled}
        disabled={!hasSequence || disabled}
        style="--action-color: {action.color}"
        onclick={() => handle(action.handler)}
      >
        <div class="action-icon-box">
          <i class="fas {action.icon}" aria-hidden="true"></i>
        </div>
        <div class="action-text">
          <span class="action-name">{action.name}</span>
          <span class="action-desc">{action.shortDesc}</span>
        </div>
      </button>
    {/each}
  </div>

  {#if renderExtra}
    {@render renderExtra()}
  {/if}
</div>

<style>
  .sequence-transform-tools {
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: var(--border-radius, 12px);
    padding: var(--spacing-md, 16px);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .tools-header {
    margin-bottom: var(--spacing-md, 16px);
  }

  .tools-header h4 {
    margin: 0;
    color: var(--theme-text, var(--theme-text));
    font-size: var(--font-size-md, 1rem);
    font-weight: 600;
  }

  .actions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Soft Gradient Fill Style */
  .action-button {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--action-color) 15%, transparent) 0%,
      color-mix(in srgb, var(--action-color) 8%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--action-color) 25%, transparent);
    border-radius: 14px;
    color: var(--theme-text);
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: all 0.15s ease;
  }

  .action-button:hover:not(.disabled) {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--action-color) 25%, transparent) 0%,
      color-mix(in srgb, var(--action-color) 15%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--action-color) 40%, transparent);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--action-color) 20%, transparent);
  }

  .action-button:active:not(.disabled) {
    transform: translateY(0);
    transition: all 0.08s ease;
  }

  .action-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-button:focus-visible {
    outline: 2px solid var(--action-color);
    outline-offset: 2px;
  }

  /* Icon box - solid colored */
  .action-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--action-color);
    border-radius: 10px;
    flex-shrink: 0;
    color: white;
    font-size: var(--font-size-base);
  }

  /* Text container */
  .action-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .action-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .action-desc {
    font-size: 0.8rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Small mobile */
  @media (max-width: 480px) {
    .sequence-transform-tools {
      padding: 12px;
    }

    .action-button {
      padding: 12px 14px;
      gap: 12px;
    }

    .action-icon-box {
      width: 36px;
      height: 36px;
      font-size: var(--font-size-sm);
    }

    .action-name {
      font-size: 0.9rem;
    }

    .action-desc {
      font-size: 0.75rem;
    }
  }

  /* Z Fold cover screen */
  @media (max-width: 320px) {
    .sequence-transform-tools {
      padding: 10px;
    }

    .actions-list {
      gap: 6px;
    }

    .action-button {
      padding: 10px 12px;
      gap: 10px;
    }

    .action-icon-box {
      width: 32px;
      height: 32px;
      font-size: var(--font-size-compact);
    }

    .action-name {
      font-size: 0.85rem;
    }
  }
</style>
