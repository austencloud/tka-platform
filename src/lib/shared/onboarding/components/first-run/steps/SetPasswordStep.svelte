<!--
  SetPasswordStep - Required password creation for passwordless (magic-link)
  accounts. Mirrors DisplayNameStep. Non-skippable: an email-only account must
  set a password so it has a real login + reauth credential.

  Uses updatePassword on the current user (recent-login is satisfied because the
  user just completed the magic link). On auth/requires-recent-login the session
  has aged past the token window — we surface a clear message and offer a fresh
  sign-in rather than trapping them.
-->
<script lang="ts">
  import { updatePassword } from "firebase/auth";
  import { auth } from "$lib/shared/auth/firebase";
  import { passwordOnboardingState } from "$lib/shared/onboarding/state/password-onboarding-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  interface Props {
    onComplete: () => void;
  }

  const { onComplete }: Props = $props();

  let password = $state("");
  let confirm = $state("");
  let show = $state(false);
  let error = $state<string | null>(null);
  let submitting = $state(false);
  let needsRelogin = $state(false);

  const MIN = 8;
  const tooShort = $derived(password.length > 0 && password.length < MIN);
  const mismatch = $derived(confirm.length > 0 && password !== confirm);
  const isValid = $derived(password.length >= MIN && password === confirm);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!isValid || submitting) return;

    const user = auth.currentUser;
    if (!user) {
      error = "You're signed out. Please sign in again.";
      needsRelogin = true;
      return;
    }

    submitting = true;
    error = null;
    try {
      await updatePassword(user, password);
      passwordOnboardingState.markHasPassword();
      onComplete();
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
    } finally {
      submitting = false;
    }
  }

  async function handleRelogin() {
    await authState.signOut();
  }
</script>

<div class="set-password-step">
  <div class="icon-container">
    <i class="fas fa-lock" aria-hidden="true"></i>
  </div>

  <h1 class="title">Set a password</h1>

  <p class="subtitle">
    You signed up with a magic link. Add a password so you can always sign back
    in and manage your account.
  </p>

  <form class="password-form" onsubmit={handleSubmit}>
    <div class="field">
      <div class="input-wrap">
        <input
          type={show ? "text" : "password"}
          class="password-input"
          class:invalid={tooShort}
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
      {#if tooShort}
        <p class="field-error">At least {MIN} characters.</p>
      {/if}
    </div>

    <div class="field">
      <input
        type={show ? "text" : "password"}
        class="password-input"
        class:invalid={mismatch}
        placeholder="Confirm password"
        bind:value={confirm}
        autocomplete="new-password"
        disabled={submitting}
      />
      {#if mismatch}
        <p class="field-error">Passwords don't match.</p>
      {/if}
    </div>

    {#if error}
      <p class="form-error" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        {error}
      </p>
    {/if}

    {#if needsRelogin}
      <button type="button" class="relogin-button" onclick={handleRelogin}>
        <i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
        Sign out & get a new link
      </button>
    {:else}
      <button type="submit" class="submit-button" disabled={!isValid || submitting}>
        {submitting ? "Saving..." : "Set password"}
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
    {/if}
  </form>
</div>

<style>
  .set-password-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
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
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
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

  .password-form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    width: 100%;
    margin-top: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-input {
    width: 100%;
    padding: 16px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    color: white;
    font-size: 1.1rem;
    font-weight: 500;
    text-align: center;
    transition: all var(--duration-normal) ease;
  }

  .password-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .password-input:focus {
    outline: none;
    border-color: var(--theme-accent, #a78bfa);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 8%, transparent);
  }

  .password-input.invalid {
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 55%, transparent);
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

  .field-error {
    margin: 0;
    font-size: 0.8rem;
    color: var(--semantic-error, #f87171);
    text-align: left;
    padding-left: 4px;
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

  .submit-button,
  .relogin-button {
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
  }

  .submit-button {
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 40%, transparent);
    border: 2px solid color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent);
  }

  .submit-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 50%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 80%, transparent);
  }

  .submit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .relogin-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .relogin-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  @media (max-width: 480px) {
    .set-password-step {
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
    .password-input {
      padding: 14px 16px;
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .password-input,
    .submit-button,
    .relogin-button,
    .reveal-button {
      transition: none;
    }
    .submit-button:active:not(:disabled) {
      transform: none;
    }
  }
</style>
