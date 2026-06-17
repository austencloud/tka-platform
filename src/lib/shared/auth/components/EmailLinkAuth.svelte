<script lang="ts">
  /**
   * Passwordless Email Link Authentication
   *
   * Sends a branded magic link via Cloud Function + Resend,
   * then completes sign-in using Firebase Auth.
   */

  import {
    isSignInWithEmailLink,
    signInWithEmailLink,
    browserLocalPersistence,
    indexedDBLocalPersistence,
    setPersistence,
  } from "firebase/auth";
  import { httpsCallable } from "firebase/functions";
  import { auth, getFunctionsInstance } from "../firebase";
  import { onMount } from "svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  let email = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  // Check if we're completing a sign-in from an email link
  onMount(async () => {
    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        await completeSignIn();
      }
    } catch (err) {
      console.error(
        "❌ [email-link] Unexpected error during sign-in check:",
        err
      );
      error = "An unexpected error occurred. Please try again.";
      toast.error("Sign-in failed. Please try again.");
    }
  });

  async function sendEmailLink() {
    loading = true;
    error = null;
    success = null;

    try {
      // Get Functions instance and call Cloud Function
      const functions = await getFunctionsInstance();
      const sendMagicLink = httpsCallable<
        { email: string; continueUrl: string },
        { success: boolean; message?: string; error?: string }
      >(functions, "sendMagicLink");

      // Land the user inside the app after they click the magic link, not on
      // the marketing landing page at "/".
      const result = await sendMagicLink({
        email,
        continueUrl: window.location.origin + "/create",
      });

      if (result.data.success) {
        // Save the email locally so we can complete sign-in on the same device
        window.localStorage.setItem("emailForSignIn", email);
        success = `Magic link sent! Check your email at ${email}`;
      } else {
        throw new Error(result.data.error || "Failed to send magic link");
      }
    } catch (err: any) {
      console.error(`❌ [email-link] Error sending email:`, err);

      // Handle Cloud Function errors
      const errorCode = err.code || "";
      const errorMessage = err.message || "";

      if (errorCode.includes("invalid-argument") || errorMessage.includes("Invalid email")) {
        error = "Invalid email address.";
        toast.error("Invalid email address.");
      } else if (errorCode.includes("failed-precondition")) {
        error = "Email service temporarily unavailable. Please try again later.";
        toast.error("Email service unavailable. Please try again.");
      } else {
        error = "Failed to send email. Please try again.";
        toast.error("Failed to send magic link. Please try again.");
      }
    } finally {
      loading = false;
    }
  }

  async function completeSignIn() {
    try {
      // Set persistence before sign-in
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch (indexedDBErr) {
        await setPersistence(auth, browserLocalPersistence);
      }

      // Get the email from localStorage
      let savedEmail = window.localStorage.getItem("emailForSignIn");

      if (!savedEmail) {
        // User opened the link on a different device
        // Ask for email to prevent session fixation attacks
        savedEmail = window.prompt(
          "Please enter your email address to confirm:"
        );
      }

      if (!savedEmail) {
        error = "Email address is required to complete sign-in.";
        return;
      }

      // Sign in with the email link. If an anonymous session survived the
      // round-trip, LINK the email credential onto the anon user in place
      // (preserving its uid + data) instead of minting a fresh account.
      const link = window.location.href;
      if (auth.currentUser?.isAnonymous) {
        const { EmailAuthProvider, linkWithCredential } = await import(
          "firebase/auth"
        );
        const anonUid = auth.currentUser.uid;
        const credential = EmailAuthProvider.credentialWithLink(
          savedEmail,
          link
        );
        try {
          await linkWithCredential(auth.currentUser, credential);
        } catch (linkErr) {
          const code = (linkErr as { code?: string })?.code;
          if (
            code === "auth/credential-already-in-use" ||
            code === "auth/email-already-in-use"
          ) {
            // Email already belongs to a permanent account: sign into it and
            // offer to import the anon's drafts.
            const { upgradeMagicLinkCollision } = await import(
              "$lib/shared/auth/services/anonymous-upgrade"
            );
            const { promptAnonymousImport } = await import(
              "$lib/shared/auth/state/anonymous-import-prompt.svelte"
            );
            const drafts = await upgradeMagicLinkCollision(
              anonUid,
              savedEmail,
              link
            );
            promptAnonymousImport(drafts);
          } else {
            throw linkErr;
          }
        }
      } else {
        await signInWithEmailLink(auth, savedEmail, link);
      }

      // Clear the email from storage
      window.localStorage.removeItem("emailForSignIn");

      // The magic link's continueUrl already landed the user inside the app
      // (e.g. /create). No extra navigation needed - sending them to "/" would
      // bounce them back to the marketing landing page.
    } catch (err: any) {
      console.error(`❌ [email-link] Sign-in error:`, err);
      console.error(`❌ [email-link] Error code:`, err.code);

      if (err.code === "auth/invalid-email") {
        error = "Invalid email address.";
        toast.error("Invalid email address.");
      } else if (err.code === "auth/invalid-action-code") {
        error =
          "This link is invalid or has expired. Please request a new one.";
        toast.error("This link is invalid or expired. Request a new one.");
      } else if (err.code === "auth/expired-action-code") {
        error = "This link has expired. Please request a new one.";
        toast.error("This link has expired. Please request a new one.");
      } else {
        error = err.message || "Failed to sign in. Please try again.";
        toast.error("Sign-in failed. Please try again.");
      }
    }
  }

  function handleSubmit() {
    sendEmailLink();
  }
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
  class="email-link-form"
