<!--
  HandSelector.svelte

  Global hand selector for the SequenceActionsPanel.
  Allows selecting which hand(s) transforms apply to: Left, Right, or Both.

  Buttons are color-coded: Blue for Left, Red for Right, Purple for Both.
-->
<script lang="ts">
  import type { TargetHand } from "../../state/panel-coordination-state.svelte.ts";

  interface Props {
    value: TargetHand;
    onChange: (hand: TargetHand) => void;
  }

  let { value, onChange }: Props = $props();
</script>

<div class="hand-selector-section">
  <div class="section-header">
    <span class="section-label">Apply To</span>
  </div>

  <div class="hand-buttons">
    <button
      class="hand-btn blue-btn"
      class:active={value === "blue"}
      onclick={() => onChange("blue")}
      aria-pressed={value === "blue"}
    >
      <span class="hand-label">Left</span>
    </button>

    <button
      class="hand-btn both-btn"
      class:active={value === "both"}
      onclick={() => onChange("both")}
      aria-pressed={value === "both"}
    >
      <span class="hand-label">Both</span>
    </button>

    <button
      class="hand-btn red-btn"
      class:active={value === "red"}
      onclick={() => onChange("red")}
      aria-pressed={value === "red"}
    >
      <span class="hand-label">Right</span>
    </button>
  </div>
</div>

<style>
  .hand-selector-section {
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .section-header {
    margin-bottom: 12px;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }

  .hand-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .hand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px 12px;
    border-radius: 10px;
    border: 1.5px solid transparent;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .hand-btn:hover {
    transform: translateY(-2px);
  }

  /* Blue / Left button */
  .blue-btn {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.25);
    color: rgb(147, 197, 253);
  }

  .blue-btn:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.4);
  }

  .blue-btn.active {
    background: rgba(59, 130, 246, 0.35);
    border-color: rgba(59, 130, 246, 0.6);
    color: white;
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
  }

  /* Purple / Both button */
  .both-btn {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.25);
    color: rgb(216, 180, 254);
  }

  .both-btn:hover {
    background: rgba(168, 85, 247, 0.25);
    border-color: rgba(168, 85, 247, 0.4);
  }

  .both-btn.active {
    background: rgba(168, 85, 247, 0.35);
    border-color: rgba(168, 85, 247, 0.6);
    color: white;
    box-shadow: 0 4px 16px rgba(168, 85, 247, 0.3);
  }

  /* Red / Right button */
  .red-btn {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.25);
    color: rgb(252, 165, 165);
  }

  .red-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.4);
  }

  .red-btn.active {
    background: rgba(239, 68, 68, 0.35);
    border-color: rgba(239, 68, 68, 0.6);
    color: white;
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
  }

  .hand-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
  }
</style>
