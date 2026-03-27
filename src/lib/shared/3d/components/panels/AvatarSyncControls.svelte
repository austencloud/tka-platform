<script lang="ts">
  /**
   * AvatarSyncControls - UI for avatar synchronization settings
   *
   * Provides toggle for sync mode and beat offset stepper.
   * Compact design for side panel placement.
   */

  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { AvatarSyncState } from "../../state/avatar-sync-state.svelte";

  interface Props {
    syncState: AvatarSyncState;
  }

  let { syncState }: Props = $props();

  // Derived for cleaner template
  const canDecrement = $derived(syncState.stepOffset > syncState.minOffset);
  const canIncrement = $derived(syncState.stepOffset < syncState.maxOffset);
</script>

<div class="sync-controls">
  <!-- Sync Toggle -->
  <button
    class="sync-toggle"
    class:active={syncState.isSyncEnabled}
    onclick={() => syncState.toggleSync()}
    aria-pressed={syncState.isSyncEnabled}
    aria-label={syncState.isSyncEnabled ? "Disable avatar sync" : "Enable avatar sync"}
  >
    <i class="fas fa-link" aria-hidden="true"></i>
    <span>{t('avatar_sync')}</span>
  </button>

  <!-- Expanded controls when sync is enabled -->
  {#if syncState.isSyncEnabled}
    <div class="sync-details">
      <!-- Beat offset stepper -->
      <div class="offset-control">
        <span class="offset-label">{t('avatar_beat_offset')}</span>
        <div class="stepper">
          <button
            class="stepper-btn"
            onclick={() => syncState.decrementOffset()}
            disabled={!canDecrement}
            aria-label="Decrease offset"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <span class="offset-value" class:negative={syncState.stepOffset < 0}>
            {syncState.stepOffset > 0 ? "+" : ""}{syncState.stepOffset}
          </span>
          <button
            class="stepper-btn"
            onclick={() => syncState.incrementOffset()}
            disabled={!canIncrement}
            aria-label="Increase offset"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <!-- Offset description -->
      <p class="offset-description">{syncState.offsetDescription}</p>

      <!-- Beat display -->
      <div class="beat-display">
        <div class="beat-indicator">
          <span class="beat-label">{t('avatar_master')}</span>
          <span class="beat-value">{syncState.master.currentStepIndex + 1}</span
          >
        </div>
        <i class="fas fa-arrow-right connector" aria-hidden="true"></i>
        <div class="beat-indicator">
          <span class="beat-label">{t('avatar_follower')}</span>
          <span class="beat-value"
            >{syncState.follower.currentStepIndex + 1}</span
          >
        </div>
      </div>

      <!-- Swap master button -->
      <button class="swap-btn" onclick={() => syncState.swapMaster()} aria-label="Swap master avatar">
        <i class="fas fa-exchange-alt" aria-hidden="true"></i>
        <span>{t('avatar_swap_master')}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .sync-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
  }

  .sync-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .sync-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .sync-toggle.active {
    background: var(--theme-accent, #3b82f6);
    border-color: var(--theme-accent, #3b82f6);
    color: white;
  }

  .sync-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .offset-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .offset-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    padding: 0.25rem;
  }

  .stepper-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .stepper-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .offset-value {
    min-width: 2.5rem;
    text-align: center;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #ffffff);
  }

  .offset-value.negative {
    color: var(--semantic-warning, #f59e0b);
  }

  .offset-description {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
  }

  .beat-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.5));
    border-radius: 6px;
  }

  .beat-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .beat-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .beat-value {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #ffffff);
  }

  .connector {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 0.75rem;
  }

  .swap-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    height: 36px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .swap-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }
</style>
