<script lang="ts">
  /**
   * CollapsibleSection
   * Expandable/collapsible section for grouping content.
   *
   * Two modes:
   * - Uncontrolled (default): manages its own open state, seeded by `defaultOpen`.
   * - Controlled: pass `open` (boolean) + `onToggle`; the parent owns the state.
   */

  interface Props {
    title: string;
    icon?: string;
    iconColor?: string;
    count?: number;
    defaultOpen?: boolean;
    /** Controlled open state. When provided, overrides internal state. */
    open?: boolean;
    /** Called with the requested next open value when the header is clicked (controlled mode). */
    onToggle?: (next: boolean) => void;
    children: import("svelte").Snippet;
  }

  let {
    title,
    icon,
    iconColor,
    count,
    defaultOpen = true,
    open = undefined,
    onToggle,
    children,
  }: Props = $props();

  let internalOpen = $state(true);
  $effect.pre(() => { internalOpen = defaultOpen; });

  const isControlled = $derived(open !== undefined);
  const isOpen = $derived(isControlled ? (open as boolean) : internalOpen);

  function handleClick() {
    const next = !isOpen;
    if (isControlled) {
      onToggle?.(next);
    } else {
      internalOpen = next;
    }
  }

  // Generate a stable ID from the title for aria-controls
  const sectionId = $derived(`section-${title.toLowerCase().replace(/\s+/g, "-")}`);
</script>

<div class="collapsible-section" class:open={isOpen}>
  <button
    type="button"
    class="section-header"
    onclick={handleClick}
    aria-expanded={isOpen}
    aria-controls={sectionId}
    aria-label="{isOpen ? 'Collapse' : 'Expand'} {title} section"
  >
    <div class="header-left">
      {#if icon}
        <span class="header-icon" style={iconColor ? `color: ${iconColor}` : ""}>
          <i class="fas {icon}" aria-hidden="true"></i>
        </span>
      {/if}
      <span class="header-title">{title}</span>
      {#if count !== undefined}
        <span class="header-count">{count}</span>
      {/if}
    </div>
    <i class="fas fa-chevron-down chevron" aria-hidden="true"></i>
  </button>

  {#if isOpen}
    <div id={sectionId} class="section-content" role="region" aria-label="{title} content">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .collapsible-section {
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 16px;
    min-height: var(--min-touch-target); /* Accessibility: touch target */
    border: none;
    background: transparent;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: background var(--duration-fast) ease;
  }

  .section-header:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.04));
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: currentColor;
    background: color-mix(in srgb, currentColor 15%, transparent);
    font-size: var(--font-size-sm, 14px);
  }

  .header-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
  }

  .header-count {
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
  }

  .chevron {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform var(--duration-normal) ease;
  }

  .collapsible-section.open .chevron {
    transform: rotate(180deg);
  }

  .section-content {
    padding: 4px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
