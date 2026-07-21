<!--
  AuthModal.svelte - Account creation / sign-in modal

  Replaces the old right-hand AuthDrawer. A centered, decorated modal that
  pitches the free account (benefit list) and runs the existing auth flow.

  - Built on the shared BaseModal primitive (native <dialog>, @starting-style
    pop entry/exit, focus + stack management). No hand-rolled overlay.
  - Opens for guests (unauthenticated OR anonymous). Anonymous guests are
    upgraded in place by the auth components, preserving their uid + drafts.
  - Pre-launch: no premium "Scribe" tier is presented. This is a free-account
    pitch only.
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import GoogleOneTap from "./GoogleOneTap.svelte";
  import SocialAuthCompact from "./SocialAuthCompact.svelte";
  import EmailAuthTabs from "./EmailAuthTabs.svelte";
  import { signInWithFacebook } from "$lib/shared/auth/services/authenticator";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { AUTH_NUDGE_TEXTS } from "$lib/shared/auth/domain/auth-nudge-trigger";
  import { getLastAuthMethod } from "$lib/shared/auth/services/last-auth-method.svelte";
  import LastUsedBadge from "./LastUsedBadge.svelte";

  function handleGoogleOneTapError(error: Error) {
    console.error("[AuthModal] Google One Tap sign-in failed", error);
    toast.error("Google sign-in failed. Please try again.");
  }

  interface Props {
    open: boolean;
    initialMode?: "signin" | "signup";
    onClose: () => void;
  }

  let { open, initialMode = "signup", onClose }: Props = $props();

  let authMode = $state<"signin" | "signup">("signup");
  let showEmailAuth = $state(false);

  // Why this modal opened (e.g. "export"), read from the shared drawer state
  // rather than piped down as a prop - MainApplication mounts this modal off
  // authDrawerState.open/initialMode without a reason prop, so this component
  // reads the same state directly instead of waiting on a prop threaded
  // through the host. Falls back to the generic pitch when nothing set it.
  const subtitle = $derived(
    authMode === "signup" && authDrawerState.reason
      ? AUTH_NUDGE_TEXTS[authDrawerState.reason]
      : "Free. Save your work."
  );

  // Facebook sign-in failure surfaced inline, mirroring AuthSheet/SocialAuthCompact.
  let facebookError = $state<string | null>(null);

  // If this device last signed in with an email method, the social buttons
  // aren't where the user needs to go — badge the email toggle instead, and let
  // EmailAuthTabs open on the right tab (magic link vs password).
  const lastMethod = $derived(getLastAuthMethod());
  const lastUsedEmail = $derived(lastMethod === "magic-link" || lastMethod === "password");

  // Sync internal mode whenever the modal opens with a specific initial mode.
  $effect(() => {
    if (open) {
      authMode = initialMode;
      showEmailAuth = false;
      facebookError = null;
    }
  });

  // What a free account unlocks over a throwaway guest session. Concrete and
  // true: anonymous sessions are ephemeral (auto-cleaned), single-device, and
  // capped at 8 beats. A free account is durable, syncs, lifts the cap to 64,
  // and is what lets you download your work (export is gated to full accounts).
  // No tier ladder, no premium pitch.
  const benefits = [
    { icon: "fa-download", label: "Export your animations & cards" },
    { icon: "fa-bookmark", label: "Save your work, safely" },
    { icon: "fa-cloud-arrow-up", label: "Sync across devices" },
    { icon: "fa-wand-magic-sparkles", label: "Longer sequences, up to 64 steps" },
  ];

  // SocialAuthCompact handles Google internally but delegates Facebook to the
  // parent via onFacebookAuth. Run the popup flow here and surface errors inline,
  // mirroring AuthSheet.handleFacebookAuth.
  async function handleFacebookAuth() {
    facebookError = null;
    try {
      await signInWithFacebook();
    } catch (error: unknown) {
      console.error("❌ [AuthModal] Facebook auth failed:", error);
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === "auth/popup-blocked") {
        facebookError = "Popup was blocked. Please allow popups for this site.";
      } else if (errorCode === "auth/popup-closed-by-user") {
        facebookError = "Sign-in cancelled. Please try again.";
      } else if (errorCode === "auth/cancelled-popup-request") {
        facebookError = null; // Silent - user just clicked away
      } else if (errorCode === "auth/account-exists-with-different-credential") {
        facebookError =
          "This email is already registered. Sign in with your original method (Google or email) and we'll connect Facebook automatically.";
      } else {
        facebookError =
          error instanceof Error ? error.message : "Facebook sign-in failed. Please try again.";
      }
    }
  }
</script>

<BaseModal
  {open}
  size="fit"
  position="center"
  animation="pop"
  class="auth-modal"
  closeOnBackdrop
  closeOnEscape
  onclose={onClose}
