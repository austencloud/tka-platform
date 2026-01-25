<script lang="ts">
  import {
    EmailAuthProvider,
    reauthenticateWithCredential,
  } from "firebase/auth";
  import { auth } from "../firebase";
  import {
    registerPasskey,
    stepUpWithPasskey,
  } from "../webauthn/passkeysClient";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    isOpen: boolean;
    allowPassword?: boolean;
    onSuccess: () => void;
    onCancel: () => void;
  }

  let {
    isOpen = $bindable(),
    allowPassword = false,
    onSuccess,
    onCancel,
  }: Props = $props();

  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let password = $state("");
  let showPassword = $state(false);
  let showPasskeySetup = $state(false);

  async function handlePasskeyVerify() {
    if (isSubmitting) return;
    isSubmitting = true;
    error = null;
    showPasskeySetup = false;
    try {
      await stepUpWithPasskey();
      isOpen = false;
      onSuccess();
    } catch (e: unknown) {
      // User cancelled the WebAuthn dialog - not an error, just exit silently
      if (e instanceof Error && e.name === "NotAllowedError") {
        return;
      }

      const code =
        typeof e === "object" && e && "code" in e
          ? String((e as { code: unknown }).code)
          : "";

      if (code === "no_passkeys") {
        showPasskeySetup = true;
        error = "No passkey is set up yet. Create one to continue.";
      } else {
        error = e instanceof Error ? e.message : "Verification failed";
      }
    } finally {
      isSubmitting = false;
    }
  }

  async function handleCreatePasskey() {
    if (isSubmitting) return;
    isSubmitting = true;
    error = null;
    try {
      await registerPasskey();
      showPasskeySetup = false;
      await stepUpWithPasskey();
      isOpen = false;
      onSuccess();
    } catch (e: unknown) {
      // User cancelled the WebAuthn dialog - not an error, just exit silently
      if (e instanceof Error && e.name === "NotAllowedError") {
        return;
      }
      error = e instanceof Error ? e.message : "Failed to create passkey";
    } finally {
      isSubmitting = false;
    }
  }

  async function handlePasswordVerify() {
    if (isSubmitting) return;
    const user = auth.currentUser;
    if (!user?.email) {
      error = "Password verification requires an email/password account";
      return;
    }
    if (!password) {
      error = "Enter your password to continue";
      return;
    }

    isSubmitting = true;
    error = null;
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await user.getIdToken(true);
      password = "";
      isOpen = false;
      onSuccess();
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e && "code" in e
          ? String((e as { code: unknown }).code)
          : "";

      if (code === "auth/multi-factor-auth-required") {
        error =
          "This account has authenticator 2FA enabled, which is no longer supported in the app. Remove it using the admin migration script.";
        return;
      }

      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        error = "Incorrect password. Try again, or use a passkey.";
      } else {
        error = e instanceof Error ? e.message : "Password verification failed";
      }
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    if (isSubmitting) return;
    password = "";
    showPasskeySetup = false;
    isOpen = false;
    onCancel();
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={handleCancel}
    onkeydown={(e) => e.key === "Escape" && handleCancel()}
    role="button"
    tabindex="0"
    aria-label="Close verification dialog"
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="passkey-modal-title"
      tabindex="-1"
    >
      <header class="modal-header">
        <div class="header-icon">
          <i class="fas fa-fingerprint" aria-hidden="true"></i>
        </div>
        <div class="header-text">
          <h2 id="passkey-modal-title">Verify it’s you</h2>
          <p>Use your device passkey to continue</p>
        </div>
      </header>

      <div class="modal-body">
        <p class="info">
          This is required for sensitive actions (password, email, account
          deletion).
        </p>

        {#if showPasskeySetup}
          <div class="setup">
            <p class="setup-text">
              Create a passkey on this device to verify quickly next time (Face
              ID / Touch ID / Windows Hello).
            </p>
            <button
              type="button"
              class="setup-button"
              onclick={handleCreatePasskey}
              disabled={isSubmitting}
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
              Create Passkey
            </button>
          </div>
        {/if}

        {#if allowPassword}
          <div class="password">
            <label class="label" for="verify-password"
              >{t("form_password")} ({t("form_optional")})</label
            >
            <div class="pw-wrap">
              <input
                id="verify-password"
                type={showPassword ? "text" : "password"}
                class="pw-input"
                bind:value={password}
                autocomplete="current-password"
                placeholder={t("form_placeholder_current_password")}
                disabled={isSubmitting}
              />
              <button
                type="button"
                class="pw-toggle"
                onclick={() => (showPassword = !showPassword)}
                disabled={isSubmitting}
                aria-label={showPassword ? t("auth_hide_password") : t("auth_show_password")}
              >
                <i
                  class="fas {showPassword ? 'fa-eye-slash' : 'fa-eye'}"
                  aria-hidden="true"
                ></i>
              </button>
            </div>
          </div>
        {/if}

        {#if error}
          <p class="error-message" role="alert">
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
            {error}
          </p>
        {/if}
      </div>

      <footer class="modal-footer">
        <button
          type="button"
          class="cancel-button"
          onclick={handleCancel}
          disabled={isSubmitting}
        >
          {t("action_cancel")}
        </button>

        {#if allowPassword}
          <button
            type="button"
            class="verify-button secondary"
            onclick={handlePasswordVerify}
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <span class="spinner"></span>
              {t("auth_verifying")}
            {:else}
              {t("auth_verify_with_password")}
            {/if}
          </button>
        {/if}

        <button
          type="button"
          class="verify-button"
          onclick={handlePasskeyVerify}
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <span class="spinner"></span>
            {t("auth_verifying")}
          {:else}
            {t("auth_verify_with_passkey")}
          {/if}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-panel-bg) 85%, transparent);
    z-index: 10000;
    animation: fadeIn var(--duration-normal) ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    width: 100%;
    max-width: 420px;
    margin: 16px;
    background: var(--theme-panel-bg);
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 30%,
        transparent
      );
    border-radius: 20px;
    box-shadow: 0 20px 60px var(--theme-shadow);
    animation: modalSlideIn var(--duration-emphasis) cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 24px 24px 16px;
  }

  .header-icon {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border-radius: 14px;
    color: var(--semantic-success);
    font-size: var(--font-size-2xl);
    flex-shrink: 0;
  }

  .header-text h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--theme-text);
  }

  .header-text p {
    margin: 4px 0 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-secondary, var(--theme-text-dim));
  }

  .modal-body {
    padding: 8px 24px 20px;
  }

  .password {
    margin-top: 14px;
  }

  .label {
    display: block;
    margin-bottom: 8px;
    color: var(--theme-text-secondary, var(--theme-text-dim));
    font-size: var(--font-size-compact);
    font-weight: 600;
  }

  .pw-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .pw-input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--theme-card-bg);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #fff;
    font-size: var(--font-size-sm);
  }

  .pw-toggle {
    position: absolute;
    right: 6px;
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
  }

  .setup {
    margin-top: 14px;
    padding: 12px 12px;
    border-radius: 12px;
    border: 1px solid rgba(34, 197, 94, 0.25);
    background: rgba(34, 197, 94, 0.08);
  }

  .setup-text {
    margin: 0 0 10px 0;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-compact);
    line-height: 1.4;
  }

  .setup-button {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(135deg, var(--semantic-success), #16a34a);
    color: #fff;
    font-weight: 700;
    cursor: pointer;
  }

  .info {
    margin: 0;
    color: var(--theme-text-secondary, var(--theme-text-dim));
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 16px 0 0;
    padding: 12px 16px;
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 15%,
      transparent
    );
    border: 1px solid var(--semantic-error, var(--semantic-error));
    border-radius: 10px;
    color: var(--semantic-error, var(--semantic-error));
    font-size: var(--font-size-sm);
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    padding: 0 24px 24px;
  }

  .cancel-button {
    flex: 1;
    padding: 12px 16px;
    border-radius: 10px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    color: var(--theme-text);
    cursor: pointer;
    font-weight: 500;
  }

  .verify-button {
    flex: 1.3;
    padding: 12px 16px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--semantic-success), #16a34a);
    border: none;
    color: #fff;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .verify-button.secondary {
    flex: 1;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop,
    .modal-content {
      animation: none;
    }

    .spinner {
      animation: none;
      border-top-color: #fff;
      border-right-color: #fff;
    }
  }
</style>
