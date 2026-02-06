<!--
  ConnectedAccountsPreview Component

  Read-only display of a user's connected OAuth providers.
  Used in admin preview mode to view another user's linked accounts.
-->
<script lang="ts">
  import type { PreviewAuthProvider } from "../../../debug/state/user-preview-state.svelte";
  import { PROVIDERS, type ProviderId } from "./connectedAccounts.providers";

  interface Props {
    providers?: PreviewAuthProvider[];
    emailVerified?: boolean;
    loading?: boolean;
  }

  let {
    providers = [],
    emailVerified = false,
    loading = false,
  }: Props = $props();

  // Map Firebase provider IDs to our config
  function getProviderConfig(providerId: string) {
    return PROVIDERS[providerId as ProviderId] ?? null;
  }
</script>

<div class="connected-accounts-preview">
  {#if loading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading connected accounts...</span>
    </div>
  {:else if providers.length > 0}
    <div class="section">
      <h4 class="section-title">Linked Accounts</h4>
      <div class="providers-list">
        {#each providers as provider}
          {@const config = getProviderConfig(provider.providerId)}
          {#if config}
            <div
              class="provider-card"
              style="--provider-color: {config.color}; --provider-bg: {config.bgColor}; --provider-border: {config.borderColor};"
            >
              <div class="provider-icon">
                <i class={config.icon} aria-hidden="true"></i>
              </div>
              <div class="provider-info">
                <span class="provider-name">{config.name}</span>
                {#if provider.email}
                  <span class="provider-email">{provider.email}</span>
                {/if}
              </div>
              <div class="provider-status">
                {#if provider.providerId === "password" && !emailVerified}
                  <span class="verification-badge pending">
                    <i class="fas fa-clock" aria-hidden="true"></i>
                    <span class="badge-text">Unverified</span>
                  </span>
                {:else}
                  <span class="connected-badge">
                    <i class="fas fa-check-circle" aria-hidden="true"></i>
                    <span class="badge-text">Connected</span>
                  </span>
                {/if}
              </div>
            </div>
          {:else}
            <!-- Unknown provider - show generic card -->
            <div
              class="provider-card"
              style="--provider-color: #9ca3af; --provider-bg: rgba(156, 163, 175, 0.1); --provider-border: rgba(156, 163, 175, 0.2);"
            >
              <div class="provider-icon">
                <i class="fas fa-plug" aria-hidden="true"></i>
              </div>
              <div class="provider-info">
                <span class="provider-name">{provider.providerId}</span>
                {#if provider.email}
                  <span class="provider-email">{provider.email}</span>
                {/if}
              </div>
              <span class="connected-badge">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
              </span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <i class="fas fa-unlink" aria-hidden="true"></i>
      <p>No accounts connected</p>
    </div>
  {/if}
</div>

<style>
  .connected-accounts-preview {
    container-type: inline-size;
    container-name: connected-accounts-preview;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 16px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .loading-state i {
    font-size: var(--font-size-lg);
    color: var(--theme-accent);
  }

  /* Section Styles */
  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Provider List */
  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Provider Card */
  .provider-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: var(--provider-bg);
    border: 1px solid var(--provider-border);
    border-radius: 12px;
  }

  /* Provider Icon */
  .provider-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-stroke);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .provider-icon i {
    font-size: var(--font-size-lg);
    color: var(--provider-color);
  }

  /* Provider Info */
  .provider-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .provider-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
  }

  .provider-email {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Connected Badge */
  .provider-status {
    flex-shrink: 0;
  }

  .connected-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(34, 197, 94, 0.15);
    border-radius: 20px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: #4ade80;
  }

  .connected-badge i {
    font-size: var(--font-size-compact);
  }

  /* Verification Badge (for unverified email) */
  .verification-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 20px;
    font-size: var(--font-size-compact);
    font-weight: 500;
  }

  .verification-badge.pending {
    background: rgba(245, 158, 11, 0.15);
    color: var(--semantic-warning);
  }

  .verification-badge i {
    font-size: var(--font-size-compact);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 16px;
    color: var(--theme-text-dim);
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  /* Mobile - compact layout */
  @container connected-accounts-preview (max-width: 400px) {
    .provider-card {
      padding: 12px 14px;
      gap: 10px;
    }

    .provider-icon {
      width: 36px;
      height: 36px;
    }

    .provider-icon i {
      font-size: var(--font-size-base);
    }

    .provider-name {
      font-size: var(--font-size-sm);
    }

    .provider-email {
      font-size: var(--font-size-compact);
    }

    .connected-badge,
    .verification-badge {
      padding: 5px 8px;
      font-size: var(--font-size-compact);
      gap: 4px;
    }

    /* Hide badge text on mobile to prevent overflow */
    .badge-text {
      display: none;
    }
  }
</style>
