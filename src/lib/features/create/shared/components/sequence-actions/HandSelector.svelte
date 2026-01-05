<!--
  HandSelector.svelte

  Global hand selector for the SequenceActionsPanel.
  Allows selecting which hand(s) transforms apply to: Blue, Red, or Both.
  Styled to match the transform grid buttons.
-->
<script lang="ts">
  import type { TargetHand } from "../../state/panel-coordination-state.svelte.ts";

  interface Props {
    value: TargetHand;
    onChange: (hand: TargetHand) => void;
  }

  let { value, onChange }: Props = $props();
</script>

<div class="hand-selector">
  <span class="selector-label">Apply to:</span>
  <div class="hand-buttons">
    <button
      class="hand-btn blue-btn"
      class:active={value === "blue"}
      onclick={() => onChange("blue")}
      aria-pressed={value === "blue"}
    >
      <span class="hand-icon">
        <span class="hand-dot"></span>
      </span>
      <span class="hand-label">Blue</span>
    </button>
    <button
      class="hand-btn red-btn"
      class:active={value === "red"}
      onclick={() => onChange("red")}
      aria-pressed={value === "red"}
    >
      <span class="hand-icon">
        <span class="hand-dot"></span>
      </span>
      <span class="hand-label">Red</span>
    </button>
    <button
      class="hand-btn both-btn"
      class:active={value === "both"}
      onclick={() => onChange("both")}
      aria-pressed={value === "both"}
    >
      <span class="hand-icon">
        <span class="hand-dot blue-dot"></span>
        <span class="hand-dot red-dot"></span>
      </span>
      <span class="hand-label">Both</span>
    </button>
  </div>
</div>

<style>
  .hand-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
  }

  .selector-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted);
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  .hand-buttons {
    display: flex;
    gap: 8px;
    flex: 1;
  }

  .hand-btn {
    --btn-color: 255, 255, 255;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    min-width: 60px;
    border-radius: 10px;
    background: linear-gradient(
      135deg,
      rgba(var(--btn-color), 0.08) 0%,
      rgba(var(--btn-color), 0.02) 100%
    );
    border: 1.5px solid rgba(var(--btn-color), 0.12);
    color: var(--theme-text-muted);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .hand-btn:hover {
    background: linear-gradient(
      135deg,
      rgba(var(--btn-color), 0.15) 0%,
      rgba(var(--btn-color), 0.05) 100%
    );
    border-color: rgba(var(--btn-color), 0.25);
    transform: translateY(-1px);
  }

  .hand-btn.active {
    background: linear-gradient(
      135deg,
      rgba(var(--btn-color), 0.25) 0%,
      rgba(var(--btn-color), 0.12) 100%
    );
    border-color: rgba(var(--btn-color), 0.4);
    color: var(--theme-text);
    box-shadow: 0 2px 8px rgba(var(--btn-color), 0.15);
  }

  /* Color-specific button styling */
  .blue-btn {
    --btn-color: 59, 130, 246;
  }

  .red-btn {
    --btn-color: 239, 68, 68;
  }

  .both-btn {
    --btn-color: 168, 85, 247;
  }

  .hand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: rgba(var(--btn-color), 0.2);
  }

  .hand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgb(var(--btn-color));
  }

  .both-btn .hand-icon {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.2) 0%,
      rgba(239, 68, 68, 0.2) 100%
    );
  }

  .both-btn .blue-dot {
    background: var(--prop-blue);
  }

  .both-btn .red-dot {
    background: var(--prop-red);
  }

  .hand-label {
    font-weight: 500;
  }
</style>
