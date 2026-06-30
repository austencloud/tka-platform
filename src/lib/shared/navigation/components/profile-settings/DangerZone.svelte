<!--
  DangerZone Component

  Handles account deletion with collapsible disclosure pattern.
  User must expand section before seeing deletion option.
  Includes GitHub-style text confirmation barrier.
-->
<script lang="ts">
  import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import type { DeleteReauth } from "$lib/shared/auth/services/account-manager";
  import { getProfileSettingsContext } from "../../state/profile-settings-context.svelte";

  const ctx = getProfileSettingsContext();

  let { onDeleteAccount, hapticService, userIdentifier, providerIds, isAdmin } = $props<{
    onDeleteAccount: (reauth: DeleteReauth) => Promise<void>;
    hapticService: HapticFeedback | null;
    userIdentifier: string;
    providerIds: string[];
    isAdmin: boolean;
  }>();

  let isExpanded = $state(false);
  let confirmationText = $state("");
  let deletePassword = $state("");
  let deleteError = $state("");
  let isDeleting = $state(false);

  // Which reauth methods this account actually has. OAuth accounts (Google /
  // Facebook / magic-link upgrades) have no password, so they reauthenticate
  // via a popup instead of a password field.
  let hasGoogle = $derived(providerIds.includes("google.com"));
  let hasFacebook = $derived(providerIds.includes("facebook.com"));
  let hasOAuth = $derived(hasGoogle || hasFacebook);

  // The GitHub-style barrier: type your username/email. OAuth reauth needs only
  // this match (the popup proves identity); password reauth also needs a password.
  let usernameMatches = $derived(
    confirmationText.toLowerCase().trim() ===
      userIdentifier.toLowerCase().trim()
  );
  let isConfirmationValid = $derived(
    usernameMatches && (hasOAuth || deletePassword.length > 0)
  );

  async function runDelete(reauth: DeleteReauth) {
    if (!usernameMatches || isDeleting) return;
    hapticService?.trigger("warning");
    isDeleting = true;
    deleteError = "";
    try {
      await onDeleteAccount(reauth);
    } catch (e: unknown) {
      deleteError = e instanceof Error ? e.message : "Failed to delete account";
      hapticService?.trigger("error");
    } finally {
      isDeleting = false;
    }
  }

  function toggleExpanded() {
    hapticService?.trigger("selection");
    isExpanded = !isExpanded;
    if (!isExpanded) {
      ctx.ui.showDeleteConfirmation = false;
      confirmationText = "";
      deletePassword = "";
      deleteError = "";
    }
  }

  function handleShowConfirmation() {
    hapticService?.trigger("selection");
    ctx.ui.showDeleteConfirmation = true;
  }

  function handleCancel() {
    hapticService?.trigger("selection");
    ctx.ui.showDeleteConfirmation = false;
    confirmationText = "";
    deletePassword = "";
    deleteError = "";
  }

</script>

