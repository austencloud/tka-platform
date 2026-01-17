<!--
  TransformDescription.svelte

  Color-coded transform action card
  - Mobile: Horizontal scannable card with expand/collapse
  - Desktop: Vertical grid card with full info visible
-->
<script lang="ts">
  import type { TransformHelpItem } from "../../domain/transforms/transform-help-content";

  interface Props {
    item: TransformHelpItem;
    isDesktopLayout: boolean;
    expanded?: boolean;
    onToggle?: () => void;
    onApply?: () => void;
    onRotate?: (direction: "cw" | "ccw") => void;
  }

  let {
    item,
    isDesktopLayout,
    expanded = false,
    onToggle,
    onApply,
    onRotate,
  }: Props = $props();
</script>

<!-- Mobile: Horizontal layout, Desktop: Vertical grid card -->
<div
  class="transform-action"
  class:expanded
  class:is-rotate={item.id === "rotate"}
  class:desktop={isDesktopLayout}
  onclick={() => {
    if (item.id === "rotate") return;
    onApply?.();
  }}
  role="button"
  tabindex={item.id === "rotate" ? -1 : 0}
  onkeydown={(e) => {
    if (item.id !== "rotate" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onApply?.();
    }
  }}
  style="--color: {item.color}"
  aria-expanded={expanded}
  aria-controls="transform-description-{item.id}"
>
  <!-- Icon box (always visible) -->
  <div class="icon-box">
    <i class="fas {item.icon}" aria-hidden="true"></i>
  </div>

  <!-- Content area: name + short desc (mobile: flex 1, desktop: full width centered) -->
  <div class="content">
    <h4 class="name">{item.name}</h4>
    <p class="short-desc">{item.shortDesc}</p>
  </div>

  <!-- Mobile expand button, Desktop hidden -->
  <button
    class="expand-btn"
    onclick={(e) => {
      e.stopPropagation();
      onToggle?.();
    }}
    aria-label={expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
    type="button"
  >
    <i
      class="fas {expanded ? 'fa-chevron-up' : 'fa-chevron-down'}"
      aria-hidden="true"
    ></i>
  </button>
</div>

<!-- Mobile expanded: Full description + actions -->
{#if expanded}
  <div class="description-panel" id="transform-description-{item.id}">
    <p class="full-desc">{item.fullDesc}</p>

    {#if item.id === "rotate"}
      <div class="rotate-controls">
        <button
          class="rotate-btn"
          onclick={(e) => {
            e.stopPropagation();
            onRotate?.("ccw");
          }}
          title="Rotate counter-clockwise"
          aria-label="Rotate counter-clockwise"
          type="button"
        >
          <i class="fas fa-rotate-left" aria-hidden="true"></i>
        </button>
        <button
          class="rotate-btn"
          onclick={(e) => {
            e.stopPropagation();
            onRotate?.("cw");
          }}
          title="Rotate clockwise"
          aria-label="Rotate clockwise"
          type="button"
        >
          <i class="fas fa-rotate-right" aria-hidden="true"></i>
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ===== MOBILE: Horizontal Card Layout ===== */
  .transform-action {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
    width: 100%;
    color: inherit;
    height: var(--min-touch-target);
    flex-shrink: 0;
  }

  .transform-action:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong);
  }

  .transform-action:active {
    transform: scale(0.98);
  }

  /* Icon box: solid color background */
  .icon-box {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-base);
  }

  /* Text content area */
  .content {
    flex: 1;
    min-width: 0;
  }

  .name {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .short-desc {
    margin: 2px 0 0 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  /* Expand toggle button (mobile only) */
  .expand-btn {
    flex-shrink: 0;
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    border-radius: 6px;
    background: var(--theme-card-bg);
    border: none;
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-normal);
    font-size: var(--font-size-sm);
  }

  .expand-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.8);
  }

  /* Expanded content panel (mobile only) */
  .description-panel {
    padding: 12px 12px 0 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .full-desc {
    margin: 0;
    font-size: var(--font-size-compact);
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.5;
  }

  /* Rotate controls */
  .rotate-controls {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .rotate-btn {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-fast);
    white-space: nowrap;
  }

  .rotate-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .rotate-btn:active {
    transform: scale(0.97);
  }

  /* ===== DESKTOP: Vertical Grid Card Layout (2×2 grid) ===== */
  .transform-action.desktop {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 18px 14px;
    border-radius: 12px;
    min-height: auto;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color) 20%, transparent) 0%,
      color-mix(in srgb, var(--color) 8%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--color) 35%, transparent);
    text-align: center;
  }

  .transform-action.desktop:not(.is-rotate):hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color) 30%, transparent) 0%,
      color-mix(in srgb, var(--color) 15%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--color) 50%, transparent);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--color) 25%, transparent);
  }

  .transform-action.desktop .icon-box {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    font-size: var(--font-size-xl);
  }

  .transform-action.desktop .content {
    width: 100%;
  }

  .transform-action.desktop .name {
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .transform-action.desktop .short-desc {
    margin: 4px 0 0 0;
    font-size: var(--font-size-compact);
    color: rgba(255, 255, 255, 0.65);
  }

  .transform-action.desktop .expand-btn {
    display: none;
  }

  /* ===== ACCESSIBILITY ===== */
  @media (prefers-reduced-motion: reduce) {
    .transform-action,
    .expand-btn,
    .rotate-btn {
      transition: none;
    }
  }
</style>
