<!-- Sidebar Footer Component -->
<!-- Footer with settings gear/back button -->
<script lang="ts">
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { releaseNotesDrawerState } from "../../../settings/state/release-notes-drawer-state.svelte";

  let { isCollapsed, isSettingsActive, onSettingsClick } = $props<{
    isCollapsed: boolean;
    isSettingsActive: boolean;
    onSettingsClick?: () => void;
  }>();

  function handleVersionClick() {
    // Haptic feedback
    try {
      const hapticService = container.items.hapticFeedback as IHapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }

    // Open the release notes drawer
    releaseNotesDrawerState.open();
  }
</script>

<!-- Footer with settings -->
<div
  class="sidebar-footer"
  class:collapsed={isCollapsed}
  style="--button-accent-color: #64748b;"
>
  <!-- Settings Button -->
  <button
    class="settings-button"
    class:active={isSettingsActive}
    class:collapsed={isCollapsed}
    onclick={onSettingsClick}
    aria-label={isSettingsActive ? "Exit Settings" : "Settings"}
  >
    <div class="button-icon">
      <i
        class="fas {isSettingsActive ? 'fa-arrow-left' : 'fa-cog'}"
        aria-hidden="true"
      ></i>
    </div>
    {#if !isCollapsed}
      <span class="button-label">{isSettingsActive ? "Back" : "Settings"}</span>
    {/if}
  </button>

  <!-- Version Number (below settings) -->
  <button
    class="version-badge"
    class:collapsed={isCollapsed}
    onclick={handleVersionClick}
    aria-label="View Release Notes"
  >
    {#if isCollapsed}
      <span class="version-number">v{__APP_VERSION__}</span>
    {:else}
      <span class="version-label">Version {__APP_VERSION__}</span>
    {/if}
  </button>
</div>

<style>
  /* ============================================================================
     SIDEBAR FOOTER - Inbox + Settings entry points
     ============================================================================ */
  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 12px;
    border-top: 1px solid var(--theme-stroke);
  }

  .sidebar-footer.collapsed {
    padding: 12px 8px;
    align-items: center;
    gap: 12px;
  }

  /* ============================================================================
     SETTINGS BUTTON
     ============================================================================ */
  .settings-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .settings-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .settings-button.active {
    background: color-mix(in srgb, var(--button-accent-color) 15%, transparent);
    border-color: color-mix(
      in srgb,
      var(--button-accent-color) 25%,
      transparent
    );
    color: white;
  }

  .settings-button.collapsed {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    justify-content: center;
    border-radius: 12px;
  }

  .button-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-base);
    border-radius: 8px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    transition: all 0.2s ease;
  }

  .settings-button.collapsed .button-icon {
    width: 100%;
    height: 100%;
    background: transparent;
    border-radius: 12px;
  }

  .settings-button:hover .button-icon {
    background: var(--theme-card-hover-bg);
  }

  .settings-button.active .button-icon {
    background: color-mix(in srgb, var(--button-accent-color) 20%, transparent);
  }

  .settings-button:not(.active):hover .button-icon i {
    transform: rotate(90deg);
    transition: transform 0.3s ease;
  }

  .button-label {
    flex: 1;
    text-align: left;
    font-weight: 500;

    /* Delayed fade-in animation when sidebar expands (Google Calendar-style) */
    animation: label-fade-in 0.25s ease-out 0.15s both;
  }

  @keyframes label-fade-in {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  .settings-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar-footer,
    .settings-button,
    .button-icon {
      transition: none !important;
    }
  }

  /* ============================================================================
     VERSION BADGE
     ============================================================================ */
  .version-badge {
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 4px 8px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim);
    letter-spacing: 0.3px;
    opacity: 0.7;
    transition: all 0.2s ease;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 6px;
    width: 100%;
  }

  .version-badge:hover {
    opacity: 1;
    color: var(--theme-accent);
    background: var(--theme-card-bg);
  }

  .version-badge:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .version-badge.collapsed {
    padding: 4px 0;
    font-size: var(--font-size-compact);
  }

  .version-number,
  .version-label {
    white-space: nowrap;
  }

  .version-label {
    /* Delayed fade-in animation when sidebar expands (Google Calendar-style) */
    animation: label-fade-in 0.25s ease-out 0.15s both;
  }
</style>
