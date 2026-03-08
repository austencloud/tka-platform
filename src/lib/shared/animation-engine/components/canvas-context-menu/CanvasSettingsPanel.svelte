<!--
  CanvasSettingsPanel - Floating panel shell that anchors near a canvas element.
  Positions itself intelligently (right/left/overlay) based on available space.
  Content is provided via Svelte 5 snippet.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";

  interface CanvasSettingsPanelProps {
    title: string;
    icon: string;
    iconColor?: string;
    anchorElement: HTMLElement;
    onClose: () => void;
    children: Snippet;
  }

  let {
    title,
    icon,
    iconColor,
    anchorElement,
    onClose,
    children,
  }: CanvasSettingsPanelProps = $props();

  let panelElement: HTMLDivElement | null = $state(null);
  let positionX: number = $state(0);
  let positionY: number = $state(0);
  let positioned: boolean = $state(false);

  const PANEL_WIDTH = 300;
  const GAP = 12;
  const VIEWPORT_MARGIN = 8;

  function computePosition() {
    if (!panelElement || !anchorElement) return;

    const canvasRect = anchorElement.getBoundingClientRect();
    const panelRect = panelElement.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x: number;
    let y: number;

    // Horizontal: prefer right, then left, then overlay right-aligned inside canvas
    const spaceRight = vw - canvasRect.right - VIEWPORT_MARGIN;
    const spaceLeft = canvasRect.left - VIEWPORT_MARGIN;

    if (spaceRight >= PANEL_WIDTH + GAP) {
      x = canvasRect.right + GAP;
    } else if (spaceLeft >= PANEL_WIDTH + GAP) {
      x = canvasRect.left - GAP - PANEL_WIDTH;
    } else {
      x = canvasRect.right - PANEL_WIDTH - GAP;
    }

    // Vertical: align top of panel to top of canvas, clamped to viewport
    y = canvasRect.top;

    // Clamp within viewport
    x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - PANEL_WIDTH - VIEWPORT_MARGIN));
    y = Math.max(
      VIEWPORT_MARGIN,
      Math.min(y, vh - panelRect.height - VIEWPORT_MARGIN)
    );

    positionX = x;
    positionY = y;
    positioned = true;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }

  function handleClickOutside(e: PointerEvent) {
    if (panelElement && !panelElement.contains(e.target as Node)) {
      onClose();
    }
  }

  onMount(() => {
    // Delay outside-click listener so the opening click doesn't immediately close
    const clickTimer = setTimeout(() => {
      document.addEventListener("pointerdown", handleClickOutside, true);
    }, 100);

    document.addEventListener("keydown", handleKeydown, true);

    // Compute position after first render
    requestAnimationFrame(() => {
      computePosition();
    });

    return () => {
      clearTimeout(clickTimer);
      document.removeEventListener("pointerdown", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeydown, true);
    };
  });
</script>

<div
  class="settings-panel themed-scrollbar"
  class:positioned
  bind:this={panelElement}
  style="left: {positionX}px; top: {positionY}px;"
  role="dialog"
  aria-label={title}
>
  <div class="panel-header">
    <div class="panel-title">
      <i
        class="fas {icon} panel-title-icon"
        style={iconColor ? `color: ${iconColor}` : ""}
        aria-hidden="true"
      ></i>
      <span>{title}</span>
    </div>
    <button
      class="close-button"
      onclick={onClose}
      aria-label="Close {title}"
    >
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
  </div>

  <div class="panel-body">
    {@render children()}
  </div>
</div>

<style>
  .settings-panel {
    position: fixed;
    z-index: 9998;
    width: 300px;
    max-height: 80vh;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    box-shadow:
      0 8px 24px var(--theme-shadow, rgba(0, 0, 0, 0.6)),
      0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.4));
    opacity: 0;
    pointer-events: none;
  }

  .settings-panel.positioned {
    opacity: 1;
    pointer-events: auto;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .panel-title-icon {
    font-size: var(--font-size-sm, 14px);
    flex-shrink: 0;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: background var(--duration-fast, 100ms) ease,
      color var(--duration-fast, 100ms) ease;
  }

  .close-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #ffffff);
  }

  .close-button:focus-visible {
    outline: 2px solid var(--theme-accent, #a855f7);
    outline-offset: -2px;
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-button {
      transition: none;
    }
  }
</style>
