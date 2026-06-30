<!--
  AccountSetupStep - Unified post-signup setup card. Collects whatever a new
  account still needs - a display name and/or a password - on ONE card, so a
  magic-link signup isn't walked through two sequential modals.

  Shows the name field when the account has no provider display name, and the
  password fields when a password is required (passwordless magic-link account).
  If neither is needed (e.g. a Google signup), it completes silently on mount,
  preserving the old FirstRunWizard auto-complete behavior.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { updatePassword } from "firebase/auth";
  import { auth } from "$lib/shared/auth/firebase";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { passwordOnboardingState } from "$lib/shared/onboarding/state/password-onboarding-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  interface Props {
    /** Password fields are required (passwordless account). */
    needsPassword: boolean;
    /** Admin "preview" — render the card even for accounts that don't need it. */
    forcePreview?: boolean;
    onComplete: () => void;
  }

  const { needsPassword, forcePreview = false, onComplete }: Props = $props();

  const authDisplayName = $derived(authState.user?.displayName?.trim() || "");
  const hasProviderName = $derived(!!authDisplayName);
  const showName = $derived(forcePreview || !hasProviderName);
  const showPassword = $derived(needsPassword);

  let name = $state("");
  let password = $state("");
  let confirm = $state("");
  let show = $state(false);
  let error = $state<string | null>(null);
  let submitting = $state(false);
  let needsRelogin = $state(false);

  const MIN = 8;
  const tooShort = $derived(password.length > 0 && password.length < MIN);
  const longEnough = $derived(password.length >= MIN);
  const mismatch = $derived(confirm.length > 0 && password !== confirm);
  const matched = $derived(longEnough && confirm.length > 0 && password === confirm);

  const nameValue = $derived(name.trim() || authDisplayName);
  const nameOk = $derived(!showName || nameValue.length > 0);
  const passwordOk = $derived(!showPassword || (longEnough && password === confirm));
  const isValid = $derived(nameOk && passwordOk);

  // Prefill the name with whatever the provider gave (usually empty for magic link).
  $effect(() => {
    if (authDisplayName && !name) name = authDisplayName;
  });

  onMount(() => {
    // Nothing to ask (e.g. Google signup, no password needed) → complete silently.
    if (!showName && !showPassword) onComplete();
  });

  const title = $derived(
    showName && showPassword
      ? "Finish setting up"
      : showPassword
        ? "Set a password"
        : "What should we call you?"
  );
  const subtitle = $derived(
    showName && showPassword
      ? "Pick a name and a password so you can always sign back in and manage your account."
      : showPassword
        ? "You signed up with a magic link. Add a password so you can always sign back in and manage your account."
        : "This is how you'll appear in the community."
  );
  const icon = $derived(
    showPassword && showName ? "fa-id-card" : showPassword ? "fa-lock" : "fa-user"
  );
  const submitLabel = $derived(
    showPassword && showName ? "Finish" : showPassword ? "Set password" : "Continue"
  );

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!isValid || submitting) return;
    submitting = true;
    error = null;

    // 1. Name (non-blocking — a save failure shouldn't trap a new user).
    if (showName) {
      try {
        await settingsService.updateSetting("userName", nameValue);
      } catch (err) {
        console.error("Failed to save name:", err);
        toast.warning("Couldn't save your name. You can set it later in Settings.");
      }
    }

    // 2. Password (blocking — must succeed to clear the required gate).
    if (showPassword) {
      const user = auth.currentUser;
      if (!user) {
        error = "You're signed out. Please sign in again.";
        needsRelogin = true;
        submitting = false;
        return;
      }
      try {
        await updatePassword(user, password);
        passwordOnboardingState.markHasPassword();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? "";
        if (code === "auth/requires-recent-login") {
          error =
            "For security, this needs a fresh sign-in. Sign out and use a new sign-in link, then set your password.";
          needsRelogin = true;
        } else if (code === "auth/weak-password") {
          error = "That password is too weak. Use at least 8 characters.";
        } else {
          error = "Couldn't set your password. Please try again.";
        }
        submitting = false;
        return;
      }
    }

    onComplete();
  }

  async function handleRelogin() {
    await authState.signOut();
  }
</script>

