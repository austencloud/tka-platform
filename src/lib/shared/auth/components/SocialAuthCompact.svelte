<!--
  SocialAuthCompact.svelte - Compact Social Authentication Buttons

  Google, Facebook, and Instagram auth buttons for sign-in/sign-up flows.

  Auth Flow Priority:
  1. Google One Tap (FedCM-native, no redirects) - via GoogleOneTap.svelte
  2. Popup-based auth (fallback for all providers)
  3. Error message (no redirect fallback - it never worked)
-->
<script lang="ts">
  import FacebookIcon from "./icons/FacebookIcon.svelte";
  import GoogleIcon from "./icons/GoogleIcon.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import {
    browserLocalPersistence,
    indexedDBLocalPersistence,
    setPersistence,
  } from "firebase/auth";
  import { browser } from "$app/environment";
  import { getAuthInstance } from "../firebase";
  import {
    signInWithGoogle,
    signInWithInstagram,
  } from "$lib/shared/auth/services/authenticator";
  import { isNative } from "$lib/shared/platform/services/platform-detector";
  import { upgradeAnonymousWithGoogle } from "$lib/shared/auth/services/anonymous-upgrade";
  import { promptAnonymousImport } from "$lib/shared/auth/state/anonymous-import-prompt.svelte";
  import {
    FACEBOOK_LOGIN_ENABLED,
    INSTAGRAM_LOGIN_ENABLED,
  } from "$lib/shared/auth/services/auth-providers.config";
  import {
    mapAuthError,
    getAuthErrorCode,
  } from "$lib/shared/auth/services/auth-error-messages";
  import { getLastAuthMethod } from "$lib/shared/auth/services/last-auth-method.svelte";
  import LastUsedBadge from "./LastUsedBadge.svelte";
  import { recordAuthSubmission } from "$lib/shared/auth/services/auth-analytics-bridge";
  import { page } from "$app/state";
  import { getInAppBrowserDetector } from "$lib/shared/auth/get-in-app-browser-detector";
  import { captureEvent } from "$lib/shared/analytics/services/posthog";
  import { getInstagramAuthErrorMessage } from "$lib/shared/auth/services/instagram-auth";

  let { mode = "signin", onFacebookAuth } = $props<{
    mode: "signin" | "signup";
    onFacebookAuth?: () => void;
  }>();

  let googleError = $state<string | null>(null);
  let facebookError = $state<string | null>(null);
  let instagramError = $state<string | null>(null);
  let loadingProvider = $state<"google" | "instagram" | null>(null);
  const isLoading = $derived(loadingProvider !== null);

  // Facebook still runs signInWithPopup, which dead-ends in the native
  // WebView (Google/Meta block WebView sign-in). Hide it there until it's
  // wired through the native plugin. browser-guard: Capacitor is client-only.
  const showFacebook = FACEBOOK_LOGIN_ENABLED && !(browser && isNative());
  const showInstagram = INSTAGRAM_LOGIN_ENABLED && !(browser && isNative());

  // A third-party in-app webview (Instagram, Messenger, TikTok) is NOT the
  // native shell above: the detector returns false under Capacitor precisely so
  // this branch can't touch the native plugin path. Here social providers are
  // dead ends — Google answers embedded webviews with a server-side 403
  // disallowed_useragent, and Meta's policy is no looser. Detected here rather
  // than passed down as a prop because AuthSheet and AuthPrompt render this
  // component too, and the providers fail the same way from all three hosts.
  const detector = getInAppBrowserDetector();
  const inAppBrowser = $derived(
    detector.isInAppBrowserOrForced(page.url.searchParams)
  );

  // Android escapes to Chrome, iOS to Safari. Everything else gets no browser
  // name at all: the pattern list matches apps that also ship desktop clients
  // with an embedded browser (WeChat, Telegram, Discord, Slack, Line), whose UA
  // carries neither an Android nor an iPhone token. Telling a WeChat-on-Windows
  // visitor to open the page in Safari names a browser their OS does not have.
  // Plain const, not $derived: getPlatform() reads navigator, which cannot
  // change for the life of the page.
  const escapeTarget = (() => {
    const platform = detector.getPlatform();
    if (platform === "android") return "Chrome";
    if (platform === "ios") return "Safari";
    return "your browser";
  })();
  // Names the Magic Link tab rather than pointing a direction: AuthModal's
  // webview layout puts email above these buttons, but AuthSheet and
  // AuthPrompt both render this component first, so "above" would be wrong
  // from two of the three hosts.
  function blockedProviderMessage(provider: string): string {
    return `${provider} blocks sign-in inside this browser. Use the Magic Link option, or open this page in ${escapeTarget}.`;
  }

  // Which button this device signed in with last. Removes the "wait, was it
  // Google or email?" guess that otherwise ends in the wrong provider and an
  // "account exists with a different credential" dead end.
  const lastMethod = $derived(getLastAuthMethod());

  async function handleGoogleClick() {
    if (isLoading) return;

    // Stop before any Firebase call. Attempting the popup first doesn't
    // degrade gracefully — Google renders its own 403 disallowed_useragent
    // page inside this same webview, which is a worse dead end than one
    // sentence in our own UI that names the way out.
    if (inAppBrowser) {
      googleError = blockedProviderMessage("Google");
      captureEvent("inapp_auth_social_intercepted", { provider: "google" });
      return;
    }

    loadingProvider = "google";
    googleError = null;

    // Cancel any pending One Tap prompt to prevent race conditions
    window.google?.accounts?.id?.cancel();

    try {
      // Resolve the Auth instance lazily. The static `auth` export is bound
      // to the Firebase app created at module-eval time, but the HMR manager
      // rotates the app on each dev cycle - leaving the static reference
      // bound to a terminated app. Firebase rejects such references with
      // auth/argument-error deep inside signInWithPopup. getAuthInstance()
      // always returns an Auth wired to the current app.
      const auth = await getAuthInstance();

      // Set persistence for reliable auth state
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch {
        await setPersistence(auth, browserLocalPersistence);
      }

      // Don't navigate on success: the AuthDrawer/AuthSheet that wraps this
      // button unmounts via `{#if !isAuthenticated}` in MainApplication, so
      // the user stays on whatever app page they opened the sheet from.
      // Navigating to "/" used to send them back to the marketing landing.
      // signInWithGoogle() routes per platform (native SDK / desktop OAuth /
      // web popup) — never call signInWithPopup directly here.
      if (auth.currentUser?.isAnonymous) {
        const result = await upgradeAnonymousWithGoogle();
        if (result.status === "collision-signed-in") {
          promptAnonymousImport(result.importable ?? []);
        }
      } else {
        await signInWithGoogle();
      }
      recordAuthSubmission("google");
    } catch (error: unknown) {
      const errorCode = getAuthErrorCode(error);

      // Log the full error so we can see the stack in devtools. Firebase
      // swallows a lot of context inside FirebaseError; the stack is the
      // only reliable way to identify which call threw.
      console.error("[SocialAuthCompact] Google sign-in failed", {
        error,
        code: errorCode,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      googleError = mapAuthError(error);
    } finally {
      loadingProvider = null;
    }
  }

  function handleFacebookClick() {
    if (isLoading) return;
    // Meta's webview policy was never independently confirmed to be looser
    // than Google's, and the cost of being wrong is asymmetric: a defensive
    // sentence costs a tap, an unhandled dead end costs the visitor.
    if (inAppBrowser) {
      facebookError = blockedProviderMessage("Facebook");
      captureEvent("inapp_auth_social_intercepted", { provider: "facebook" });
      return;
    }
    onFacebookAuth?.();
  }

  async function handleInstagramClick() {
    if (isLoading) return;
    if (inAppBrowser) {
      instagramError = blockedProviderMessage("Instagram");
      captureEvent("inapp_auth_social_intercepted", { provider: "instagram" });
      return;
    }

    loadingProvider = "instagram";
    instagramError = null;
    try {
      await signInWithInstagram();
      recordAuthSubmission("instagram");
    } catch (error: unknown) {
      console.error("[SocialAuthCompact] Instagram sign-in failed", {
        code: (error as { code?: string })?.code,
        message: error instanceof Error ? error.message : String(error),
      });
      instagramError = getInstagramAuthErrorMessage(error);
    } finally {
      loadingProvider = null;
    }
  }
</script>

<div class="social-auth-compact">
  <p class="social-compact-label">
    {mode === "signin" ? "Sign in with" : "Sign up with"}
  </p>
  <div
    class="social-compact-buttons"
    class:one-provider={!showFacebook && !showInstagram}
    class:three-providers={showFacebook && showInstagram}
  >
    <button
      class="social-compact-button social-compact-button--google"
      onclick={handleGoogleClick}
      disabled={isLoading}
      aria-label={`${mode === "signin" ? "Sign in with Google" : "Sign up with Google"}${
        lastMethod === "google" ? ", last used on this device" : ""
      }`}
    >
      {#if lastMethod === "google"}
        <LastUsedBadge />
      {/if}
      {#if loadingProvider === "google"}
        <ProgressRing percent={-1} size={24} strokeWidth={2} />
        Signing in...
      {:else}
        <GoogleIcon />
        Google
      {/if}
    </button>
    {#if showFacebook}
      <button
        class="social-compact-button social-compact-button--facebook"
        onclick={handleFacebookClick}
        disabled={isLoading}
        aria-label={`${mode === "signin" ? "Sign in with Facebook" : "Sign up with Facebook"}${
          lastMethod === "facebook" ? ", last used on this device" : ""
        }`}
      >
        {#if lastMethod === "facebook"}
          <LastUsedBadge />
        {/if}
        <FacebookIcon />
        Facebook
      </button>
    {/if}
    {#if showInstagram}
      <button
        class="social-compact-button social-compact-button--instagram"
        onclick={handleInstagramClick}
        disabled={isLoading}
        aria-describedby="instagram-account-requirement"
        aria-label={`${mode === "signin" ? "Sign in with Instagram" : "Sign up with Instagram"}, creator or business account required${
          lastMethod === "instagram" ? ", last used on this device" : ""
        }`}
      >
        {#if lastMethod === "instagram"}
          <LastUsedBadge />
        {/if}
        {#if loadingProvider === "instagram"}
          <ProgressRing percent={-1} size={24} strokeWidth={2} />
          Opening...
        {:else}
          <i class="fab fa-instagram" aria-hidden="true"></i>
          Instagram
        {/if}
      </button>
    {/if}
  </div>
  {#if showInstagram}
    <p id="instagram-account-requirement" class="provider-note">
      Instagram requires a creator or business account.
    </p>
  {/if}
  {#if googleError}
    <p class="error-message" role="alert">{googleError}</p>
  {/if}
  {#if facebookError}
    <p class="error-message" role="alert">{facebookError}</p>
  {/if}
  {#if instagramError}
    <p class="error-message" role="alert">{instagramError}</p>
  {/if}
</div>

<style>
  .social-auth-compact {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(8px, 1.5vh, 12px);
    margin-top: clamp(2px, 0.5vh, 4px);
  }

  .social-compact-label {
    font-size: clamp(0.6875rem, 1.5vh, var(--font-size-compact));
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
    font-weight: 500;
  }

  .social-compact-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(6px, 1vw, 10px);
    width: 100%;
    max-width: 400px;
    /* Room for the "Last used" badge, which straddles a button's top edge by
       half its height. Reserved unconditionally so the row's geometry is
       identical whether or not a badge renders — the badge can never move
       these buttons. Sized to clear the badge at the 12px type floor. */
    padding-top: 0.75rem;
  }

  .social-compact-buttons.one-provider {
    grid-template-columns: minmax(0, 1fr);
  }

  .social-compact-buttons.three-providers {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .social-compact-button {
    /* Anchor for the absolutely-positioned LastUsedBadge. */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1vw, 8px);
    min-height: clamp(36px, 5vh, var(--min-touch-target));
    padding: clamp(8px, 1.2vh, 10px) clamp(10px, 2vw, 16px);
    border-radius: clamp(6px, 1vh, 8px);
    font-size: clamp(0.75rem, 1.8vh, var(--font-size-sm));
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    border: none;
    box-shadow: 0 2px 6px var(--theme-shadow);
  }

  .social-compact-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .social-compact-button :global(svg) {
    flex-shrink: 0;
  }

  .social-compact-button--google {
    background: #ffffff;
    color: #111827;
  }

  .social-compact-button--google:hover:not(:disabled) {
    background: #f3f4f6;
    transform: translateY(-1px);
  }

  .social-compact-button--facebook {
    background: #1877f2;
    color: #ffffff;
  }

  .social-compact-button--facebook:hover:not(:disabled) {
    background: #166fe5;
    transform: translateY(-1px);
  }

  .social-compact-button--instagram {
    background: #e4405f;
    color: #ffffff;
  }

  .social-compact-button--instagram:hover:not(:disabled) {
    background: #cf3654;
    transform: translateY(-1px);
  }

  .provider-note {
    margin: -4px 0 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    line-height: 1.35;
    text-align: center;
  }

  .error-message {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--semantic-error, var(--semantic-error));
  }
</style>
