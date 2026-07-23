<script lang="ts">
  /**
   * The escape machinery, target-driven and inline.
   *
   * Extracted from the old InAppBrowserPrompt full-screen sheet so it has one
   * home instead of two. Given an EscapeTarget (from the detector's resolver),
   * it renders the right button/guide/copy for this platform and launch state,
   * fires the scheme or intent, watches for the hand-off, and falls back to a
   * pointed guide plus a copy control that reports its real outcome.
   *
   * Design: docs/superpowers/specs/2026-07-22-kill-the-bar-app-forward-design.md
   */
  import { onDestroy } from "svelte";
  import type { EscapeTarget } from "../services/escape-target";
  import { captureEvent } from "$lib/shared/analytics/services/posthog";

  let { target, route }: { target: EscapeTarget; route: string } = $props();

  /**
   * "waiting" is the 1500ms window after firing; "stayed" means it closed with
   * the page still visible, so nothing handled the scheme and the guide + copy
   * are the way out.
   */
  let escapeState = $state<"idle" | "waiting" | "stayed">("idle");
  let copied = $state(false);
  let copyFailed = $state(false);

  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";

  // A guide-only target shows its guide immediately; a scheme/intent target
  // shows it only after the hand-off is confirmed to have failed.
  const showGuide = $derived(target.url === null || escapeState === "stayed");
  const showPrimary = $derived(target.url !== null && escapeState !== "waiting");
  const showCopy = $derived(escapeState !== "waiting");

  // --- Hand-off signal watch ------------------------------------------------
  //
  // This records a hand-off SIGNAL, not a success rate. Document visibility is
  // not the same as the browser opening: Home pressed mid-attempt looks like a
  // hand-off, and a slow hand-off looks like a stay. So we log the raw signal
  // plus elapsed time and let analysis infer success — and we keep listening
  // after the timeout in case the hand-off simply lands late.

  let escapeTimer: ReturnType<typeof setTimeout> | null = null;
  let watching = false;
  let attemptStartedAt = 0;

  function nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : 0;
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") recordSignal("hidden");
  }
  function onPageHide() {
    recordSignal("pagehide");
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

  function recordSignal(signal: "hidden" | "pagehide" | "timeout") {
    const elapsed = Math.round(nowMs() - attemptStartedAt);

    if (signal === "timeout") {
      if (escapeState !== "waiting") return;
      // Reveal the fallback but keep listening — a hand-off can still land late.
      escapeState = "stayed";
      captureEvent("inapp_browser_escape_signal", {
        method: target.method,
        signal: "timeout",
        phase: "timeout",
        elapsed_ms: elapsed,
        route,
      });
      return;
    }

    // A visibility/pagehide signal. If it lands after the timeout already
    // flipped us to "stayed", it still proves the escape eventually worked —
    // record it as a late hand-off. sendBeacon so a teardown during pagehide
    // (the success branch, most likely to be lost to normal batching) survives.
    const phase = escapeState === "waiting" ? "handoff" : "late";
    if (escapeState === "waiting") escapeState = "idle";
    clearEscapeWatch();
    captureEvent(
      "inapp_browser_escape_signal",
      { method: target.method, signal, phase, elapsed_ms: elapsed, route },
      { transport: "sendBeacon" }
    );
  }

  function handleEscape() {
    copyFailed = false;
    captureEvent("inapp_browser_escape_attempted", {
      method: target.method,
      route,
    });
    if (target.isAppTarget) {
      captureEvent("inapp_get_app_clicked", {
        method: target.method,
        route,
      });
    }

    if (target.url === null) return; // guide-only methods have nothing to fire

    attemptStartedAt = nowMs();
    escapeState = "waiting";
    clearEscapeWatch();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    watching = true;
    escapeTimer = setTimeout(() => recordSignal("timeout"), 1500);

    window.location.href = target.url;
  }

  onDestroy(clearEscapeWatch);

  // --- Copy (reports its real outcome; see the design's "button that lied") --

  async function handleCopyUrl() {
    const viaApi = await copyViaClipboardApi();
    const viaSelection = viaApi ? false : copyViaSelection();
    const ok = viaApi || viaSelection;

    copied = ok;
    copyFailed = !ok;

    captureEvent("inapp_browser_link_copied", {
      path: viaApi ? "clipboard_api" : viaSelection ? "selection" : "manual",
      success: ok,
      route,
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
    field.setAttribute("readonly", "");
    field.style.cssText =
      "position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(field);
    try {
      field.select();
      field.setSelectionRange(0, currentUrl.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(field);
    }
  }
</script>

<div class="escape-controls">
  {#if showPrimary}
    <button class="primary-button" onclick={handleEscape}>
      <i class="fas fa-external-link-alt" aria-hidden="true"></i>
      {target.label}
    </button>
  {/if}

  {#if escapeState === "waiting"}
    <p class="status">Opening…</p>
  {/if}

  {#if showGuide}
    {#if target.method === "android_intent"}
      <p class="status">
        That didn't hand off to a browser. Copy the link and paste it into
        Chrome.
      </p>
    {:else if target.method === "ios_scheme" || target.method === "ios_instructions"}
      <ol class="guide">
        <li>Tap the <strong>•••</strong> menu (top of this window)</li>
        <li>Choose <strong>Open in Safari</strong> or <strong>Open in Browser</strong></li>
      </ol>
    {:else}
      <ol class="guide">
        <li>Open this app's menu</li>
        <li>Choose <strong>Open in browser</strong>, or copy the link below</li>
      </ol>
    {/if}
  {/if}

  {#if showCopy}
    <button class="copy-button" onclick={handleCopyUrl}>
      <i
        class="fas fa-{copied ? 'check' : copyFailed ? 'hand-pointer' : 'copy'}"
        aria-hidden="true"
      ></i>
      {copied ? "Copied!" : copyFailed ? "Copy it manually" : "Copy Link"}
    </button>
  {/if}

  {#if copyFailed}
    <!-- Every programmatic path is blocked in this webview; hand over a field to
         long-press. Pre-selected so the copy callout shows on the first tap. -->
    <input
      class="manual-copy"
      type="text"
      readonly
      value={currentUrl}
      aria-label="Page link — press and hold to copy"
      onfocus={(e) => e.currentTarget.select()}
    />
  {/if}
</div>

<style>
  .escape-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .primary-button,
  .copy-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    transition:
      transform 0.1s,
      opacity 0.15s;
  }

  .primary-button:active,
  .copy-button:active {
    transform: scale(0.98);
  }

  .primary-button {
    border: none;
    background: linear-gradient(135deg, #4285f4, #34a853);
    color: white;
  }

  .primary-button:hover {
    opacity: 0.9;
  }

  .copy-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .copy-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  .status {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .guide {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    text-align: left;
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

  @media (prefers-reduced-motion: reduce) {
    .primary-button:active,
    .copy-button:active {
      transform: none;
    }
  }
</style>
