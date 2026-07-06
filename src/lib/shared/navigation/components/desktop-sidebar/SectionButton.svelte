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
    isCollapsed = false,
    onClick,
    onContextMenu,
    badgeCount = 0,
  } = $props<{
    section: Section;
    moduleId: string;
    isActive: boolean;
    isCollapsed?: boolean;
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
  class:collapsed={isCollapsed}
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
  /* Skeleton mirrors ModuleButton: a fixed 44px leading icon column pins the
     icon to a predictable x in BOTH rail and expanded states (the tree is now
     unified — see 2026-07-06-sidebar-tree-unification spec). The rail↔expanded
     inset is a single transitioning padding-left on the parent .sections-list,
     which slides this whole button right; nothing here animates geometry. */
  .section-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0;
    height: var(--min-touch-target);
    min-height: var(--min-touch-target);
    /* Zero left padding: the 44px icon-wrapper below is the leading column. */
    padding: 0 14px 0 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    /* Visuals + intended transform only, never layout geometry (same
       discipline as ModuleButton) so the morph never springs the icon. */
    transition:
      background-color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      border-color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      transform var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    margin-bottom: 3px;
    overflow: hidden;
  }

  /* Rail: no right padding so the 44px icon column fills the ~44px button and
     the icon reads centered under its module (x=32). */
  .section-button.collapsed {
    padding: 0;
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

  /* Icon wrapper - for badge positioning. Fixed 44px leading column (matches
     ModuleButton) so the tab icon center is deterministic across the morph. */
  .icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    flex-shrink: 0;
  }

  .section-icon {
    font-size: var(--font-size-base);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    /* transform only — the spring is for the hover scale pop; geometry snaps. */
    transition: transform var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
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
    white-space: nowrap;
    overflow: hidden;
    /* The label is always mounted (needed so it can MORPH, not mount/unmount).
       Rail collapses it to zero opacity; expand fades it back in. */
    opacity: 1;
    transition: opacity var(--duration-normal) ease;
  }

  /* Rail: the button is ~44px (icon column only), so the label has no room —
     zero its opacity so it fades rather than clip-wipes as the sidebar grows. */
  .section-button.collapsed .section-label {
    opacity: 0;
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
