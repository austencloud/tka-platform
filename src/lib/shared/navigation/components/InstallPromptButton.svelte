<!--
  InstallPromptButton - PWA Installation UI Component

  Displays a button to install the app as a PWA or show installation guide.
  Handles both native install prompts and fallback to instruction guide.
-->
<script lang="ts">
  import type { IHapticFeedback } from "../../application/services/contracts/IHapticFeedback";
  import type { IMobileFullscreenManager } from "$lib/shared/mobile/services/contracts/IMobileFullscreenManager";
  import { container } from "../../di";
  import { onMount } from "svelte";

  let { canUseNativeInstall = false, onInstall } = $props<{
    canUseNativeInstall?: boolean;
    onInstall?: () => void;
  }>();

  let hapticService: IHapticFeedback;
  let fullscreenService: IMobileFullscreenManager;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    fullscreenService = container.items.mobileFullscreenManager;
  });

  async function handleInstallClick() {
    hapticService?.trigger("selection");

    try {
      await fullscreenService?.handleInstallRequest();
      onInstall?.();
    } catch (error) {
      console.error("Failed to handle install request:", error);
    }
  }
</script>

<button class="install-button" onclick={handleInstallClick}>
  <span class="item-icon install-icon">
    <i class="fas fa-plus-circle" aria-hidden="true"></i>
  </span>
  <div class="item-info">
    <span class="item-label">
      {canUseNativeInstall ? "Install App" : "Add to Home Screen"}
    </span>
    <span class="item-description">
      {canUseNativeInstall
        ? "Install for fullscreen experience"
        : "Learn how to install"}
    </span>
  </div>
</button>

<style>
  .install-button {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 12px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 15%, transparent) 0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent)) 15%,
          transparent
        )
        100%
    );
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
    min-height: var(--min-touch-target);
    width: 100%;
  }

  .install-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 25%, transparent) 0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent)) 25%,
          transparent
        )
        100%
    );
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    transform: translateX(4px);
  }

  .install-button:active {
    transform: translateX(4px) scale(0.98);
  }

  .item-icon {
    font-size: var(--font-size-2xl);
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .install-icon {
    color: var(--theme-accent-strong, var(--theme-accent));
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .item-label {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  .item-description {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.3;
  }

  .install-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .install-button {
      transition: none;
    }

    .install-button:hover,
    .install-button:active {
      transform: none;
    }
  }
</style>
