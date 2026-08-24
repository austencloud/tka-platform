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
  import { trackAuthProviderResult } from "$lib/shared/analytics/auth-events";
  import { getInAppBrowserDetector } from "$lib/shared/auth/get-in-app-browser-detector";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { db } from "$lib/shared/persistence/database/tka-database";
  import { captureWhenReady } from "$lib/shared/analytics/services/posthog";

  let email = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let submittedEmail = $state("");
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
      ? `A sign-in link will arrive by email. Open it in ${escapeTarget} to finish signing in there.`
      : "No password needed. A sign-in link will arrive by email."
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

  // Warn a guest with unsaved work BEFORE they send a link they'll open in
  // another browser, where a fresh identity is created and the drafts strand.
  // Detached/non-blocking: IndexedDB stalls in webviews, so this resolves into
  // state rather than gating render.
  let pendingGuestDrafts = $state(false);
  $effect(() => {
    if (!inAppBrowser) {
      pendingGuestDrafts = false;
      return;
    }
    let cancelled = false;
    void hasPendingGuestDrafts().then((pending) => {
      if (!cancelled) pendingGuestDrafts = pending;
    });
    return () => {
      cancelled = true;
    };
  });

  async function sendEmailLink() {
    const recipient = email.trim();
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    submittedEmail = recipient;
    email = recipient;
    loading = true;
    error = null;
    success = null;
    deliveryDetails = null;

    recordAuthSubmission("magic_link");
    captureWhenReady("magic_link_request_started", {
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
        email: recipient,
        continueUrl: window.location.origin + "/create",
        requestId,
      });

      if (result.data.success) {
        const acceptedRequestId = result.data.requestId || requestId;
        // Save the email locally so we can complete sign-in on the same device
        window.localStorage.setItem("emailForSignIn", recipient);
        success = `Email sent to ${recipient}.`;
        deliveryDetails = {
          subject: result.data.subject || DEFAULT_SUBJECT,
          senderEmail: result.data.senderEmail || DEFAULT_SENDER,
        };
        captureWhenReady("magic_link_provider_accepted", {
          request_id: acceptedRequestId,
          auth_host: window.location.hostname,
          route: page.url.pathname,
          duration_ms: Math.round(performance.now() - startedAt),
        });
        trackAuthProviderResult("magic_link", "accepted");
        if (inAppBrowser) {
          // Detached on purpose. This awaits an IndexedDB count, and in-app
          // webviews are exactly where IndexedDB stalls — awaiting it here
          // holds `loading` true (the finally runs after it), so the button
          // would sit spinning "Sending..." underneath a banner already saying
          // the mail was sent. Telemetry never gates UI state.
          void hasPendingGuestDrafts().then((pending) =>
            captureWhenReady("inapp_auth_magic_link_requested", {
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
      trackAuthProviderResult("magic_link", "failed", failureCode);
      captureWhenReady("magic_link_request_failed", {
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
    void sendEmailLink();
  }

  function useDifferentEmail() {
    email = "";
    error = null;
    success = null;
    submittedEmail = "";
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
  {#if error}
    <div
      id="magic-link-status"
      class="delivery-card delivery-card--error"
      role="alert"
    >
      <span class="delivery-icon" aria-hidden="true">
        <i class="fas fa-triangle-exclamation"></i>
      </span>
      <span class="delivery-copy">
        <strong>The link was not sent</strong>
        <span>{error}</span>
      </span>
    </div>
  {:else}
    <div
      id="magic-link-status"
      class="delivery-card"
      class:delivery-card--sending={loading}
      class:delivery-card--success={!!success}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        class="delivery-icon"
        class:delivery-icon--sending={loading}
        aria-hidden="true"
      >
        {#if loading}
          <i class="fas fa-paper-plane"></i>
        {:else if success}
          <i class="fas fa-check"></i>
        {:else}
          <i class="fas fa-envelope"></i>
        {/if}
      </span>
      <span class="delivery-copy">
        {#if loading}
          <strong>Sending your link now</strong>
          <span>
            Preparing an email for {submittedEmail}. This can take a few
            seconds.
          </span>
        {:else if success}
          <strong>Check your email</strong>
          <span>
            {success} Look for “{deliveryDetails?.subject || DEFAULT_SUBJECT}”
            from {deliveryDetails?.senderEmail || DEFAULT_SENDER}. Check Junk or
            Other if it does not appear.
          </span>
        {:else}
          <strong>Email sign-in</strong>
          <span>{hint}</span>
        {/if}
      </span>
    </div>
  {/if}

  {#if pendingGuestDrafts}
    <p class="drift-warning" role="status">
      Your unsaved work stays on this browser. Finish signing in here, or it
      won't follow the link.
    </p>
  {/if}

  <div class="form-group">
    <label for="email-link">{t("form_email")}</label>
    <input
      id="email-link"
      type="email"
      bind:this={emailInput}
      bind:value={email}
      placeholder={t("form_placeholder_email")}
      required
      disabled={loading || !!success}
      aria-describedby="magic-link-status"
    />
  </div>

  <div class="form-actions" class:form-actions--split={!!success}>
    <button
      type="submit"
      disabled={loading}
      class="submit-button"
      aria-busy={loading}
      aria-describedby="magic-link-status"
    >
      {#if loading}
        <ProgressRing percent={-1} size={24} strokeWidth={2} />
        {t("auth_sending")}
      {:else}
        <i class="fas fa-envelope" aria-hidden="true"></i>
        {success ? "Send again" : t("auth_send_magic_link")}
      {/if}
    </button>
    {#if success}
      <button
        type="button"
        class="different-email-button"
        onclick={useDifferentEmail}
      >
        Different email
      </button>
    {/if}
  </div>
</form>

<style>
  .email-link-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .delivery-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    min-block-size: 7.5rem;
    padding: 0.875rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 0.75rem);
  }

  .delivery-card--sending {
    background: color-mix(
      in srgb,
      var(--theme-accent, #7c6af7) 12%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #7c6af7) 42%,
      transparent
    );
  }

  .delivery-card--success {
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 13%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 42%,
      transparent
    );
  }

  .delivery-card--error {
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 12%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 40%,
      transparent
    );
  }

  .delivery-icon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    color: var(--theme-accent, #7c6af7);
    background: color-mix(
      in srgb,
      var(--theme-accent, #7c6af7) 18%,
      transparent
    );
  }

  .delivery-card--success .delivery-icon {
    color: var(--semantic-success, #22c55e);
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 18%,
      transparent
    );
  }

  .delivery-card--error .delivery-icon {
    color: var(--semantic-error, #ef4444);
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 18%,
      transparent
    );
  }

  .delivery-icon--sending {
    animation: delivery-pulse 1.2s ease-in-out infinite;
  }

  .delivery-copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .delivery-copy strong {
    color: var(--theme-text, white);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .drift-warning {
    margin: 0;
    padding: 0.5rem 0.75rem;
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.4;
    text-align: center;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    background: var(--semantic-warning-bg, rgba(234, 179, 8, 0.12));
    border: 1px solid var(--semantic-warning, rgba(234, 179, 8, 0.4));
    border-radius: 0.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    color: color-mix(in srgb, var(--theme-text, white) 85%, transparent);
  }

  input {
    padding: 0.75rem;
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.5rem;
    font-size: var(--font-size-sm, 1rem);
    transition:
      border-color var(--duration-normal, 200ms) ease,
      box-shadow var(--duration-normal, 200ms) ease,
      background var(--duration-normal, 200ms) ease;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
  }

  input:focus {
    outline: 3px solid
      color-mix(in srgb, var(--theme-accent, #7c6af7) 38%, transparent);
    outline-offset: 1px;
    border-color: var(--theme-accent-strong, var(--theme-accent, #7c6af7));
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent, #7c6af7)) 15%,
        transparent
      );
  }

  input:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }

  .form-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.625rem;
  }

  .form-actions--split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .submit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong, var(--theme-accent, #7c6af7)) 0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent, #7c6af7)) 85%,
          #000
        )
        100%
    );
    color: var(--theme-text, white);
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: var(--font-size-min, 0.875rem);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: var(--min-touch-target);
    box-shadow: 0 4px 6px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent, #7c6af7)) 20%,
        transparent
      );
  }

  .submit-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent, #7c6af7)) 85%,
          #000
        )
        0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent, #7c6af7)) 70%,
          #000
        )
        100%
    );
    box-shadow: 0 6px 8px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent, #7c6af7)) 30%,
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

  .submit-button:focus-visible,
  .different-email-button:focus-visible {
    outline: 3px solid
      color-mix(in srgb, var(--theme-accent, #7c6af7) 72%, white);
    outline-offset: 3px;
  }

  @keyframes delivery-pulse {
    0%,
    100% {
      transform: translateX(0);
      opacity: 0.72;
    }
    50% {
      transform: translateX(0.2rem);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .delivery-icon--sending {
      animation: none;
    }

    input,
    .submit-button,
    .different-email-button {
      transition: none;
    }
  }
</style>