>
  <div class="auth-modal-content">
    <button class="close-btn" onclick={onClose} aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>

    <!-- Header -->
    <div class="auth-hero">
      <div class="auth-logo-badge">
        <img src="/branding/logo.jpg" alt="Flow Arts Composer" width="56" height="56" />
      </div>
      <div class="auth-heading">
        {#if authMode === "signup"}
          <h2>Create your account</h2>
          <p class="auth-subtitle">{subtitle}</p>
        {:else}
          <h2>Welcome back</h2>
          <p class="auth-subtitle">Sign in to continue.</p>
        {/if}
      </div>
    </div>

    <!-- Benefit list (signup only) -->
    {#if authMode === "signup"}
      <ul class="benefits" aria-label="What a free account unlocks">
        {#each benefits as benefit}
          <li class="benefit">
            <span class="benefit-icon">
              <i class="fas {benefit.icon}" aria-hidden="true"></i>
            </span>
            <span class="benefit-label">{benefit.label}</span>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- Google One Tap (renders its own prompt UI) -->
    <GoogleOneTap autoPrompt={open} onError={handleGoogleOneTapError} />

    <!-- Social auth buttons -->
    <SocialAuthCompact mode={authMode} onFacebookAuth={handleFacebookAuth} />

    {#if facebookError}
      <p class="fb-error" role="alert">{facebookError}</p>
    {/if}

    <!-- Email auth toggle -->
    {#if !showEmailAuth}
      <button
        class="email-toggle"
        onclick={() => (showEmailAuth = true)}
        aria-label={lastUsedEmail
          ? "Continue with email, last used on this device"
          : "Continue with email"}
      >
        {#if lastUsedEmail}
          <LastUsedBadge />
        {/if}
        <i class="fas fa-envelope" aria-hidden="true"></i>
        <span>Continue with email</span>
      </button>
    {:else}
      <div class="divider"><span>or use email</span></div>
      <div class="email-auth-wrapper">
        <EmailAuthTabs bind:mode={authMode} />
      </div>
    {/if}

    <!-- Mode toggle — a real button, not a hyperlink -->
    <button
      class="mode-toggle-btn"
      onclick={() => {
        authMode = authMode === "signup" ? "signin" : "signup";
        showEmailAuth = false;
      }}
    >
      {#if authMode === "signup"}
        Already have an account? <strong>Sign in</strong>
      {:else}
        New here? <strong>Create an account</strong>
      {/if}
    </button>
  </div>
</BaseModal>

<style>
  /* Modal sizing override for the auth modal specifically */
  :global(dialog.auth-modal) {
    width: min(420px, 92vw);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 16px);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  }

  .auth-modal-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.75rem 1.5rem 1.5rem;
    position: relative;
  }

  .fb-error {
    margin: -0.5rem 0 0;
    font-size: var(--font-size-compact);
    color: var(--semantic-error, #ef4444);
    text-align: center;
  }

  /* Close button */
  .close-btn {
    position: absolute;
    top: 0.875rem;
    right: 0.875rem;
    background: none;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: 1rem;
    padding: 0.375rem;
    border-radius: var(--radius-sm, 6px);
    line-height: 1;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .close-btn:hover {
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
  }

  /* Hero: icon + heading */
  .auth-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.875rem;
    text-align: center;
    margin-top: 0.25rem;
  }

  .auth-logo-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
    box-shadow: 0 0 40px color-mix(in srgb, var(--theme-accent) 28%, transparent);
    overflow: hidden;
  }

  .auth-logo-badge img {
    width: 56px;
    height: 56px;
    object-fit: contain;
  }

  .auth-heading {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .auth-heading h2 {
    font-size: var(--font-size-lg, 22px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
    line-height: 1.2;
  }

  .auth-subtitle {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    margin: 0;
  }

  /* Benefit list */
  .benefits {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    list-style: none;
    margin: 0;
    padding: 0.875rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-md, 12px);
  }

  .benefit {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
  }

  .benefit-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-accent) 16%, transparent);
    color: var(--theme-accent);
    font-size: 13px;
  }

  /* Email toggle button */
  .email-toggle {
    /* Anchor for the absolutely-positioned LastUsedBadge. The badge is out of
       flow, so this button's box is unchanged whether or not it renders. */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 10px);
    color: var(--theme-text, rgba(255, 255, 255, 0.75));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .email-toggle:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.09));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
  }

  /* Divider between social and email */
  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-compact, 12px);
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .email-auth-wrapper {
    display: flex;
    flex-direction: column;
  }

  /* Mode toggle — full-width secondary button */
  .mode-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.625rem 1rem;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-md, 10px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .mode-toggle-btn strong {
    color: var(--theme-accent, #7c6af7);
    font-weight: 600;
  }

  .mode-toggle-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
  }
</style>
