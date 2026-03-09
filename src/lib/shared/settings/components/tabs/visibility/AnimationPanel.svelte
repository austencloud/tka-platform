<!--
  AnimationPanel.svelte

  Settings panel for animation visibility options.
  Includes grid mode, trail style, and overlay toggles.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import AnimationPreviewController from "./AnimationPreviewController.svelte";
  import AnimationDesktopControls from "./AnimationDesktopControls.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    isMobileHidden?: boolean;
  }

  let { isMobileHidden = false }: Props = $props();

  let collapsed = $state(false);
</script>

<section
  class="settings-panel animation-panel"
  class:mobile-hidden={isMobileHidden}
>
  <header class="panel-header">
    <span class="panel-icon animation-icon">
      <i class="fas fa-film" aria-hidden="true"></i>
    </span>
    <h3 class="panel-title">{t("visibility_animation")}</h3>
    <button
      class="collapse-toggle"
      onclick={() => (collapsed = !collapsed)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand animation settings" : "Collapse animation settings"}
      type="button"
    >
      <i class="fas {collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" aria-hidden="true"></i>
    </button>
  </header>

  {#if !collapsed}
    <div class="panel-body" transition:slide={{ duration: 200 }}>
      <div class="preview-frame">
        <AnimationPreviewController />
      </div>

      <div class="panel-controls">
        <AnimationDesktopControls />
      </div>
    </div>
  {/if}
</section>

<style>
  .preview-frame {
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: 400px;
    border-radius: clamp(8px, 1.5cqi, 12px);
    border: 1px solid var(--theme-stroke);
    overflow: hidden;
    background: color-mix(in srgb, var(--theme-panel-bg) 80%, transparent);
    flex-shrink: 0;
  }

  .preview-frame :global(.canvas-wrapper) {
    width: 100% !important;
    height: 100% !important;
  }

  .preview-frame :global(canvas) {
    width: 100% !important;
    height: 100% !important;
  }

  .settings-panel {
    container-type: inline-size;
    container-name: animation-panel;
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2cqi, 16px);
    padding: clamp(12px, 2cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    min-width: 0;
    min-height: var(--vt-panel-min-h, auto);
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.2s ease;
  }

  .settings-panel:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
  }

  .settings-panel.mobile-hidden {
    display: none;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 10px);
    width: 100%;
    flex-shrink: var(--vt-header-shrink, 1);
  }

  .panel-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(26px, 8cqi, 32px);
    height: clamp(26px, 8cqi, 32px);
    border-radius: clamp(6px, 2cqi, 8px);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
    transition: all var(--duration-fast) ease;
  }

  .panel-icon.animation-icon {
    --icon-color: #f472b6;
    background: color-mix(in srgb, var(--icon-color) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--icon-color) 35%, transparent);
    color: var(--icon-color);
    box-shadow: 0 0 8px color-mix(in srgb, var(--icon-color) 15%, transparent);
  }

  .settings-panel:hover .panel-icon {
    box-shadow: 0 0 12px color-mix(in srgb, var(--icon-color) 25%, transparent);
  }

  .panel-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
    white-space: nowrap;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    flex: 1;
  }

  .panel-controls {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
    width: 100%;
    flex-shrink: var(--vt-controls-shrink, 1);
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(12px, 2cqi, 16px);
    width: 100%;
  }

  .collapse-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    border-radius: 6px;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .collapse-toggle:hover {
    background: color-mix(in srgb, var(--theme-text-dim) 15%, transparent);
    color: var(--theme-text);
  }

  .collapse-toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-panel,
    .collapse-toggle {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .settings-panel {
      border-width: 2px;
    }
  }

  @container animation-panel (max-width: 280px) {
    .panel-header {
      gap: 6px;
    }

    .panel-icon {
      width: 24px;
      height: 24px;
    }
  }
</style>
