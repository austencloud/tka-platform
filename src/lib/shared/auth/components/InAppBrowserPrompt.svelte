<script lang="ts">
  /**
   * In-app browser chrome: a dismissible bottom banner, and an escape sheet
   * that only opens when the visitor asks for it.
   *
   * This used to be a full-screen alertdialog on arrival that said the browser
   * "doesn't support sign-in." That was false — email-link sign-in works fine
   * in a webview, and guest tier needs no sign-in at all — and it sat on top of
   * a page a real Instagram visitor could have used. The gate belongs on the
   * Google/Facebook buttons, which is where the popup actually gets rejected.
   *
   * Design: docs/architecture/in-app-browser-path.md
   */
  import { page } from "$app/state";
  import { onMount, onDestroy } from "svelte";
  import { getInAppBrowserDetector } from "../get-in-app-browser-detector";
  import {
    setIabBannerVisible,
    setIabBannerHeight,
  } from "../state/iab-banner-state.svelte";
  import { captureEvent } from "$lib/shared/analytics/services/posthog";
  import { analyticsRoute } from "$lib/shared/analytics/analytics-context";

  const detector = getInAppBrowserDetector();

  let dismissed = $state(false);
  let sheetOpen = $state(false);
  let copied = $state(false);
  let copyFailed = $state(false);

  /**
   * Android-only. "waiting" is the 1500ms window after firing the intent;
   * "stayed" means the window closed with the page still visible, so nothing
   * handled the scheme and the copy fallback is all that's left.
   */
  let escapeState = $state<"idle" | "waiting" | "stayed">("idle");

  // Test hook. ?forceIAB=true runs the real platform detection; ?forceIAB=ios
  // and ?forceIAB=android force an escape path, because otherwise neither is
  // reachable from a desktop browser and this whole flow is untestable without
  // a phone in an Instagram DM.
  const forceValue = $derived(detector.getForcedValue(page.url.searchParams));
  const forceIAB = $derived(forceValue !== null);
  const forcedPlatform = $derived(
    forceValue === "ios" || forceValue === "android" ? forceValue : null
  );

  const detectedInApp = detector.isInAppBrowser();
  const isInAppBrowser = $derived(detectedInApp || forceIAB);
  const browserName = detector.getInAppBrowserName();
  const platform = $derived(forcedPlatform ?? detector.getPlatform());
  const canOpenExternal = $derived(platform === "android");
  // Whether the intent:// URL is real. A forced-android test on a desktop gets
  // the plain page URL back, and navigating to that would just reload the page
  // instead of demonstrating anything.
  const intentAvailable = detector.canOpenInExternalBrowser();
  const externalUrl = detector.getOpenInBrowserUrl();
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // Installed PWA has its own chrome and its own browser; forceIAB bypasses.
  const isInstalledPWA = $derived(
    typeof window !== "undefined" &&
      !forceIAB &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true)
  );

  const showingBanner = $derived(
    isInAppBrowser && !dismissed && !isInstalledPWA
  );

  const bannerTitle = $derived(
    browserName ? `${browserName}'s built-in browser` : "This app's built-in browser"
  );

  const escapeLabel = $derived(
    platform === "android"
      ? "Open in Chrome"
      : platform === "ios"
        ? "Open in Safari"
        : "Open in your browser"
  );

  // The shell reserves space for the banner rather than letting it sit on top
  // of whatever is at the bottom of the page. The height is measured because
  // the second copy line wraps to two or three lines on a phone.
  let bannerHeight = $state(0);

  $effect(() => {
    setIabBannerVisible(showingBanner);
  });

  $effect(() => {
    setIabBannerHeight(bannerHeight);
  });

  let bannerImpressionSent = false;
  $effect(() => {
    if (!showingBanner || bannerImpressionSent) return;
    bannerImpressionSent = true;
    captureEvent("inapp_browser_banner_shown", {
      browser: browserName,
      route: analyticsRoute(),
    });
  });

  onMount(() => {
    if (!isInAppBrowser) return;
    captureEvent("inapp_browser_detected", {
      browser: browserName,
      platform,
      route: analyticsRoute(),
      can_open_external: canOpenExternal,
    });
  });

  onDestroy(() => {
    setIabBannerVisible(false);
    clearEscapeWatch();
  });

  // --- Escape ---------------------------------------------------------------

  let escapeTimer: ReturnType<typeof setTimeout> | null = null;
  let watching = false;

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") resolveEscape("left");
  }

  function onPageHide() {
    resolveEscape("left");
  }

  function clearEscapeWatch() {
    if (escapeTimer !== null) {
      clearTimeout(escapeTimer);
      escapeTimer = null;
    }
    if (watching) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      watching = false;
    }
  }

  function resolveEscape(outcome: "left" | "stayed") {
    if (escapeState !== "waiting") return;
    clearEscapeWatch();
    escapeState = outcome === "left" ? "idle" : "stayed";
    captureEvent("inapp_browser_escape_result", {
      method: "android_intent",
      outcome,
      route: analyticsRoute(),
    });
  }

  function handleEscape() {
    sheetOpen = true;
    copyFailed = false;

    if (platform !== "android") {
      captureEvent("inapp_browser_escape_attempted", {
        // "other" is not a rounding error on iOS: WeChat, Telegram, Discord and
        // Slack all ship desktop clients with an embedded browser, and their UA
        // carries no mobile token. Tagging those ios_instructions would report
        // a share-sheet flow that never ran.
        method: platform === "ios" ? "ios_instructions" : "generic_instructions",
        route: analyticsRoute(),
      });
      return;
    }

    captureEvent("inapp_browser_escape_attempted", {
      method: "android_intent",
      route: analyticsRoute(),
    });

    // Nothing here can tell whether the webview honored the scheme, so watch
    // for the page going away. Instagram's Android app has been reported to
    // stop resolving intent:// at various points; if that's true today the
    // timer fires and the copy fallback appears within a second and a half
    // instead of leaving the visitor staring at a button that did nothing.
    escapeState = "waiting";
    clearEscapeWatch();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    watching = true;
    escapeTimer = setTimeout(() => resolveEscape("stayed"), 1500);

    if (intentAvailable) {
      window.location.href = externalUrl;
    }
  }

  function closeSheet() {
    sheetOpen = false;
    clearEscapeWatch();
    escapeState = "idle";
    copied = false;
    copyFailed = false;
  }

  // --- Copy -----------------------------------------------------------------

  // This renders inside in-app webviews, which is exactly where clipboard
  // writes are least reliable: writeText can reject outright, and the
  // execCommand fallback quietly copies nothing on iOS. Both paths report what
  // actually happened, because reporting "Copied!" over an empty clipboard is
  // worse than admitting failure — a visitor from an Instagram link mashed this
  // button six times in one second while it insisted the copy had worked.
  async function handleCopyUrl() {
    const viaApi = await copyViaClipboardApi();
    const viaSelection = viaApi ? false : copyViaSelection();
    const ok = viaApi || viaSelection;

    copied = ok;
    // Unlike the success flash, the failure state is sticky: it reveals the
    // manual field, and yanking that away on a timer while someone is trying to
    // long-press it would repeat the original sin in a new place. It clears on
    // the next attempt or when the sheet closes.
    copyFailed = !ok;

    captureEvent("inapp_browser_link_copied", {
      path: viaApi ? "clipboard_api" : viaSelection ? "selection" : "manual",
      success: ok,
      route: analyticsRoute(),
    });

    if (ok) setTimeout(() => (copied = false), 2000);
  }

  async function copyViaClipboardApi(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(currentUrl);
      return true;
    } catch {
      return false;
    }
  }

  function copyViaSelection(): boolean {
    const field = document.createElement("textarea");
    field.value = currentUrl;
    // readonly keeps the soft keyboard down; off-screen rather than hidden
    // because iOS refuses to select a display:none or visibility:hidden field.
    field.setAttribute("readonly", "");
    field.style.cssText =
      "position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(field);
    try {
      field.select();
      // select() alone is a no-op on iOS — the explicit range is what makes the
      // selection real. Without it execCommand happily copies an empty string
      // and still returns without throwing.
      field.setSelectionRange(0, currentUrl.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(field);
    }
  }

  function handleDismiss() {
    dismissed = true;
    captureEvent("inapp_browser_banner_dismissed", { route: analyticsRoute() });
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (sheetOpen && e.key === "Escape") closeSheet();
  }}
