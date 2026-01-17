<!--
  EffectSection.svelte - Reusable section for effect controls

  Collapsible section with enable toggle and configurable content.
  Uses theme variables for consistent styling.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Effect name to display */
    label: string;
    /** Whether the effect is enabled */
    enabled: boolean;
    /** Icon class (FontAwesome) */
    icon?: string;
    /** Whether section is expanded (shows controls) */
    expanded?: boolean;
    /** Callback when enabled state changes */
    onToggle: () => void;
    /** Callback when expanded state changes */
    onExpandChange?: (expanded: boolean) => void;
    /** Content slot for effect controls */
    children?: Snippet;
  }

  let {
    label,
    enabled,
    icon = "fas fa-circle",
    expanded = $bindable(false),
    onToggle,
    onExpandChange,
    children,
  }: Props = $props();

  function toggleExpand() {
    expanded = !expanded;
    onExpandChange?.(expanded);
  }

  // Auto-expand when enabled
  $effect(() => {
    if (enabled && !expanded) {
      expanded = true;
      onExpandChange?.(true);
    }
  });
</script>

<section class="effect-section" class:enabled class:expanded>
  <header class="section-header">
    <button
      class="expand-btn"
      onclick={toggleExpand}
      aria-expanded={expanded}
      aria-controls="effect-content-{label.toLowerCase().replace(/\s+/g, '-')}"
    >
      <span class="effect-indicator" class:enabled>
        <i class={icon} aria-hidden="true"></i>
      </span>
      <span class="effect-label">{label}</span>
      <i
        class="fas fa-chevron-down expand-icon"
        class:expanded
        aria-hidden="true"
      ></i>
    </button>

    <label class="toggle-switch">
      <input
        type="checkbox"
        checked={enabled}
        onchange={onToggle}
        aria-label="Enable {label}"
      />
      <span class="toggle-slider"></span>
    </label>
  </header>

  {#if expanded && children}
    <div
      class="section-content"
      id="effect-content-{label.toLowerCase().replace(/\s+/g, '-')}"
    >
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .effect-section {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .effect-section:last-child {
    border-bottom: none;
  }

  /* Header */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem 0;
  }

  .expand-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    font-size: 0.875rem;
    font-weight: 500;
    text-align: left;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .expand-btn:hover {
    color: var(--theme-text-strong, #ffffff);
  }

  /* Effect indicator (icon circle) */
  .effect-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    font-size: 0.625rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: all var(--duration-normal) ease;
  }

  .effect-indicator.enabled {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .effect-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .expand-icon {
    font-size: 0.625rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform var(--duration-normal) ease;
  }

  .expand-icon.expanded {
    transform: rotate(180deg);
  }

  /* Toggle Switch (compact version) */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 24px;
    flex-shrink: 0;
    cursor: pointer;
  }

  .toggle-switch input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    margin: 0;
    z-index: 2;
  }

  .toggle-slider {
    position: absolute;
    inset: 0;
    background: rgba(120, 120, 128, 0.32);
    border-radius: 999px;
    transition: all var(--duration-normal) ease;
  }

  .toggle-slider::before {
    content: "";
    position: absolute;
    height: 20px;
    width: 20px;
    left: 2px;
    top: 2px;
    background: white;
    border-radius: 50%;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch input:checked + .toggle-slider {
    background: var(--theme-accent, #007aff);
  }

  .toggle-switch input:checked + .toggle-slider::before {
    left: 18px;
  }

  /* Content */
  .section-content {
    padding: 0.5rem 0 0.75rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .expand-icon,
    .toggle-slider,
    .toggle-slider::before,
    .effect-indicator {
      transition: none;
    }
  }
</style>