>
  <p class="magic-link-hint">No password needed - we'll email you a sign-in link.</p>

  <div class="form-group">
    <label for="email-link">{t("form_email")}</label>
    <input
      id="email-link"
      type="email"
      bind:value={email}
      placeholder={t("form_placeholder_email")}
      required
      disabled={loading}
    />
  </div>

  {#if error}
    <p class="error-message" role="alert">{error}</p>
  {/if}

  {#if success}
    <div class="success-message">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>{success}</span>
    </div>
  {/if}

  <button type="submit" disabled={loading} class="submit-button">
    {#if loading}
      <ProgressRing percent={-1} size={24} strokeWidth={2} />
      {t("auth_sending")}
    {:else}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        ></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
      {t("auth_send_magic_link")}
    {/if}
  </button>
</form>

<style>
  .email-link-form {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.5vh, 12px);
    width: 100%;
  }

  .magic-link-hint {
    margin: 0;
    font-size: clamp(0.75rem, 1.6vh, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
    line-height: 1.4;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.875rem;
    font-weight: 600;
    color: color-mix(in srgb, var(--theme-text, white) 85%, transparent);
  }

  input {
    padding: 0.75rem;
    border: 2px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: all var(--duration-normal) ease;
    background: var(--theme-card-bg, var(--theme-card-bg));
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
  }

  input:focus {
    outline: none;
    border-color: var(--theme-accent-strong, var(--theme-accent-strong));
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 15%,
        transparent
      );
  }

  input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .submit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong, var(--theme-accent-strong)) 0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 85%,
          #000
        )
        100%
    );
    color: var(--theme-text, white);
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: var(--min-touch-target);
    box-shadow: 0 4px 6px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 20%,
        transparent
      );
  }

  .submit-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 85%,
          #000
        )
        0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 70%,
          #000
        )
        100%
    );
    box-shadow: 0 6px 8px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 30%,
        transparent
      );
    transform: translateY(-1px);
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .submit-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .error-message {
    color: #fca5a5;
    font-size: 0.875rem;
    text-align: center;
    padding: 0.75rem;
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 15%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 30%,
        transparent
      );
    border-radius: 0.5rem;
    margin: 0;
  }

  .success-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--semantic-success, var(--semantic-success));
    font-size: 0.875rem;
    text-align: center;
    padding: 0.75rem;
    background: color-mix(
      in srgb,
      var(--semantic-success, var(--semantic-success)) 15%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 25%,
        transparent
      );
    border-radius: 0.5rem;
    margin: 0;
  }

  .success-message svg {
    flex-shrink: 0;
  }
</style>