/>

{#if showingBanner}
  <div class="iab-banner" role="status" bind:clientHeight={bannerHeight}>
    <div class="banner-icon">
      <i class="fas fa-mobile-alt" aria-hidden="true"></i>
    </div>
    <div class="banner-body">
      <span class="banner-title">{bannerTitle}</span>
      <span class="banner-detail">
        Building and saving work here. Google and Facebook sign-in do not.
      </span>
    </div>
    <button class="banner-open" onclick={handleEscape}>
      {escapeLabel}
    </button>
    <button class="banner-dismiss" onclick={handleDismiss} aria-label="Dismiss">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>
{/if}

{#if sheetOpen}
  <div class="escape-layer" role="dialog" aria-modal="true" aria-labelledby="iab-sheet-title">
    <div class="escape-sheet">
      <button class="dismiss-button" onclick={closeSheet} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>

      <h2 id="iab-sheet-title">{escapeLabel}</h2>

      <div class="actions">
        {#if platform === "android"}
          {#if escapeState === "waiting"}
            <p class="sheet-status">Opening your browser…</p>
          {:else}
            {#if escapeState === "stayed"}
              <p class="sheet-status">
                That didn't hand off to a browser. Copy the link and paste it
                into Chrome.
              </p>
            {/if}
            <button class="primary-button" onclick={handleEscape}>
              <i class="fas fa-external-link-alt" aria-hidden="true"></i>
              {escapeLabel}
            </button>
          {/if}
        {:else if platform === "ios"}
          <div class="escape-instructions">
            <p class="instruction-step">
              <span class="step-number">1</span>
              Tap the menu icon
              <i class="fas fa-ellipsis-h" aria-hidden="true"></i>
            </p>
            <p class="instruction-step">
              <span class="step-number">2</span>
              Select "Open in Safari" or "Open in Browser"
            </p>
          </div>
        {:else}
          <!-- Desktop clients (WeChat, Telegram, Discord, Slack) land here.
               Their menus differ per app and none of them is a share sheet, so
               name the option to look for rather than describe a control that
               may not exist. Copy Link below is the reliable path. -->
          <div class="escape-instructions">
            <p class="instruction-step">
              <span class="step-number">1</span>
              Open this app's menu
            </p>
            <p class="instruction-step">
              <span class="step-number">2</span>
              Look for "Open in browser", or copy the link below
            </p>
          </div>
        {/if}

        {#if escapeState !== "waiting"}
          <button class="secondary-button" onclick={handleCopyUrl}>
            <i
              class="fas fa-{copied
                ? 'check'
                : copyFailed
                  ? 'hand-pointer'
                  : 'copy'}"
              aria-hidden="true"
            ></i>
            {copied ? "Copied!" : copyFailed ? "Copy it manually" : "Copy Link"}
          </button>
        {/if}

        {#if copyFailed}
          <!-- Every programmatic path is blocked in this webview, so hand the
               visitor something they can long-press. Pre-selected so the copy
               callout appears on the first tap. -->
          <input
            class="manual-copy"
            type="text"
            readonly
            value={currentUrl}
            aria-label="Page link — press and hold to copy"
            onfocus={(e) => e.currentTarget.select()}
          />
          <p class="manual-copy-hint">Press and hold the link above to copy it.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* ===========================
     BANNER — every route, dismissible, never blocks
     =========================== */

  .iab-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    /* Sticky tier, not modal: a dialog opening over the app must cover this,
       and the escape sheet it opens sits at --z-priority above everything. */
    z-index: var(--z-sticky);
    /* Two rows on a phone: the message spans the full width up top, the escape
       button gets its own row below. A single flex row instead squeezes the
       title into ellipsis ("This app's …") and wraps the detail into a sliver,
       because the escape button and dismiss claim the width first. */
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "icon body dismiss"
      "action action action";
    column-gap: 0.75rem;
    row-gap: 0.5rem;
    align-items: center;
    padding: 0.625rem 0.75rem;
    padding-bottom: calc(0.625rem + env(safe-area-inset-bottom, 0px));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    animation: banner-slide-up 300ms ease-out;
  }

  /* Once there is real horizontal room (tablet, desktop forceIAB), collapse
     back to a single row — the stacked layout only earns its keep on phones. */
  @media (min-width: 33rem) {
    .iab-banner {
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      grid-template-areas: "icon body action dismiss";
    }

    .banner-open {
      width: auto;
    }

    .banner-dismiss {
      align-self: center;
    }
  }

  @keyframes banner-slide-up {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .banner-icon {
    grid-area: icon;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #4285f4, #34a853);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: white;
    flex-shrink: 0;
  }

  .banner-body {
    grid-area: body;
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 2px;
  }

  .banner-title {
    /* No nowrap/ellipsis: with a full-width row the title has room to wrap if
       it must, which beats truncating a browser name to "…". */
    font-size: var(--font-size-min, 0.875rem);
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
    font-weight: 600;
    line-height: 1.25;
  }

  .banner-detail {
    font-size: 0.75rem;
    line-height: 1.35;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
  }

  .banner-open {
    grid-area: action;
    width: 100%;
    flex-shrink: 0;
    padding: 0.5rem 0.875rem;
    background: linear-gradient(135deg, #4285f4, #34a853);
    border: none;
    border-radius: 0.375rem;
    color: white;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    /* Touch-target floor stays in px — it must not scale with the type ramp. */
    min-height: 44px;
  }

  .banner-open:hover {
    opacity: 0.9;
  }

  .banner-open:active {
    transform: scale(0.97);
  }

  .banner-dismiss {
    grid-area: dismiss;
    flex-shrink: 0;
    /* Align to the top of the message block so the ✕ sits by the title, not
       floating against the vertical centre of a two-line body. */
    align-self: start;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    cursor: pointer;
    border-radius: 50%;
    font-size: 0.875rem;
    transition: background 0.15s;
  }

  .banner-dismiss:hover {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, rgba(255, 255, 255, 0.7));
  }

  /* ===========================
     ESCAPE SHEET — only ever opens on a tap
     =========================== */

  .escape-layer {
    position: fixed;
    inset: 0;
    z-index: var(--z-priority);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: var(--backdrop-opaque, rgba(0, 0, 0, 0.85));
    backdrop-filter: var(--backdrop-blur-medium, blur(4px));
  }

  .escape-sheet {
    position: relative;
    max-width: 22.5rem;
    width: 100%;
    padding: 2rem 1.5rem 1.5rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 1rem;
    text-align: center;
  }

  .dismiss-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    border-radius: 50%;
    transition: background 0.15s;
  }

  .dismiss-button:hover {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.1));
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .sheet-status {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .primary-button,
  .secondary-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.875rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    min-height: 44px;
    transition:
      transform 0.1s,
      opacity 0.15s;
  }

  .primary-button:active,
  .secondary-button:active {
    transform: scale(0.98);
  }

  .primary-button {
    background: linear-gradient(135deg, #4285f4, #34a853);
    color: white;
  }

  .primary-button:hover {
    opacity: 0.9;
  }

  .secondary-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .secondary-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  .manual-copy {
    width: 100%;
    padding: 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-accent, #6366f1);
    border-radius: 0.5rem;
    color: var(--theme-text, #fff);
    text-align: center;
    /* 16px floor stops iOS zooming the viewport when the field takes focus. */
    font-size: max(0.875rem, 16px);
  }

  .manual-copy-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .escape-instructions {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .instruction-step {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    padding: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--theme-text, #fff);
    text-align: left;
  }

  .instruction-step:first-child {
    padding-top: 0;
  }

  .instruction-step:last-child {
    padding-bottom: 0;
  }

  .instruction-step i {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    background: var(--theme-accent, #6366f1);
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .iab-banner {
      animation: none;
    }

    .banner-open:active,
    .primary-button:active,
    .secondary-button:active {
      transform: none;
    }
  }
</style>
