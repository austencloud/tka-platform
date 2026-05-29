<!--
  ConnectedAccounts Component

  Displays linked OAuth providers and allows users to:
  - View currently linked accounts (Google, Facebook, Email/Password)
  - Link new providers to their account
  - Unlink providers (if more than one is linked)
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { linkGoogleAccount, linkFacebookAccount, unlinkProvider } from "$lib/shared/auth/services/authenticator";
  import { authState } from "../../../auth/state/authState.svelte";
  import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import { onMount } from "svelte";
  import EmailLinkingDrawer from "../../../auth/components/EmailLinkingDrawer.svelte";
  import { PROVIDERS, type ProviderId } from "./connectedAccounts.providers";
  import ConfirmDialog from "../../../foundation/ui/ConfirmDialog.svelte";

  // Services
  let hapticService = $state<HapticFeedback | null>(null);

  // UI State
  let linkingProvider = $state<ProviderId | null>(null);
  let unlinkingProvider = $state<ProviderId | null>(null);
  let errorMessage = $state<string | null>(null);

  // Email linking drawer state
  let showEmailLinkingDrawer = $state(false);

  // Unlink confirmation dialog state
  let showUnlinkConfirm = $state(false);
  let providerToUnlink = $state<ProviderId | null>(null);

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Derived state
  const linkedProviders = $derived(
    authState.user?.providerData?.map((p) => p.providerId) ?? []
  );

  const availableProviders = $derived(
    (Object.keys(PROVIDERS) as ProviderId[]).filter(
      (id) => !linkedProviders.includes(id)
    )
  );

  const canUnlink = $derived(linkedProviders.length > 1);

  // Get provider details from providerData
  function getProviderEmail(providerId: string): string | null {
    const provider = authState.user?.providerData?.find(
      (p) => p.providerId === providerId
    );
    return provider?.email ?? null;
  }

  // Link a new provider
  async function linkProvider(providerId: ProviderId) {
    // Prevent double-clicking
    if (linkingProvider) return;

    linkingProvider = providerId;
    errorMessage = null;
    hapticService?.trigger("selection");

    try {
      if (providerId === "google.com") {
        await linkGoogleAccount();
      } else if (providerId === "facebook.com") {
        await linkFacebookAccount();
      }
      // Note: Email/password linking requires a separate flow with password input

      // Popup completed successfully - refresh auth state to pick up new provider
      await authState.refreshUser();
      hapticService?.trigger("success");
      linkingProvider = null;
    } catch (error: unknown) {
      console.error(`Failed to link ${providerId}:`, error);
      const message = error instanceof Error ? error.message : "Unknown error";

      // Handle specific Firebase errors
      if (message.includes("already linked")) {
        errorMessage = `This ${PROVIDERS[providerId].name} account is already linked.`;
      } else if (message.includes("credential-already-in-use")) {
        errorMessage = `This ${PROVIDERS[providerId].name} account is already linked to another user.`;
      } else if (message.includes("No user is currently signed in")) {
        errorMessage = "You must be signed in to link accounts.";
      } else {
        errorMessage = `Failed to link ${PROVIDERS[providerId].name}. Please try again.`;
      }

      hapticService?.trigger("error");
      linkingProvider = null;
    }
  }

  // Request to unlink a provider (shows confirmation dialog)
  function requestUnlinkProvider(providerId: ProviderId) {
    if (unlinkingProvider || !canUnlink) return;
    providerToUnlink = providerId;
    showUnlinkConfirm = true;
  }

  // Actually unlink the provider (called after confirmation)
  async function confirmUnlinkProvider() {
    if (!providerToUnlink) return;

    const providerId = providerToUnlink;
    const providerName = PROVIDERS[providerId].name;

    unlinkingProvider = providerId;
    errorMessage = null;

    try {
      await unlinkProvider(providerId);
      hapticService?.trigger("success");
    } catch (error: unknown) {
      console.error(`Failed to unlink ${providerId}:`, error);
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("only authentication method")) {
        errorMessage = "Cannot disconnect your only sign-in method.";
      } else {
        errorMessage = `Failed to disconnect ${providerName}. Please try again.`;
      }

      hapticService?.trigger("error");
    } finally {
      unlinkingProvider = null;
      providerToUnlink = null;
    }
  }

  // Cancel unlinking
  function cancelUnlinkProvider() {
    providerToUnlink = null;
  }

  function dismissError() {
    errorMessage = null;
  }

  // Email linking drawer functions
  function openEmailLinkingDrawer() {
    showEmailLinkingDrawer = true;
    hapticService?.trigger("selection");
  }

  function handleEmailLinkingSuccess() {
    // The drawer handles closing itself
    // We just need to show feedback if needed
    hapticService?.trigger("success");
  }

  // Check if email is verified
  const isEmailVerified = $derived(authState.user?.emailVerified ?? false);
</script>

