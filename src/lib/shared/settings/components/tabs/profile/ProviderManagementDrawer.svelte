<!-- ProviderManagementDrawer.svelte - Mobile drawer for managing connected accounts -->
<script lang="ts">
  import Drawer from "../../../../foundation/ui/Drawer.svelte";
  import type { ProviderConfig } from "../../../../navigation/components/profile-settings/connectedAccounts.providers";

  interface Props {
    isOpen: boolean;
    providerConfig: ProviderConfig | null;
    providerEmail: string | null;
    canUnlink: boolean;
    onDisconnect: () => void;
    onCancel: () => void;
  }

  let {
    isOpen,
    providerConfig,
    providerEmail,
    canUnlink,
    onDisconnect,
    onCancel,
  }: Props = $props();
</script>

<Drawer bind:isOpen placement="bottom" ariaLabel="Manage connected account">
  {#if providerConfig}
    <div class="provider-drawer-content">
      <div class="drawer-provider-header">
        <div
          class="drawer-provider-icon"
          style="--provider-color: {providerConfig.color}; --provider-bg: {providerConfig.bgColor};"
        >
          <i class={providerConfig.icon} aria-hidden="true"></i>
        </div>
        <div class="drawer-provider-info">
          <h3 class="drawer-provider-name">{providerConfig.name}</h3>
          {#if providerEmail}
            <p class="drawer-provider-email">{providerEmail}</p>
          {/if}
        </div>
        <span class="connected-badge-drawer">
          <i class="fas fa-check-circle" aria-hidden="true"></i>
          <span>Connected</span>
        </span>
      </div>

      <div class="drawer-actions">
        {#if canUnlink}
          <button class="disconnect-btn" onclick={onDisconnect}>
            <i class="fas fa-unlink" aria-hidden="true"></i>
            <span>Disconnect {providerConfig.name}</span>
          </button>
          <p class="disconnect-warning">
            You won't be able to sign in with {providerConfig.name} after disconnecting.
          </p>
        {:else}
          <p class="cannot-disconnect-msg">
            <i class="fas fa-info-circle" aria-hidden="true"></i>
            This is your only sign-in method. Link another account before disconnecting.
          </p>
        {/if}
      </div>

      <button class="cancel-btn" onclick={onCancel}> Cancel </button>
    </div>
  {/if}
</Drawer>

<style>
  .provider-drawer-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 8px 4px 16px;
  }

  .drawer-provider-header {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .drawer-provider-icon {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--provider-bg);
    border-radius: 12px;
    flex-shrink: 0;
  }

  .drawer-provider-icon i {
    font-size: var(--font-size-xl);
    color: var(--provider-color);
  }

  .drawer-provider-info {
    flex: 1;
    min-width: 0;
  }

  .drawer-provider-name {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .drawer-provider-email {
    margin: 4px 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .connected-badge-drawer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(34, 197, 94, 0.15);
    border-radius: 20px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: #4ade80;
    flex-shrink: 0;
  }

  .drawer-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .disconnect-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 14px 20px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 12px;
    color: #fca5a5;
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .disconnect-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.6);
    color: #fecaca;
  }

  .disconnect-btn:active {
    transform: scale(0.98);
  }

  .disconnect-warning {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-align: center;
    line-height: 1.4;
  }

  .cannot-disconnect-msg {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 14px 16px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 10px;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.4;
  }

  .cannot-disconnect-msg i {
    color: var(--theme-accent, var(--theme-accent));
    font-size: var(--font-size-base);
    flex-shrink: 0;
  }

  .cancel-btn {
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 20px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text, var(--theme-text));
    font-size: var(--font-size-sm);
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .cancel-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, var(--theme-stroke-strong));
  }

  .cancel-btn:active {
    transform: scale(0.98);
  }
</style>
