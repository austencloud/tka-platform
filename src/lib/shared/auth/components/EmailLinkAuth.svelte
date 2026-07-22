<script lang="ts">
  /**
   * Passwordless Email Link Authentication
   *
   * Sends a branded magic link via Cloud Function + Brevo. Completion (the
   * step that consumes the single-use oobCode) is NOT handled here anymore —
   * it lives entirely in EmailLinkConfirmModal.svelte (mounted globally in
   * AppShellLoader.svelte), which requires an explicit "Finish signing in"
   * click before calling the code-consuming Firebase API. This form used to
   * also auto-complete on mount as a fallback; that was a second unattended
   * consumption path with the same link-prescanner risk the confirm modal
   * exists to close, so it was removed rather than kept as a fallback.
   */

  import { httpsCallable } from "firebase/functions";
  import { page } from "$app/state";
  import { getFunctionsInstance } from "../firebase";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { recordAuthSubmission } from "$lib/shared/auth/services/auth-analytics-bridge";
  import { getInAppBrowserDetector } from "$lib/shared/auth/get-in-app-browser-detector";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { db } from "$lib/shared/persistence/database/tka-database";
  import { captureEvent } from "$lib/shared/analytics/services/posthog";

  let email = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let deliveryDetails = $state<{
    subject: string;
    senderEmail: string;
  } | null>(null);
  let emailInput: HTMLInputElement;

  const DEFAULT_SUBJECT = "Your Flow Arts Composer sign-in link";
  const DEFAULT_SENDER = "noreply@tkaflowarts.com";

  // Inside an in-app webview this form is not just one option among several —
  // it is the only sign-in method that completes there, because it needs no
  // popup, no redirect, and no sessionStorage. The hint changes to say where
  // the link will actually land, which is a different browser than this one.
  // ?forceIAB is the test hook the whole in-app-browser path is verified with.
  const detector = getInAppBrowserDetector();
  const inAppBrowser = $derived(
    detector.isInAppBrowserOrForced(page.url.searchParams)
  );

  // Android's escape hatch is Chrome, iOS's is Safari, and the desktop clients
  // in the pattern list (WeChat, Telegram, Discord, Slack) are neither — naming
  // a browser their OS does not have is worse than naming none.
  // Plain const, not $derived: getPlatform() reads navigator, which cannot
  // change for the life of the page.
  const escapeTarget = (() => {
    const platform = detector.getPlatform();
    if (platform === "android") return "Chrome";
    if (platform === "ios") return "Safari";
    return "your browser";
  })();

  const hint = $derived(
    inAppBrowser
      ? `We email you a link. Open it in ${escapeTarget} and you are signed in there.`
      : "No password needed - we'll email you a sign-in link."
  );

  // The link is usually opened in a different browser than the one that
  // requested it, and localStorage does not cross that boundary — so an
  // anonymous guest who built work here finishes sign-in as a brand-new
  // account with their drafts stranded on the webview's uid. Nobody knows yet
  // how often that actually costs someone work, so measure the exposure
  // before building a uid-carry mechanism for a gap that may be theoretical.
  async function hasPendingGuestDrafts(): Promise<boolean> {
    if (!authState.isAnonymous) return false;
    try {
      return (await db.sequences.count()) > 0;
    } catch {
      return false;
    }
  }

  async function sendEmailLink() {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    loading = true;
    error = null;
    success = null;
    deliveryDetails = null;

    captureEvent("magic_link_request_started", {
      request_id: requestId,
      auth_host: window.location.hostname,
      route: page.url.pathname,
      in_app_browser: inAppBrowser,
    });

    try {
      // Get Functions instance and call Cloud Function
      const functions = await getFunctionsInstance();
      const sendMagicLink = httpsCallable<
        { email: string; continueUrl: string; requestId: string },
        {
          success: boolean;
          message?: string;
          error?: string;
          requestId?: string;
          subject?: string;
          senderEmail?: string;
        }
      >(functions, "sendMagicLink");

      // Land the user inside the app after they click the magic link, not on
      // the marketing landing page at "/".
      const result = await sendMagicLink({
        email,
        continueUrl: window.location.origin + "/create",
        requestId,
      });

      if (result.data.success) {
        const acceptedRequestId = result.data.requestId || requestId;
        // Save the email locally so we can complete sign-in on the same device
        window.localStorage.setItem("emailForSignIn", email);
        success = `Email sent to ${email}.`;
        deliveryDetails = {
          subject: result.data.subject || DEFAULT_SUBJECT,
          senderEmail: result.data.senderEmail || DEFAULT_SENDER,
        };
        captureEvent("magic_link_provider_accepted", {
          request_id: acceptedRequestId,
          auth_host: window.location.hostname,
          route: page.url.pathname,
          duration_ms: Math.round(performance.now() - startedAt),
        });
        recordAuthSubmission("magic_link");
        if (inAppBrowser) {
          // Detached on purpose. This awaits an IndexedDB count, and in-app
          // webviews are exactly where IndexedDB stalls — awaiting it here
          // holds `loading` true (the finally runs after it), so the button
          // would sit spinning "Sending..." underneath a banner already saying
          // the mail was sent. Telemetry never gates UI state.
          void hasPendingGuestDrafts().then((pending) =>
            captureEvent("inapp_auth_magic_link_requested", {
              guest_drafts_pending: pending,
            })
          );
        }
      } else {
        throw new Error(result.data.error || "Failed to send magic link");
      }
    } catch (err: unknown) {
      const details = err as { code?: string; message?: string };

      // Handle Cloud Function errors
      const errorCode = details.code || "";
      const errorMessage = details.message || "";
      let failureCode = "unknown";

      if (
        errorCode.includes("invalid-argument") ||
        errorMessage.includes("Invalid email")
      ) {
        failureCode = "invalid_email";
        error = "Invalid email address.";
        toast.error("Invalid email address.");
      } else if (errorCode.includes("failed-precondition")) {
        failureCode = "service_not_configured";
        error =
          "Email service temporarily unavailable. Please try again later.";
        toast.error("Email service unavailable. Please try again.");
      } else if (errorCode.includes("unavailable")) {
        failureCode = "provider_unavailable";
        error = "Email service did not respond. Please try again.";
        toast.error("Email service did not respond. Please try again.");
      } else {
        failureCode = errorCode ? "request_failed" : "network_failed";
        error = "Failed to send email. Please try again.";
        toast.error("Failed to send magic link. Please try again.");
      }

      console.error("[email-link] Send failed", { code: failureCode });
      captureEvent("magic_link_request_failed", {
        request_id: requestId,
        auth_host: window.location.hostname,
        route: page.url.pathname,
        failure_code: failureCode,
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } finally {
      loading = false;
    }
  }

  function handleSubmit() {
    sendEmailLink();
  }

  function useDifferentEmail() {
    email = "";
    error = null;
    success = null;
    deliveryDetails = null;
    requestAnimationFrame(() => emailInput.focus());
  }
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
  class="email-link-form"
>
  <p class="magic-link-hint">{hint}</p>

  <div class="form-group">
    <label for="email-link">{t("form_email")}</label>
    <input
      id="email-link"
      type="email"
      bind:this={emailInput}
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
    <div class="success-message" role="status" aria-live="polite">
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
      <span class="success-copy">
        <strong>{success}</strong>
        <span>
          Look for “{deliveryDetails?.subject || DEFAULT_SUBJECT}” from
          {deliveryDetails?.senderEmail || DEFAULT_SENDER}. If it is not in your
          inbox, check Junk or Other.
        </span>
      </span>
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
      {success ? "Send another link" : t("auth_send_magic_link")}
    {/if}
  </button>

  {#if success}
    <button
      type="button"
      class="different-email-button"
      onclick={useDifferentEmail}
    >
      Use a different email
    </button>
  {/if}
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
    align-items: flex-start;
    gap: 0.625rem;
    color: var(--semantic-success, var(--semantic-success));
    font-size: 0.875rem;
    text-align: left;
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
    margin-top: 0.125rem;
  }

  .success-copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    line-height: 1.45;
  }

  .success-copy strong {
    color: var(--theme-text, white);
    font-weight: 600;
  }

  .different-email-button {
    min-height: var(--min-touch-target, 44px);
    padding: 0.625rem 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.5rem;
    background: transparent;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .different-email-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
  }
</style>
