<!--
  SequenceEditPanel.svelte

  Panel for applying transformations to entire sequences.
  Responsive design: full descriptions on desktop, expandable on mobile.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface TransformAction {
    id: string;
    icon: string;
    name: string;
    shortDesc: string;
    fullDesc: string;
    color: string;
    action: () => void;
  }

  interface Props {
    sequence: SequenceData | null;
    onTransform: (newSequence: SequenceData) => void;
    handleMirror: () => Promise<SequenceData | null>;
    handleRotate: (direction: "cw" | "ccw") => Promise<SequenceData | null>;
    handleSwapColors: () => SequenceData | null;
    handleRewind: () => Promise<SequenceData | null>;
  }

  let {
    sequence,
    onTransform,
    handleMirror,
    handleRotate,
    handleSwapColors,
    handleRewind,
  }: Props = $props();

  let isTransforming = $state(false);
  let expandedAction = $state<string | null>(null);

  function toggleExpand(id: string) {
    expandedAction = expandedAction === id ? null : id;
  }

  async function executeAction(action: TransformAction) {
    if (!sequence || isTransforming) return;
    isTransforming = true;
    try {
      action.action();
    } finally {
      isTransforming = false;
    }
  }

  async function doMirror() {
    const result = await handleMirror();
    if (result) onTransform(result);
  }

  async function doRotateCW() {
    const result = await handleRotate("cw");
    if (result) onTransform(result);
  }

  async function doRotateCCW() {
    const result = await handleRotate("ccw");
    if (result) onTransform(result);
  }

  async function doSwapColors() {
    const result = handleSwapColors();
    if (result) onTransform(result);
  }

  async function doRewind() {
    const result = await handleRewind();
    if (result) onTransform(result);
  }

  const actions: TransformAction[] = [
    {
      id: "mirror",
      icon: "fa-left-right",
      name: "Mirror",
      shortDesc: "Flip left & right",
      fullDesc:
        "Creates a mirror image as if reflected in a vertical mirror in front of you. Clockwise spins become counter-clockwise.",
      color: "#a855f7",
      action: doMirror,
    },
    {
      id: "rotate-cw",
      icon: "fa-rotate-right",
      name: "Rotate Right",
      shortDesc: "Pivot 45° clockwise",
      fullDesc:
        "Rotates the entire sequence 45° as if you turned your body to the right. Repeat 4 times for a full 180° turn.",
      color: "var(--semantic-warning)",
      action: doRotateCW,
    },
    {
      id: "rotate-ccw",
      icon: "fa-rotate-left",
      name: "Rotate Left",
      shortDesc: "Pivot 45° counter-clockwise",
      fullDesc:
        "Rotates the entire sequence 45° as if you turned your body to the left. Repeat 4 times for a full 180° turn.",
      color: "var(--semantic-warning)",
      action: doRotateCCW,
    },
    {
      id: "swap-colors",
      icon: "fa-arrows-rotate",
      name: "Swap Hands",
      shortDesc: "Switch hand movements",
      fullDesc:
        "Exchanges which hand does each movement. Your left hand's moves become your right hand's, and vice versa.",
      color: "var(--semantic-success)",
      action: doSwapColors,
    },
    {
      id: "rewind",
      icon: "fa-backward",
      name: "Rewind",
      shortDesc: "Retrace to start",
      fullDesc:
        "Creates a sequence that returns you to where you started. Each movement is inverted so you physically wind back.",
      color: "#f43f5e",
      action: doRewind,
    },
  ];
</script>

<div class="sequence-edit-panel">
  <h3 class="panel-title">Sequence Transformations</h3>

  {#if !sequence}
    <div class="no-sequence">
      <p>No sequence loaded</p>
    </div>
  {:else}
    <div class="actions-list">
      {#each actions as action (action.id)}
        <button
          class="action-button"
          onclick={() => executeAction(action)}
          disabled={isTransforming}
          style="--action-color: {action.color}"
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

    {#if isTransforming}
      <div class="transforming-indicator">
        <div class="spinner"></div>
        <span>Applying transformation...</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .sequence-edit-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    overflow-y: auto;
  }

  .panel-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--theme-text);
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .no-sequence {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-dim);
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
    color: rgba(255, 255, 255, 0.95);
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: all var(--duration-fast) ease;
  }

  .action-button:hover:not(:disabled) {
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

  .action-button:active:not(:disabled) {
    transform: translateY(0);
    transition: all 0.08s ease;
  }

  .action-button:disabled {
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
    color: rgba(255, 255, 255, 0.95);
  }

  .action-desc {
    font-size: 0.8rem;
    color: var(--theme-text-dim);
  }

  .transforming-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 16px;
    padding: 12px;
    background: rgba(6, 182, 212, 0.1);
    border-radius: 8px;
    color: #06b6d4;
    font-size: 0.9rem;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: #06b6d4;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Small mobile */
  @media (max-width: 480px) {
    .sequence-edit-panel {
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

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
