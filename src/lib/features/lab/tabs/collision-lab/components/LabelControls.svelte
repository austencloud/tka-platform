<script lang="ts">
  /**
   * LabelControls
   *
   * Four status buttons for the current pose. Shows the current label at
   * the top. Hotkey hints (1/2/3/4) are rendered on each button; actual
   * keyboard handling lives in CollisionLab root.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";
  import type { LabelStatus } from "../domain/types";

  const { state } = getCollisionLabContext();

  interface StatusButton {
    status: LabelStatus;
    label: string;
    hotkey: string;
    color: string;
  }

  const buttons: StatusButton[] = [
    { status: "clear", label: "Clear", hotkey: "1", color: "#22c55e" },
    { status: "needs-adjustment", label: "Needs adjustment", hotkey: "2", color: "#eab308" },
    { status: "unreachable", label: "Unreachable", hotkey: "3", color: "#6b7280" },
    { status: "skip", label: "Skip", hotkey: "4", color: "#64748b" },
  ];

  const currentStatus = $derived<LabelStatus>(state.currentLabel?.status ?? "unlabeled");

  /**
   * Clear and Needs-adjustment both claim the stance works. If the hand
   * can't physically reach the prop from the current stance, those two
   * labels would be dishonest — disable them. Skip and Unreachable stay
   * available since they classify the pose itself, not the stance.
   */
  function isDisabled(status: LabelStatus): boolean {
    if (status === "clear" || status === "needs-adjustment") {
      return !state.currentReachability.reachable;
    }
    return false;
  }
</script>

<div class="controls">
  <div class="current">
    <span class="current-label">Current status:</span>
    <span class="current-value">{currentStatus}</span>
  </div>
  <div class="buttons">
    {#each buttons as btn}
      <button
        class="status-btn"
        class:active={currentStatus === btn.status}
        class:disabled={isDisabled(btn.status)}
        disabled={isDisabled(btn.status)}
        style="--btn-color: {btn.color};"
        onclick={() => state.labelCurrent(btn.status)}
        title={isDisabled(btn.status)
          ? "Stance is out of reach — hand can't physically touch the prop. Adjust stance or use Skip/Unreachable."
          : ""}
      >
        <span class="hotkey">{btn.hotkey}</span>
        <span class="label">{btn.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
  }
  .current {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
  }
  .current-label {
    opacity: 0.7;
  }
  .current-value {
    font-weight: 600;
    text-transform: capitalize;
  }
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .status-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--theme-panel-bg);
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    color: inherit;
    font-size: 14px;
    text-align: left;
  }
  .status-btn:hover {
    border-color: var(--btn-color);
  }
  .status-btn.active {
    border-color: var(--btn-color);
    background: color-mix(in srgb, var(--btn-color) 15%, transparent);
  }
  .status-btn.disabled,
  .status-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    filter: grayscale(50%);
  }
  .status-btn.disabled:hover,
  .status-btn:disabled:hover {
    border-color: transparent;
  }
  .hotkey {
    font-family: monospace;
    font-weight: 700;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--btn-color);
    color: white;
    border-radius: 4px;
    font-size: 12px;
  }
  .label {
    flex: 1;
  }
</style>
