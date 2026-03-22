<!--
  MigrationBanner.svelte

  Persistent top banner for migration reminders (non-modal).
  Less intrusive than the modal, shown for subsequent reminders.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import {
    MIGRATION_CONFIG,
    getNewDomainUrl,
    formatDeadline,
  } from "../config/migration-config";
  import { migrationState } from "../state/migration-state.svelte";

  interface Props {
    onShowModal: () => void;
    onDismiss: () => void;
  }

  let { onShowModal, onDismiss }: Props = $props();

  const severity = $derived(migrationState.severity);
  const daysLeft = $derived(migrationState.daysUntilDeadline);
  const remindersRemaining = $derived(migrationState.remindersRemaining);
  const newUrl = $derived(getNewDomainUrl());

  function getSeverityConfig() {
    switch (severity) {
      case "critical":
        return {
          icon: "fa-exclamation-triangle",
          bg: "linear-gradient(90deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))",
          border: "rgba(239, 68, 68, 0.5)",
        };
      case "warning":
        return {
          icon: "fa-exclamation-circle",
          bg: "linear-gradient(90deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))",
          border: "rgba(245, 158, 11, 0.5)",
        };
      default:
        return {
          icon: "fa-info-circle",
          bg: "linear-gradient(90deg, rgba(99, 102, 241, 0.95), rgba(79, 70, 229, 0.95))",
          border: "rgba(99, 102, 241, 0.5)",
        };
    }
  }

  const config = $derived(getSeverityConfig());

  function handleGoToNewSite() {
    migrationState.markMigrationCompleted();
    window.location.href = newUrl;
  }

  function handleDismiss() {
    migrationState.recordReminderShown();
    onDismiss();
  }
</script>

<div
  class="migration-banner"
  class:critical={severity === "critical"}
  style="background: {config.bg}; border-bottom-color: {config.border};"
  transition:slide={{ duration: 300 }}
  role="alert"
>
  <div class="banner-content">
    <div class="banner-icon">
      <i class="fas {config.icon}" aria-hidden="true"></i>
    </div>

    <div class="banner-message">
      <strong>We're moving to {MIGRATION_CONFIG.NEW_DOMAIN}!</strong>
      {#if daysLeft > 0}
        <span class="deadline">
          {daysLeft}
          {daysLeft === 1 ? "day" : "days"} until {MIGRATION_CONFIG.OLD_DOMAIN} stops
          working
        </span>
      {:else}
        <span class="deadline urgent">Update now to keep using TKA Composer</span>
      {/if}
    </div>

    <div class="banner-actions">
      <button class="update-button" onclick={handleGoToNewSite}>
        <i class="fas fa-external-link-alt" aria-hidden="true"></i>
        <span>Update Now</span>
      </button>

      <button class="learn-more" onclick={onShowModal}> Learn More </button>

      {#if remindersRemaining > 0}
        <button
          class="dismiss-button"
          onclick={handleDismiss}
          title="Remind me later ({remindersRemaining} left)"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .migration-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    padding: 10px 16px;
    border-bottom: 2px solid;
    box-shadow: 0 4px 20px var(--theme-shadow);
  }

  .banner-content {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .banner-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  .banner-message {
    flex: 1;
    min-width: 0;
    color: white;
    font-size: var(--font-size-compact);
    line-height: 1.4;
  }

  .banner-message strong {
    font-weight: 600;
  }

  .deadline {
    display: block;
    opacity: 0.9;
    font-size: var(--font-size-compact);
  }

  .deadline.urgent {
    font-weight: 600;
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .update-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.95);
    border: none;
    border-radius: 6px;
    color: #1a1a2e;
    font-size: var(--font-size-compact);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .update-button:hover {
    background: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .learn-more {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    color: white;
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .learn-more:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .dismiss-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .dismiss-button:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  /* Critical pulse animation */
  .migration-banner.critical {
    animation: critical-pulse 2s ease-in-out infinite;
  }

  @keyframes critical-pulse {
    0%,
    100% {
      box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
    }
    50% {
      box-shadow: 0 4px 30px rgba(239, 68, 68, 0.6);
    }
  }

  /* Mobile layout */
  @media (max-width: 640px) {
    .migration-banner {
      padding: 12px;
    }

    .banner-content {
      flex-wrap: wrap;
      gap: 10px;
    }

    .banner-message {
      flex: 1 1 calc(100% - 44px);
      order: 1;
    }

    .banner-icon {
      order: 0;
    }

    .banner-actions {
      order: 2;
      width: 100%;
      justify-content: flex-start;
      padding-top: 4px;
    }

    .dismiss-button {
      margin-left: auto;
    }

    .update-button span {
      display: none;
    }

    .update-button {
      padding: 8px 10px;
    }

    .update-button::after {
      content: "Update";
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .migration-banner.critical {
      animation: none;
    }
  }
</style>
