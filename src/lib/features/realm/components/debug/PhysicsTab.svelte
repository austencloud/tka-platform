<script lang="ts">
  /**
   * PhysicsTab - Debug panel tab for physics controls
   *
   * Controls: Noclip mode, collision info
   */
  import { ChipToggle } from '@austencloud/chip-toggle';

  interface Props {
    noclipEnabled: boolean;
    isGrounded: boolean;
    colliderCount: number;
    walkSpeed: number;
    sprintSpeed: number;
    onToggleNoclip: () => void;
  }

  let {
    noclipEnabled,
    isGrounded,
    colliderCount,
    walkSpeed = 5.0,
    sprintSpeed = 10.0,
    onToggleNoclip,
  }: Props = $props();

  const modeLabel = $derived(noclipEnabled ? "Flying" : "Walking");
</script>

<div class="tab-content">
  <div class="toggle-row">
    <ChipToggle
      label="Noclip"
      icon="fa-ghost"
      active={noclipEnabled}
      color="amber"
      size="sm"
      onclick={onToggleNoclip}
    />
  </div>

  <div class="details-section">
    <div class="detail-group">
      <div class="detail-title">
        <i class="fas fa-person-running" style="color: #60a5fa" aria-hidden="true"></i>
        Movement
      </div>
      <div class="detail-row">
        <span class="detail-label">Mode</span>
        <span class="detail-value" class:noclip={noclipEnabled}>{modeLabel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Grounded</span>
        <span class="detail-value status" class:ok={isGrounded} class:pending={!isGrounded}>
          {isGrounded ? "Yes" : "No"}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Walk Speed</span>
        <span class="detail-value">{walkSpeed.toFixed(1)} m/s</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Sprint Speed</span>
        <span class="detail-value">{sprintSpeed.toFixed(1)} m/s</span>
      </div>
    </div>

    <div class="detail-group">
      <div class="detail-title">
        <i class="fas fa-shapes" style="color: #f59e0b" aria-hidden="true"></i>
        Colliders
      </div>
      <div class="detail-row">
        <span class="detail-label">Count</span>
        <span class="detail-value">{colliderCount}</span>
      </div>
    </div>
  </div>

  <div class="hint">
    <kbd>G</kbd> Toggle fly mode
    {#if noclipEnabled}
      <br />Look up/down to fly vertically
    {/if}
  </div>
</div>

<style>
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .details-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-group {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
    border-radius: 12px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .detail-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: white;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .detail-title i {
    font-size: 14px;
    filter: drop-shadow(0 0 8px currentColor);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 14px;
  }

  .detail-label {
    color: rgba(255, 255, 255, 0.6);
  }

  .detail-value {
    color: white;
    font-weight: 600;
  }

  .detail-value.noclip {
    color: #fcd34d;
    text-shadow: 0 0 10px rgba(252, 211, 77, 0.5);
  }

  .detail-value.status.ok {
    color: #4ade80;
  }

  .detail-value.status.pending {
    color: #94a3b8;
  }

  .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    padding: 10px 0 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    line-height: 1.6;
  }

  .hint kbd {
    display: inline-block;
    padding: 4px 8px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
  }
</style>