<div class="danger-section">
  <!-- Collapsible trigger -->
  <button
    class="disclosure-button"
    onclick={toggleExpanded}
    aria-expanded={isExpanded}
    aria-controls="danger-zone-content"
  >
    <i
      class="fas fa-chevron-right"
      class:expanded={isExpanded}
      aria-hidden="true"
    ></i>
    <span>Account Deletion</span>
  </button>

  {#if isExpanded}
    <div id="danger-zone-content" class="danger-content">
      {#if isAdmin}
        <p class="warning-text">
          <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
          Admin accounts can't be deleted in-app. Manage account removal through
          the Firebase console.
        </p>
      {:else}
      <p class="warning-text">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        Deleting your account is permanent and cannot be undone. All your progress
        and data will be lost.
      </p>

      {#if !ctx.ui.showDeleteConfirmation}
        <button class="button button--danger" onclick={handleShowConfirmation}>
          <i class="fas fa-trash-alt" aria-hidden="true"></i>
          Delete My Account
        </button>
      {:else}
        <div class="confirmation-box">
          <p class="confirmation-text">
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
            Are you absolutely sure? This action is irreversible.
          </p>

          <div class="confirmation-input-section">
            <label for="delete-confirmation" class="confirmation-label">
              To confirm, type <strong>{userIdentifier}</strong> below:
            </label>
            <input
              id="delete-confirmation"
              type="text"
              class="confirmation-input"
              class:valid={isConfirmationValid}
              placeholder={userIdentifier}
              bind:value={confirmationText}
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          {#if hasOAuth}
            <p class="confirmation-label reauth-hint">
              Confirm with your linked account to permanently delete.
            </p>
          {:else}
            <div class="confirmation-input-section">
              <label for="delete-password" class="confirmation-label">
                Enter your <strong>password</strong> to confirm:
              </label>
              <input
                id="delete-password"
                type="password"
                class="confirmation-input"
                class:valid={deletePassword.length > 0}
                placeholder="Your current password"
                bind:value={deletePassword}
                autocomplete="current-password"
                disabled={isDeleting}
              />
            </div>
          {/if}

          {#if deleteError}
            <p class="error-message" role="alert">
              <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
              {deleteError}
            </p>
          {/if}

          <div class="button-row">
            <button class="button button--secondary" onclick={handleCancel}>
              Cancel
            </button>
            {#if hasOAuth}
              {#if hasGoogle}
                <button
                  class="button button--danger-confirm"
                  onclick={() => runDelete({ method: "google" })}
                  disabled={!usernameMatches || isDeleting}
                >
                  <i class="fab fa-google" aria-hidden="true"></i>
                  {isDeleting ? "Deleting..." : "Confirm with Google"}
                </button>
              {/if}
              {#if hasFacebook}
                <button
                  class="button button--danger-confirm"
                  onclick={() => runDelete({ method: "facebook" })}
                  disabled={!usernameMatches || isDeleting}
                >
                  <i class="fab fa-facebook-f" aria-hidden="true"></i>
                  {isDeleting ? "Deleting..." : "Confirm with Facebook"}
                </button>
              {/if}
            {:else}
              <button
                class="button button--danger-confirm"
                onclick={() =>
                  runDelete({ method: "password", password: deletePassword })}
                disabled={!isConfirmationValid || isDeleting}
              >
                <i class="fas fa-trash-alt" aria-hidden="true"></i>
                {isDeleting ? "Deleting..." : "Yes, Delete Forever"}
              </button>
            {/if}
          </div>
        </div>
      {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .danger-section {
    width: 100%;
    max-width: min(900px, 85vw); /* Match SecurityTab card width */
    margin: 0 auto;
    border-top: 1px solid var(--theme-stroke, var(--theme-stroke));
    padding-top: clamp(20px, 3vh, 28px);
  }

  /* Disclosure Button */
  .disclosure-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-radius: 10px;
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 80%, transparent);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .disclosure-button:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 95%, transparent);
  }

  .disclosure-button i {
    font-size: var(--font-size-compact);
    transition: transform var(--duration-normal) ease;
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 70%, transparent);
  }

  .disclosure-button i.expanded {
    transform: rotate(90deg);
  }

  /* Danger Content */
  .danger-content {
    margin-top: 16px;
    padding: 20px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border-radius: 12px;
  }

  .warning-text {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.6;
    margin: 0 0 16px 0;
  }

  .warning-text i {
    font-size: var(--font-size-base);
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 70%, transparent);
    margin-top: 2px;
    flex-shrink: 0;
  }

  .confirmation-box {
    background: var(--theme-panel-bg);
    border-radius: 10px;
    padding: 16px;
    margin-top: 12px;
  }

  .confirmation-text {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-sm);
    color: var(--semantic-error);
    margin: 0 0 16px 0;
    font-weight: 500;
  }

  .confirmation-text i {
    font-size: var(--font-size-lg);
    flex-shrink: 0;
  }

  /* Confirmation Input */
  .confirmation-input-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .confirmation-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.5;
  }

  .reauth-hint {
    margin: 0 0 16px 0;
  }

  .confirmation-label strong {
    color: var(--semantic-error);
    font-family:
      ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: var(--font-size-compact);
    letter-spacing: 0.5px;
  }

  .confirmation-input {
    width: 100%;
    padding: 12px 14px;
    font-size: var(--font-size-sm);
    font-family:
      ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    letter-spacing: 0.5px;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid color-mix(in srgb, var(--semantic-error, #ef4444) 25%, transparent);
    border-radius: 8px;
    color: var(--theme-text);
    outline: none;
    transition: all var(--duration-normal) ease;
  }

  .confirmation-input::placeholder {
    color: rgba(255, 255, 255, 0.5); /* Improved contrast for WCAG AAA */
    font-family: inherit;
  }

  .confirmation-input:focus {
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 50%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
  }

  .confirmation-input.valid {
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 60%, transparent);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 8%, transparent);
  }

  /* Buttons */
  .button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 20px;
    min-height: var(--min-touch-target);
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    border: none;
  }

  .button i {
    font-size: var(--font-size-sm);
  }

  .button--secondary {
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    color: var(--theme-text, var(--theme-text));
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
  }

  .button--secondary:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .button--danger {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 90%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 25%, transparent);
  }

  .button--danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
  }

  .button--danger-confirm {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    color: var(--semantic-error);
    border: 2px solid color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
  }

  .button--danger-confirm:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 60%, transparent);
  }

  .button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .button-row {
    display: flex;
    gap: 12px;
  }

  .button-row .button {
    flex: 1;
  }

  /* Mobile Responsive */
  @media (max-width: 480px) {
    .danger-section {
      padding-top: 16px;
    }

    .button-row {
      flex-direction: column;
    }

    .button-row .button {
      width: 100%;
    }
  }

  /* Accessibility - Focus Indicators */
  .disclosure-button:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--theme-accent) 90%, transparent);
    outline-offset: 2px;
  }

  .button:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--theme-accent) 90%, transparent);
    outline-offset: 2px;
  }

  .button--danger:focus-visible,
  .button--danger-confirm:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--semantic-error, #ef4444) 90%, transparent);
    outline-offset: 2px;
  }

  /* Accessibility - Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .disclosure-button i,
    .button {
      transition: none;
    }

    .button:hover,
    .button:active {
      transform: none;
    }
  }

  /* Accessibility - High Contrast */
  @media (prefers-contrast: high) {
    .disclosure-button:focus-visible,
    .button:focus-visible {
      outline: 3px solid white;
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    padding: 10px 14px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 12%, transparent);
    color: var(--semantic-error);
    font-size: var(--font-size-compact);
  }

  .error-message i {
    flex-shrink: 0;
  }
</style>
