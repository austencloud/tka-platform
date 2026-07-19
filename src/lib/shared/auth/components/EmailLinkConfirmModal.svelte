<!--
  EmailLinkConfirmModal.svelte

  The confirm step for magic-link (email-link) sign-in. Mounted globally in
  AppShellLoader.svelte so it catches a pending link on any app route.

  Firebase's email-link oobCode is single-use. Completing it automatically on
  page load meant a corporate email link-prescanner (which fetches every link
  in an inbound message to check for malware) could consume the code before
  the human ever clicked, silently breaking sign-in. This modal requires an
  explicit "Finish signing in" click before the code-consuming API
  (completeEmailLinkSignIn) is called at all.

  Also replaces the old wrong-device fallback (`window.prompt`) with an
  in-page email field, shown when this device has no saved email for the
  pending link.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import {
    isEmailLinkPending,
    getSavedEmailForSignIn,
    completeEmailLinkSignIn,
  } from "../services/email-link-completion";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  let pending = $state(false);
  let savedEmail = $state<string | null>(null);
  let emailInput = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);

  onMount(() => {
    if (isEmailLinkPending()) {
      pending = true;
      savedEmail = getSavedEmailForSignIn();
    }
  });

  const needsEmail = $derived(pending && !savedEmail);
  const canSubmit = $derived(
    !loading && (savedEmail !== null || /^\S+@\S+\.\S+$/.test(emailInput.trim()))
  );

  async function handleConfirm() {
    if (!canSubmit) return;
    loading = true;
    error = null;
    try {
      const result = await completeEmailLinkSignIn(
        savedEmail ? undefined : emailInput.trim()
      );
      if (result.completed) {
        pending = false;
        toast.success("Signed in! Welcome.");
      } else if (result.errorCode === "auth/missing-email") {
        error = "Enter the email address you used to request the link.";
      } else if (
        result.errorCode === "auth/invalid-action-code" ||
        result.errorCode === "auth/expired-action-code"
      ) {
        error = "This link is invalid or has expired. Request a new one.";
        toast.error("That sign-in link is invalid or expired. Request a new one.");
      } else if (result.errorCode === "auth/invalid-email") {
        error = "That email doesn't match the sign-in link. Check it and try again.";
      } else {
        error = result.errorMessage || "Sign-in failed. Please try again.";
        toast.error("Sign-in failed. Please try again.");
      }
    } catch (err) {
      console.error("❌ [EmailLinkConfirmModal] Unexpected error:", err);
      error = "Something went wrong. Please try again.";
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    pending = false;
  }
</script>

<BaseModal
  open={pending}
  size="fit"
  position="center"
  animation="pop"
  class="email-link-confirm-modal"
  closeOnBackdrop
  closeOnEscape
  onclose={handleClose}
>
  <div class="email-link-confirm-content">
    <h2>Finish signing in</h2>

    {#if needsEmail}
      <p class="email-link-confirm-copy">
        This link was opened on a different device. Enter the email you used to request it.
      </p>
      <div class="email-link-confirm-field">
        <label for="email-link-confirm-input">Email</label>
        <input
          id="email-link-confirm-input"
          type="email"
          bind:value={emailInput}
          placeholder="you@example.com"
          disabled={loading}
          onkeydown={(e) => e.key === "Enter" && handleConfirm()}
        />
      </div>
    {:else}
      <p class="email-link-confirm-copy">
        Confirm the sign-in link sent to <strong>{savedEmail}</strong>.
      </p>
    {/if}

    {#if error}
      <p class="email-link-confirm-error" role="alert">{error}</p>
    {/if}

    <button
      type="button"
      class="email-link-confirm-button"
      onclick={handleConfirm}
      disabled={!canSubmit}
    >
      {loading ? "Signing in…" : "Finish signing in"}
    </button>
  </div>
</BaseModal>

<style>
  :global(dialog.email-link-confirm-modal) {
    width: min(380px, 92vw);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 16px);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  }

  .email-link-confirm-content {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1.5rem 1.375rem;
  }

  .email-link-confirm-content h2 {
    margin: 0;
    font-size: var(--font-size-lg, 20px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    text-align: center;
  }

  .email-link-confirm-copy {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    text-align: center;
    line-height: 1.5;
  }

  .email-link-confirm-copy strong {
    color: var(--theme-text, #fff);
  }

  .email-link-confirm-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .email-link-confirm-field label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .email-link-confirm-field input {
    padding: 0.625rem 0.75rem;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--radius-md, 8px);
    font-size: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
    min-height: var(--min-touch-target, 44px);
  }

  .email-link-confirm-field input:focus {
    outline: none;
    border-color: var(--theme-accent-strong, #7c6af7);
  }

  .email-link-confirm-error {
    margin: 0;
    padding: 0.625rem 0.75rem;
    font-size: var(--font-size-compact, 12px);
    color: #fca5a5;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    border-radius: var(--radius-sm, 6px);
    text-align: center;
  }

  .email-link-confirm-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 0.625rem 1rem;
    background: linear-gradient(135deg, var(--theme-accent, #6366f1) 0%, var(--theme-accent-strong, #4f46e5) 100%);
    color: #fff;
    border: 1px solid color-mix(in srgb, var(--theme-accent-strong, #4f46e5) 70%, transparent);
    border-radius: var(--radius-md, 10px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--duration-fast, 150ms) ease, transform var(--duration-fast, 150ms) ease;
  }

  .email-link-confirm-button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .email-link-confirm-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .email-link-confirm-button {
      transition: none;
    }
    .email-link-confirm-button:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
