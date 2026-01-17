<!--
  MobileFullscreenPrompt.svelte

  Encourages users to install the Progressive Web App when the fullscreen
  button would normally be shown (i.e. the app is not already installed).
  Provides a direct install button when the browser exposes the native prompt,
  and clear manual steps otherwise. Optionally supports a nag mode that will
  gently remind the user again after dismissal.
-->
<script lang="ts">
  import { container } from "../../di";
  import { onMount } from "svelte";
  import type { IMobileFullscreenManager } from "../services/contracts/IMobileFullscreenManager";

  let {
    showPrompt = $bindable(false),
    autoShow = true,
    position = "bottom",
    nagMode = false,
    onDismiss = () => {},
  }: {
    showPrompt?: boolean;
    autoShow?: boolean;
    position?: "top" | "bottom" | "center";
    nagMode?: boolean;
    onDismiss?: () => void;
  } = $props();

  let fullscreenService: IMobileFullscreenManager | null = null;

  let strategy = $state<
    "pwa" | "fullscreen-api" | "viewport-only" | "not-supported"
  >("not-supported");
  let isPWA = $state(false);
  let canInstallPWA = $state(false);
  let isInstalling = $state(false);

  const dismissLabel = $derived(() =>
    nagMode ? "Keep using browser for now" : "Maybe Later"
  );

  type BrowserEnvironment = {
    platform: "android" | "ios" | "desktop" | "unknown";
    browser: string;
    isChromeLike: boolean;
    isEdge: boolean;
    isFirefox: boolean;
    isSafari: boolean;
    isSamsung: boolean;
    isDesktop: boolean;
  };

  type InstallGuidance =
    | {
        support: "native";
        heading: string;
        steps: string[];
        note?: string;
      }
    | {
        support: "manual";
        heading: string;
        steps: string[];
        note?: string;
      }
    | {
        support: "unsupported";
        heading: string;
        message: string;
        recommendations: string[];
      };

  const environment = detectEnvironment();

  const installGuidance = $derived<InstallGuidance | null>(
    (() => {
      if (isPWA) {
        return null;
      }

      if (canInstallPWA) {
        const manual = getManualGuidance(environment);
        return {
          support: "native",
          heading: `Install with ${environment.browser}`,
          steps: manual?.support === "manual" ? manual.steps : [],
          note: manual?.support === "manual" ? manual.note : undefined,
        } as InstallGuidance;
      }

      if (strategy === "pwa") {
        const manual = getManualGuidance(environment);
        if (manual && manual.support === "manual") {
          return manual;
        }

        return {
          support: "unsupported",
          heading: manual?.heading ?? "Install not available",
          message:
            manual && manual.support === "unsupported"
              ? manual.message
              : "This browser doesn't offer Add to Home Screen for Progressive Web Apps.",
          recommendations:
            manual && manual.support === "unsupported"
              ? manual.recommendations
              : getDefaultRecommendations(environment),
        };
      }

      if (strategy === "not-supported") {
        return {
          support: "unsupported",
          heading: "Installation not supported in this browser",
          message:
            "Switch to a supported browser to install TKA as a fullscreen app.",
          recommendations: getDefaultRecommendations(environment),
        };
      }

      return null;
    })()
  );

  const shouldPromptUser = $derived(installGuidance !== null);

  function updateState() {
    if (!fullscreenService) return;
    strategy = fullscreenService.getRecommendedStrategy();
    isPWA = fullscreenService.isPWA();
    canInstallPWA = fullscreenService.canInstallPWA();
  }

  onMount(() => {
    try {
      fullscreenService = container.items.mobileFullscreenManager;
    } catch (error) {
      console.warn("Failed to resolve mobile fullscreen service:", error);
      fullscreenService = null;
      return;
    }

    updateState();

    if (autoShow && shouldPromptUser) {
      setTimeout(() => {
        if (shouldPromptUser) {
          showPrompt = true;
        }
      }, 2500);
    }

    const unsubscribeInstall = fullscreenService.onInstallPromptAvailable(
      (canInstall: boolean) => {
        canInstallPWA = canInstall;
        strategy = fullscreenService?.getRecommendedStrategy() ?? strategy;
        if (canInstall && shouldPromptUser) {
          showPrompt = true;
        }
      }
    );

    const handleAppInstalled = () => {
      updateState();
      showPrompt = false;
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      unsubscribeInstall?.();
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  });

  async function handleInstall() {
    if (!fullscreenService || !canInstallPWA) {
      return;
    }

    isInstalling = true;
    try {
      const accepted = await fullscreenService.promptInstallPWA();
      if (accepted) {
        updateState();
        showPrompt = false;
      }
    } finally {
      isInstalling = false;
    }
  }

  function handleDismiss() {
    showPrompt = false;
    onDismiss();
  }

  type ManualGuidance =
    | {
        support: "manual";
        heading: string;
        steps: string[];
        note?: string;
      }
    | {
        support: "unsupported";
        heading: string;
        message: string;
        recommendations: string[];
      };

  function detectEnvironment(): BrowserEnvironment {
    if (typeof navigator === "undefined") {
      return {
        platform: "unknown",
        browser: "your browser",
        isChromeLike: false,
        isEdge: false,
        isFirefox: false,
        isSafari: false,
        isSamsung: false,
        isDesktop: true,
      };
    }

    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSamsung = ua.includes("samsungbrowser");
    const isEdge = ua.includes("edg/");
    const isFirefox = ua.includes("firefox") || ua.includes("fxios");
    const isOpera = ua.includes("opr/") || ua.includes("opera");
    const isChromeLike =
      (ua.includes("chrome") ||
        ua.includes("crios") ||
        ua.includes("chromium")) &&
      !isEdge &&
      !isOpera &&
      !isSamsung;
    const isSafari =
      !isChromeLike && !isEdge && !isFirefox && ua.includes("safari");

    const browser = isSamsung
      ? "Samsung Internet"
      : isEdge
        ? "Microsoft Edge"
        : isFirefox
          ? "Firefox"
          : isChromeLike && isIOS
            ? "Chrome on iOS"
            : isChromeLike
              ? "Google Chrome"
              : isSafari && isIOS
                ? "Safari on iOS"
                : isSafari
                  ? "Safari"
                  : "your browser";

    const platform = isAndroid ? "android" : isIOS ? "ios" : "desktop";

    return {
      platform,
      browser,
      isChromeLike,
      isEdge,
      isFirefox,
      isSafari,
      isSamsung,
      isDesktop: !isAndroid && !isIOS,
    };
  }

  function getManualGuidance(env: BrowserEnvironment): ManualGuidance | null {
    if (env.platform === "android" && (env.isChromeLike || env.isEdge)) {
      return {
        support: "manual" as const,
        heading: "Add TKA to your home screen",
        steps: [
          "Tap the menu button (three dots) in the top-right corner",
          'Choose "Add to Home screen"',
          "Confirm by tapping Add",
        ],
        note: "TKA will appear as an icon on your home screen for one-tap launches.",
      };
    }

    if (env.platform === "android" && env.isSamsung) {
      return {
        support: "manual" as const,
        heading: "Add TKA in Samsung Internet",
        steps: [
          "Tap the menu button (three horizontal lines) in the bottom bar",
          'Choose "Add page to" then "Home screen"',
          "Confirm the shortcut",
        ],
      };
    }

    if (env.platform === "ios") {
      return {
        support: "manual" as const,
        heading: "Add TKA to your Home Screen",
        steps: [
          "Tap the share button (square with an up arrow)",
          'Scroll and tap "Add to Home Screen"',
          "Tap Add to confirm",
        ],
        note: "Safari creates an app-like icon that opens TKA fullscreen.",
      };
    }

    if (env.isDesktop && (env.isChromeLike || env.isEdge)) {
      return {
        support: "manual" as const,
        heading: "Install TKA on your computer",
        steps: [
          "Click the install icon in the address bar (monitor with a down arrow)",
          'Select "Install" when prompted',
          "Open TKA from your app list or desktop shortcut",
        ],
        note: "Installed apps run in their own window without browser chrome.",
      };
    }

    return {
      support: "unsupported" as const,
      heading: `Install not available in ${env.browser}`,
      message:
        "This browser does not support adding Progressive Web Apps to the home screen.",
      recommendations: getDefaultRecommendations(env),
    };
  }

  function getDefaultRecommendations(env: BrowserEnvironment): string[] {
    if (env.platform === "ios") {
      return [
        "Open this page in Safari on iOS 16 or later",
        "Or install from Chrome/Edge on a desktop computer",
      ];
    }

    if (env.platform === "android") {
      return [
        "Try Google Chrome on Android for one-tap install",
        "Samsung Internet also supports Add to Home Screen",
      ];
    }

    return [
      "Use Google Chrome or Microsoft Edge on desktop",
      "Install from Chrome on Android or Safari on iOS for mobile access",
    ];
  }
</script>

{#if showPrompt && shouldPromptUser}
  {@const guidance = installGuidance}
  {#if guidance}
    <div
      class="fullscreen-prompt-overlay position-{position}"
      class:nag-mode={nagMode}
    >
      <div class="fullscreen-prompt" class:nag-mode={nagMode}>
        <div class="prompt-content" class:nag-content={nagMode}>
          <div class="prompt-icon">??</div>
          <h3>{guidance.heading}</h3>

          {#if guidance.support === "native"}
            <p>
              Install for a distraction-free, fullscreen-like experience and
              keep the builder only a tap away.
            </p>
            <div class="prompt-actions">
              <button
                class="install-button"
                onclick={handleInstall}
                disabled={isInstalling}
              >
                {isInstalling ? "Installing..." : "Install App"}
              </button>
              <button
                class="dismiss-button"
                class:nag-dismiss={nagMode}
                onclick={handleDismiss}
              >
                {dismissLabel()}
              </button>
            </div>
            {#if guidance.steps.length > 0}
              <div class="manual-instructions">
                <p class="manual-title">
                  If the install button doesn't appear:
                </p>
                <ol>
                  {#each guidance.steps as step}
                    <li>{step}</li>
                  {/each}
                </ol>
                {#if guidance.note}
                  <p class="manual-note">{guidance.note}</p>
                {/if}
              </div>
            {/if}
          {:else if guidance.support === "manual"}
            <p>Follow these quick steps to add TKA to your device:</p>
            <div class="manual-instructions">
              <ol>
                {#each guidance.steps as step}
                  <li>{step}</li>
                {/each}
              </ol>
              {#if guidance.note}
                <p class="manual-note">{guidance.note}</p>
              {/if}
            </div>
            <div class="prompt-actions">
              <button
                class="dismiss-button"
                class:nag-dismiss={nagMode}
                onclick={handleDismiss}
              >
                {dismissLabel()}
              </button>
            </div>
          {:else}
            <p class="unsupported-message">{guidance.message}</p>
            <ul class="recommendations">
              {#each guidance.recommendations as recommendation}
                <li>{recommendation}</li>
              {/each}
            </ul>
            <div class="prompt-actions">
              <button class="dismiss-button" onclick={handleDismiss}>
                Got it
              </button>
            </div>
          {/if}

          {#if nagMode && guidance.support !== "unsupported"}
            <div class="nag-reminder">
              We'll remind you again later so you can install when it's
              convenient.
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .fullscreen-prompt-overlay {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    justify-content: center;
    padding: 16px;
    background: color-mix(in srgb, var(--theme-shadow) 50%, transparent);
    backdrop-filter: blur(4px);
    animation: fadeIn var(--duration-emphasis) ease-out;
  }

  .fullscreen-prompt-overlay.nag-mode {
    background: color-mix(in srgb, var(--theme-shadow) 90%, transparent);
  }

  .fullscreen-prompt-overlay.position-top {
    top: 0;
    align-items: flex-start;
  }

  .fullscreen-prompt-overlay.position-bottom {
    bottom: 0;
    align-items: flex-end;
  }

  .fullscreen-prompt-overlay.position-center {
    top: 0;
    bottom: 0;
    align-items: center;
  }

  .fullscreen-prompt {
    background: color-mix(in srgb, var(--theme-panel-bg) 94%, transparent);
    border-radius: 12px;
    box-shadow: 0 12px 40px var(--theme-shadow);
    max-width: 420px;
    width: 100%;
    animation: slideIn var(--duration-emphasis) ease-out;
  }

  .fullscreen-prompt.nag-mode {
    border: 2px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 60%,
        transparent
      );
  }

  .prompt-content {
    padding: 24px;
    text-align: center;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  .prompt-icon {
    font-size: var(--font-size-3xl);
    margin-bottom: 16px;
  }

  .prompt-content h3 {
    margin: 0 0 12px 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
  }

  .prompt-content p {
    margin: 0 0 20px 0;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .prompt-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .install-button {
    background: var(--theme-accent-strong, var(--theme-accent-strong));
    color: var(--theme-text, white);
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .install-button:hover {
    background: color-mix(in srgb, var(--theme-accent-strong) 85%, #000);
    transform: translateY(-1px);
  }

  .install-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .dismiss-button {
    background: transparent;
    color: var(--theme-text-dim, var(--theme-text-dim));
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    padding: 12px 24px;
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .dismiss-button:hover {
    background: var(--theme-card-bg);
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  .dismiss-button.nag-dismiss {
    border-color: var(--theme-stroke-strong);
    color: color-mix(in srgb, var(--theme-text, white) 92%, transparent);
  }

  .manual-instructions {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 12%,
      transparent
    );
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    text-align: left;
  }

  .manual-title {
    margin: 0 0 12px 0;
    font-weight: 600;
  }

  .manual-instructions ol {
    margin: 0 0 12px 0;
    padding-left: 20px;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .manual-instructions ol li {
    margin-bottom: 8px;
  }

  .manual-note {
    margin: 0;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-sm);
  }

  .unsupported-message {
    margin: 0 0 16px 0;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .recommendations {
    text-align: left;
    padding-left: 20px;
    margin: 0 0 20px 0;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .recommendations li {
    margin-bottom: 8px;
  }

  .nag-reminder {
    margin-top: 18px;
    padding: 12px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 14%,
      transparent
    );
    border-radius: 10px;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (max-width: 480px) {
    .fullscreen-prompt-overlay {
      padding: 12px;
    }

    .prompt-content {
      padding: 20px;
    }

    .prompt-icon {
      font-size: var(--font-size-3xl);
    }

    .prompt-content h3 {
      font-size: var(--font-size-lg);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .fullscreen-prompt-overlay {
      animation: none;
    }
    .fullscreen-prompt {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="slideIn"] {
      animation: none;
    }
  }
</style>
