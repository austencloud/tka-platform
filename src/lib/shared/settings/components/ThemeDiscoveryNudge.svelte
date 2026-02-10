<!--
  ThemeDiscoveryNudge - Inline toast encouraging background exploration

  Appears after engagement thresholds for users who've never visited
  the Background tab. Dismissible, shows once, never returns.
-->
<script lang="ts">
  import { themeDiscoveryState } from "../state/theme-discovery-state.svelte";
  import { navigationState } from "../../navigation/state/navigation-state.svelte";
  import type { ModuleId } from "../../navigation/domain/types";

  function handleShowMe() {
    navigationState.setCurrentModule("settings" as ModuleId, "theme");
    themeDiscoveryState.dismiss();
  }

  function handleDismiss() {
    themeDiscoveryState.dismiss();
  }
</script>

{#if themeDiscoveryState.isVisible}
  <div class="nudge-container" role="status" aria-live="polite">
    <div class="nudge-card">
      <span class="nudge-icon">
        <i class="fas fa-palette" aria-hidden="true"></i>
      </span>
      <p class="nudge-text">There are other backgrounds to try.</p>
      <button class="nudge-action" onclick={handleShowMe}>
        Show me
      </button>
      <button
        class="nudge-close"
        onclick={handleDismiss}
        aria-label="Dismiss"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  </div>
{/if}

<style>
  .nudge-container {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 900;
    animation: nudgeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
  }

  .nudge-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    max-width: 420px;
    white-space: nowrap;
  }

  .nudge-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-radius: 8px;
    color: var(--theme-accent-strong, #8b5cf6);
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .nudge-text {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.3;
  }

  .nudge-action {
    flex-shrink: 0;
    padding: 6px 14px;
    min-height: 32px;
    background: var(--theme-accent-strong, #8b5cf6);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .nudge-action:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 85%,
      white
    );
  }

  .nudge-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nudge-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text, white);
  }

  @keyframes nudgeSlideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  /* Mobile: position above bottom nav */
  @media (max-width: 768px) {
    .nudge-container {
      bottom: 72px;
      left: 8px;
      right: 8px;
      transform: none;
      animation: nudgeSlideUpMobile 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .nudge-card {
      max-width: none;
      white-space: normal;
    }
  }

  @keyframes nudgeSlideUpMobile {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .nudge-container {
      animation: none;
    }

    .nudge-action,
    .nudge-close {
      transition: none;
    }
  }
</style>