<div class="account-setup-step">
  <div class="icon-container">
    <i class="fas {icon}" aria-hidden="true"></i>
  </div>

  <h1 class="title">{title}</h1>
  <p class="subtitle">{subtitle}</p>

  <form class="setup-form" onsubmit={handleSubmit}>
    {#if showName}
      <input
        type="text"
        class="text-input"
        placeholder="Your name or nickname"
        bind:value={name}
        maxlength="50"
        autocomplete="name"
        spellcheck="false"
        disabled={submitting}
      />
    {/if}

    {#if showPassword}
      <div class="input-wrap">
        <input
          type={show ? "text" : "password"}
          class="text-input"
          class:invalid={tooShort}
          class:valid={longEnough && !tooShort}
          placeholder="New password"
          bind:value={password}
          autocomplete="new-password"
          disabled={submitting}
        />
        <button
          type="button"
          class="reveal-button"
          onclick={() => (show = !show)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          <i class="fas {show ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
        </button>
      </div>

      <input
        type={show ? "text" : "password"}
        class="text-input"
        class:invalid={mismatch}
        class:valid={matched}
        placeholder="Confirm password"
        bind:value={confirm}
        autocomplete="new-password"
        disabled={submitting}
      />

      <p
        class="status-line"
        class:error={tooShort || mismatch}
        class:ok={matched}
        aria-live="polite"
      >
        {#if tooShort}
          <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
          At least {MIN} characters.
        {:else if mismatch}
          <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
          Passwords don't match.
        {:else if matched}
          <i class="fas fa-circle-check" aria-hidden="true"></i>
          Passwords match
        {/if}
      </p>
    {/if}

    {#if error}
      <p class="form-error" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        {error}
      </p>
    {/if}

    {#if needsRelogin}
      <button type="button" class="action-button secondary" onclick={handleRelogin}>
        <i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
        Sign out & get a new link
      </button>
    {:else}
      <button type="submit" class="action-button" disabled={!isValid || submitting}>
        {submitting ? "Saving..." : submitLabel}
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
    {/if}
  </form>
</div>

<style>
  .account-setup-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    padding: 32px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.6));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .icon-container {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 15%, transparent);
    border-radius: 20px;
    font-size: 1.75rem;
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
    line-height: 1.5;
  }

  .setup-form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    width: 100%;
    margin-top: 8px;
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .text-input {
    width: 100%;
    /* Right gutter leaves room for the reveal button + browser/password-manager
       icon so neither hugs the text or edge. */
    padding: 15px 46px 15px 18px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    color: white;
    font-size: 1.1rem;
    font-weight: 500;
    text-align: left;
    transition: all var(--duration-normal) ease;
  }

  .text-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .text-input:focus {
    outline: none;
    border-color: var(--theme-accent, #a78bfa);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 8%, transparent);
  }

  .text-input.invalid {
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 55%, transparent);
  }

  .text-input.valid {
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 55%, transparent);
  }

  .reveal-button {
    position: absolute;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: color var(--duration-normal) ease;
  }

  .reveal-button:hover {
    color: var(--theme-text, white);
  }

  /* Reserved status row: fixed height so toggling error/match never shifts the
     button below it (no-layout-shift). */
  .status-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 1.05rem;
    margin: 0;
    font-size: 0.8rem;
    text-align: left;
    padding-left: 4px;
    color: transparent;
  }

  .status-line.error {
    color: var(--semantic-error, #f87171);
  }

  .status-line.ok {
    color: var(--semantic-success, #22c55e);
  }

  .form-error {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 10px 14px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 12%, transparent);
    color: var(--semantic-error, #f87171);
    font-size: 0.875rem;
    text-align: left;
  }

  .form-error i {
    flex-shrink: 0;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 24px;
    min-height: var(--min-touch-target);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 40%, transparent);
    border: 2px solid color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent);
  }

  .action-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 50%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 80%, transparent);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .action-button.secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-button.secondary:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  @media (max-width: 480px) {
    .account-setup-step {
      padding: 16px;
    }
    .icon-container {
      width: 64px;
      height: 64px;
      font-size: 1.5rem;
    }
    .title {
      font-size: 1.3rem;
    }
    .text-input {
      padding: 13px 44px 13px 16px;
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .text-input,
    .action-button,
    .reveal-button {
      transition: none;
    }
    .action-button:active:not(:disabled) {
      transform: none;
    }
  }
</style>
