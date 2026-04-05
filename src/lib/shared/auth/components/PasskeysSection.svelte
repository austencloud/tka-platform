<script lang="ts">
  import type { IHapticFeedback } from "../../application/services/contracts/IHapticFeedback";
  import { listPasskeys, registerPasskey } from "../webauthn/passkeysClient";

  interface Props {
    hapticService?: IHapticFeedback | null;
  }

  let { hapticService = null }: Props = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let passkeys = $state<
    Array<{
      credentialId: string;
      name: string | null;
      createdAt: string | null;
      lastUsedAt: string | null;
    }>
  >([]);

  async function refresh() {
    loading = true;
    error = null;
    try {
      const res = await listPasskeys();
      passkeys = res.passkeys ?? [];
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Could not load passkeys. Try again.";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void refresh();
  });

  async function handleSetup() {
    if (loading) return;
    hapticService?.trigger("selection");
    loading = true;
    error = null;
    try {
      await registerPasskey();
      hapticService?.trigger("success");
      await refresh();
    } catch (e: unknown) {
      // User cancelled the WebAuthn dialog - not an error, just exit silently
      if (e instanceof Error && e.name === "NotAllowedError") {
        return;
      }
      hapticService?.trigger("error");
      error = e instanceof Error ? e.message : "Setup failed";
    } finally {
      loading = false;
    }
  }

  const isSecured = $derived(passkeys.length > 0);
</script>

<section class="security-status">
  {#if isSecured}
    <!-- Secured state - simple confirmation -->
    <div class="secured-row">
      <div class="secured-info">
        <i class="fas fa-check-circle" aria-hidden="true"></i>
        <span>Account secured with biometrics</span>
      </div>
      <button
        class="add-another"
        type="button"
        onclick={handleSetup}
        disabled={loading}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add device
      </button>
    </div>
  {:else}
    <!-- Not secured - prompt to set up -->
    <div class="setup-prompt">
      <p class="setup-text">
        Use Face ID, Touch ID, or fingerprint to secure sensitive actions.
      </p>
      <button
        class="setup-btn"
        type="button"
        onclick={handleSetup}
        disabled={loading}
      >
        <i class="fas fa-fingerprint" aria-hidden="true"></i>
        {loading ? "Setting up..." : "Set up biometrics"}
      </button>
    </div>
  {/if}

  {#if error}
    <p class="error-message" role="alert">
      {error}
    </p>
  {/if}
</section>

<style>
  .security-status {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Secured state */
  .secured-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .secured-info {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
  }

  .secured-info i {
    color: var(--semantic-success);
    font-size: 18px;
  }

  .add-another {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .add-another:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .add-another i {
    font-size: 11px;
  }

  /* Not secured state */
  .setup-prompt {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .setup-text {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
    line-height: 1.5;
  }

  .setup-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(135deg, var(--semantic-success), #16a34a);
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .setup-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .setup-btn i {
    font-size: 16px;
  }

  /* Shared */
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    margin: 0;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.12);
    color: var(--semantic-error);
    font-size: var(--font-size-compact);
  }

  @media (prefers-reduced-motion: reduce) {
    .setup-btn,
    .add-another {
      transition: none;
    }
    .setup-btn:hover {
      transform: none;
    }
  }
</style>
