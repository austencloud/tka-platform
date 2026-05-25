<!-- Section Button Component -->
<!-- Individual section/tab button within a module -->
<script lang="ts">
  import type { Section } from "../../domain/types";
  import NotificationBadge from "../NotificationBadge.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getReactiveLocale } from "$lib/shared/i18n/locale-state.svelte";

  let {
    section,
    moduleId,
    isActive,
    onClick,
    onContextMenu,
    badgeCount = 0,
  } = $props<{
    section: Section;
    moduleId: string;
    isActive: boolean;
    onClick: () => void;
    onContextMenu?: (e: MouseEvent) => void;
    badgeCount?: number;
  }>();

  // Translated label (reactive to locale changes)
  const translatedLabel = $derived.by(() => {
    getReactiveLocale();
    return t(section.labelKey);
  });
</script>

<button
  class="section-button"
  class:active={isActive}
  class:disabled={section.disabled}
  onclick={onClick}
  oncontextmenu={onContextMenu}
  disabled={section.disabled}
  aria-label={translatedLabel}
  style="--section-color: {section.color ||
    'var(--muted-foreground)'}; --section-gradient: {section.gradient ||
    section.color ||
    'var(--muted-foreground)'};"
>
  <div class="icon-wrapper">
    <span class="section-icon">{@html section.icon}</span>
    {#if badgeCount > 0}
      <NotificationBadge count={badgeCount} />
    {/if}
  </div>
  <span class="section-label">{translatedLabel}</span>
</button>

<style>
  /* ============================================================================
     SECTION BUTTON - Refined Minimal Design
     ============================================================================ */
  .section-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--min-touch-target);
    padding: 10px 14px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    margin-bottom: 3px;
    overflow: hidden;
  }

  .section-button:hover:not(.disabled) {
    background: var(--theme-card-bg);
    color: var(--theme-text, var(--theme-text));
    transform: translateX(3px);
  }

  .section-button:active:not(.disabled) {
    transform: translateX(2px) scale(0.99);
    transition-duration: var(--duration-instant);
  }

  .section-button.active {
    color: var(--theme-text);
    background: color-mix(in srgb, var(--section-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--section-color) 25%, transparent);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--section-color) 15%, transparent);
  }

  .section-button.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Icon wrapper - for badge positioning */
  .icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .section-icon {
    font-size: var(--font-size-base);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    transition: all var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Style icons with gradient colors and glow */
  .section-icon :global(i) {
    background: var(--section-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
    transition: all var(--duration-emphasis) ease;
  }

  .section-button:not(.active) .section-icon :global(i) {
    opacity: 0.7;
  }

  .section-button:hover:not(.disabled) .section-icon {
    transform: scale(1.15);
  }

  .section-button:hover:not(.disabled) .section-icon :global(i) {
    opacity: 1;
    filter: drop-shadow(
      0 1px 4px color-mix(in srgb, var(--section-color) 30%, transparent)
    );
  }

  .section-button.active .section-icon :global(i) {
    opacity: 1;
    filter: drop-shadow(
        0 0 6px color-mix(in srgb, var(--section-color) 40%, transparent)
      )
      brightness(1.1);
  }

  .section-label {
    flex: 1;
    text-align: left;
    font-size: var(--font-size-compact);
    font-weight: 500;
    letter-spacing: -0.005em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);

    /* Delayed fade-in animation when sidebar expands (Google Calendar-style) */
    animation: label-fade-in var(--duration-normal) ease-out var(--duration-fast) both;
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

  .section-button.active .section-label {
    font-weight: 600;
  }

  /* Focus styles for keyboard navigation */
  .section-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-contrast: high) {
    .section-button.active {
      background: var(--theme-card-hover-bg);
      outline: 2px solid white;
    }
  }

  /* ============================================================================
     ANIMATIONS & TRANSITIONS
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .section-button,
    .section-button::before,
    .section-icon,
    .section-icon :global(i) {
      transition: none !important;
      animation: none !important;
    }
    .section-button:hover {
      transform: none;
    }
  }
</style>
