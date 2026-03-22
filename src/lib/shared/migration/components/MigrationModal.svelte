<!--
  MigrationModal.svelte

  Simple, friendly announcement about the TKA Studio → TKA Composer rebrand.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import {
    MIGRATION_CONFIG,
    getNewDomainUrl,
  } from "../config/migration-config";
  import { migrationState } from "../state/migration-state.svelte";

  interface Props {
    onDismiss: () => void;
  }

  let { onDismiss }: Props = $props();

  const newUrl = getNewDomainUrl();

  function handleUpdate() {
    migrationState.markMigrationCompleted();
    window.location.href = newUrl;
  }

  function handleRemindLater() {
    migrationState.recordReminderShown();
    onDismiss();
  }
</script>

<div
  class="modal-overlay"
  transition:fade={{ duration: 200 }}
  role="dialog"
  aria-modal="true"
  aria-labelledby="migration-title"
>
  <div class="modal-content" transition:fly={{ y: 30, duration: 300 }}>
    <!-- Header with app icon -->
    <div class="modal-header">
      <div class="app-icon">
        <i class="fas fa-feather-alt" aria-hidden="true"></i>
      </div>
    </div>

    <!-- Body -->
    <div class="modal-body">
      <h2 id="migration-title">New Name, New Home</h2>

      <p class="announcement">
        <strong>TKA Studio</strong> is now <strong>TKA Composer</strong>
      </p>

      <div class="domain-change">
        <span class="new-domain">{MIGRATION_CONFIG.NEW_DOMAIN}</span>
      </div>

      <p class="explanation">
        To continue using the app, you'll need to reinstall it from the new
        address. Your account and all your data will be there waiting for you.
      </p>
    </div>

    <!-- Actions - always visible -->
    <div class="modal-footer">
      <button class="primary-button" onclick={handleUpdate}>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
        Update Now
      </button>

      <button class="dismiss-button" onclick={handleRemindLater}>
        Remind Me Later
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    padding: 20px;
  }

  .modal-content {
    max-width: 400px;
    width: 100%;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 20px;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  /* Header */
  .modal-header {
    display: flex;
    justify-content: center;
    padding: 32px 24px 16px;
  }

  .app-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background: linear-gradient(
      135deg,
      var(--theme-accent),
      var(--theme-accent-strong)
    );
    border-radius: 18px;
    font-size: var(--font-size-3xl);
    color: white;
  }

  /* Body */
  .modal-body {
    padding: 8px 24px 24px;
    text-align: center;
  }

  .modal-body h2 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--theme-text);
    margin: 0 0 16px 0;
  }

  .announcement {
    font-size: var(--font-size-base);
    color: var(--theme-text);
    margin: 0 0 20px 0;
  }

  .domain-change {
    display: flex;
    justify-content: center;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .new-domain {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-accent, var(--theme-accent));
  }

  .explanation {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
    line-height: 1.6;
    margin: 0;
  }

  /* Footer with actions */
  .modal-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 24px 24px;
  }

  .primary-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 24px;
    background: linear-gradient(
      135deg,
      var(--theme-accent),
      var(--theme-accent-strong)
    );
    border: none;
    border-radius: 12px;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .primary-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  }

  .dismiss-button {
    padding: 12px 24px;
    background: transparent;
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 12px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .dismiss-button:hover {
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .modal-content {
      border-radius: 16px;
      margin: 12px;
    }

    .modal-header {
      padding: 24px 20px 12px;
    }

    .app-icon {
      width: 64px;
      height: 64px;
      font-size: var(--font-size-3xl);
    }

    .modal-body {
      padding: 8px 20px 20px;
    }

    .modal-body h2 {
      font-size: var(--font-size-xl);
    }

    .modal-footer {
      padding: 0 20px 20px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .primary-button:hover {
      transform: none;
    }
  }
</style>