<div class="connected-accounts">
  <!-- Error Message -->
  {#if errorMessage}
    <div class="error-banner" role="alert">
      <span>{errorMessage}</span>
      <button class="dismiss-btn" onclick={dismissError} aria-label="Dismiss">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/if}

  <!-- All Providers - Compact list -->
  <div class="providers-list">
    <!-- Linked providers -->
    {#each linkedProviders as providerId}
      {@const config = PROVIDERS[providerId as ProviderId]}
      {@const isUnlinking = unlinkingProvider === providerId}
      {#if config}
        <div
          class="provider-row linked"
          style="--provider-color: {config.color};"
        >
          <i class="{config.icon} provider-icon" aria-hidden="true"></i>
          <span class="provider-name">{config.name}</span>
          <i
            class="fas fa-check-circle status-icon connected"
            aria-hidden="true"
          ></i>
          {#if canUnlink}
            <button
              class="action-btn unlink"
              onclick={() => requestUnlinkProvider(providerId as ProviderId)}
              disabled={isUnlinking}
              aria-label="Disconnect {config.name}"
            >
              {#if isUnlinking}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              {:else}
                <i class="fas fa-unlink" aria-hidden="true"></i>
              {/if}
            </button>
          {/if}
        </div>
      {/if}
    {/each}

    <!-- Available providers -->
    {#each availableProviders as providerId}
      {@const config = PROVIDERS[providerId]}
      {@const isLinking = linkingProvider === providerId}
      <button
        class="provider-row available"
        style="--provider-color: {config.color};"
        onclick={() =>
          providerId === "password"
            ? openEmailLinkingDrawer()
            : linkProvider(providerId)}
        disabled={isLinking || linkingProvider !== null}
      >
        {#if isLinking}
          <i class="fas fa-spinner fa-spin provider-icon" aria-hidden="true"
          ></i>
        {:else}
          <i class="{config.icon} provider-icon" aria-hidden="true"></i>
        {/if}
        <span class="provider-name"
          >{isLinking ? "Connecting..." : `Add ${config.name}`}</span
        >
        <i class="fas fa-plus action-icon" aria-hidden="true"></i>
      </button>
    {/each}
  </div>

  {#if !canUnlink && linkedProviders.length === 1}
    <p class="hint">Add another method to enable disconnecting</p>
  {/if}
</div>

<!-- Email Linking Drawer -->
<EmailLinkingDrawer
  bind:isOpen={showEmailLinkingDrawer}
  onSuccess={handleEmailLinkingSuccess}
/>

<!-- Unlink Confirmation Dialog -->
{#if providerToUnlink}
  {@const config = PROVIDERS[providerToUnlink]}
  <ConfirmDialog
    bind:isOpen={showUnlinkConfirm}
    title="Disconnect {config.name}?"
    message="You won't be able to sign in with {config.name} after disconnecting. Make sure you have another sign-in method available."
    confirmText="Disconnect"
    cancelText="Keep Connected"
    variant="warning"
    confirmDelay={5}
    onConfirm={confirmUnlinkProvider}
    onCancel={cancelUnlinkProvider}
  />
{/if}

<style>
  .connected-accounts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Error Banner - Compact */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(239, 68, 68, 0.12);
    border-radius: 8px;
    color: #fca5a5;
    font-size: var(--font-size-compact);
  }

  .error-banner span {
    flex: 1;
  }

  .dismiss-btn {
    background: none;
    border: none;
    padding: 4px;
    color: var(--theme-text-dim);
    cursor: pointer;
    border-radius: 4px;
  }

  .dismiss-btn:hover {
    color: var(--theme-text);
  }

  /* Provider List - Compact rows */
  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Provider Row - Single line compact display */
  .provider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    transition: all var(--duration-fast) ease;
  }

  .provider-row.linked {
    background: color-mix(in srgb, var(--provider-color) 8%, transparent);
    border-color: color-mix(in srgb, var(--provider-color) 20%, transparent);
  }

  .provider-row.available {
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: inherit;
    border: 1px dashed var(--theme-stroke);
    background: transparent;
  }

  .provider-row.available:hover:not(:disabled) {
    background: var(--theme-card-bg);
    border-style: solid;
    border-color: color-mix(in srgb, var(--provider-color) 40%, transparent);
  }

  .provider-row.available:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Provider Icon - Inline, no background */
  .provider-icon {
    font-size: 16px;
    color: var(--provider-color);
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  /* Provider Name */
  .provider-name {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text);
  }

  /* Status Icon - Connected checkmark */
  .status-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .status-icon.connected {
    color: var(--semantic-success);
  }

  /* Action Icon - Plus for available */
  .action-icon {
    font-size: 12px;
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .provider-row.available:hover:not(:disabled) .action-icon {
    color: var(--provider-color);
  }

  /* Action Button - Unlink */
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .action-btn.unlink:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.15);
    color: var(--semantic-error);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn i {
    font-size: 12px;
  }

  /* Hint - Compact */
  .hint {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    margin: 2px 0 0 0;
    padding: 6px 10px;
    background: var(--theme-card-bg);
    border-radius: 6px;
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .provider-row,
    .action-btn {
      transition: none;
    }
  }

  .provider-row.available:focus-visible,
  .action-btn:focus-visible,
  .dismiss-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
</style>
