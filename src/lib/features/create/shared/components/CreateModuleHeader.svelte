<!--
  CreateModuleHeader.svelte

  Header component for Create module with segmented control for Construct/Generate toggle.
  Supports both horizontal (header) and vertical (sidebar) layouts.

  Responsibilities:
  - Display toggle with centered segmented control (horizontal) or vertical sidebar
  - Handle tab switching between Construct and Generate
  - Provide visual feedback for active tab
-->
<script lang="ts">
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Props
  const {
    activeTab,
    onTabChange,
    layout = "horizontal",
  } = $props<{
    activeTab: "construct" | "generate";
    onTabChange: (tab: "construct" | "generate") => void;
    layout?: "horizontal" | "vertical";
  }>();

  // Services
  let hapticService: IHapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Handle tab click
  function handleTabClick(tab: "construct" | "generate") {
    if (tab !== activeTab) {
      hapticService?.trigger("selection");
      onTabChange(tab);
    }
  }

  // Handle keyboard navigation
  function handleKeyDown(event: KeyboardEvent, tab: "construct" | "generate") {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTabClick(tab);
    }
  }
</script>

<!-- Header with segmented control - supports horizontal and vertical layouts -->
<div class="create-tab-header" class:vertical={layout === "vertical"}>
  <div class="header-content">
    <!-- Segmented Control -->
    <div
      class="segmented-control"
      role="tablist"
      aria-label={t("create_module_selection")}
    >
      <!-- Construct Tab -->
      <button
        type="button"
        class="segment-button"
        class:active={activeTab === "construct"}
        onclick={() => handleTabClick("construct")}
        onkeydown={(e) => handleKeyDown(e, "construct")}
        role="tab"
        aria-selected={activeTab === "construct"}
        aria-controls="construct-panel"
        tabindex={activeTab === "construct" ? 0 : -1}
        id="tab-construct"
        title={t("create_construct_mode")}
        data-testid="tab-constructor"
      >
        {#if layout === "vertical"}
          🔨
        {:else}
          🔨 {t("create_construct")}
        {/if}
      </button>

      <!-- Generate Tab -->
      <button
        type="button"
        class="segment-button"
        class:active={activeTab === "generate"}
        onclick={() => handleTabClick("generate")}
        onkeydown={(e) => handleKeyDown(e, "generate")}
        role="tab"
        aria-selected={activeTab === "generate"}
        aria-controls="generate-panel"
        tabindex={activeTab === "generate" ? 0 : -1}
        id="tab-generate"
        title={t("create_generate_mode")}
        data-testid="tab-generator"
      >
        {#if layout === "vertical"}
          ⚡
        {:else}
          ⚡ {t("create_generate")}
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  /* ============================================================================ */
  /* HORIZONTAL LAYOUT (Default) */
  /* ============================================================================ */

  .create-tab-header {
    width: 100%;
    position: relative;
    min-height: auto;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    border-bottom: 1px solid var(--theme-stroke);
    /* Enable container queries for intrinsic sizing */
    container-type: inline-size;
    container-name: create-header;
  }

  .header-content {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  /* ============================================================================ */
  /* VERTICAL LAYOUT (Sidebar) */
  /* ============================================================================ */

  .create-tab-header.vertical {
    width: auto;
    height: 100%;
    flex-direction: column;
    border-bottom: none;
    padding: 8px 0;
  }

  .create-tab-header.vertical .header-content {
    flex-direction: column;
    height: 100%;
  }

  /* Segmented Control Styles */
  .segmented-control {
    display: inline-flex;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 12px;
    gap: 0;
  }

  .create-tab-header.vertical .segmented-control {
    flex-direction: column;
    border-radius: 8px;
  }

  .segment-button {
    flex: 1;
    padding: 8px 16px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    /* Container-aware font sizing - scales from 11px to 14px based on container width */
    font-size: clamp(11px, 3cqi, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 10px;
    white-space: nowrap;
    user-select: none;
    min-height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(3px, 1cqi, 6px);
  }

  .create-tab-header.vertical .segment-button {
    padding: 12px 8px;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    font-size: var(--font-size-xl);
    white-space: normal;
  }

  .segment-button:hover:not(.active) {
    color: rgba(255, 255, 255, 0.8);
    background: var(--theme-card-bg, var(--theme-card-bg));
  }

  .segment-button.active {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 90%, transparent) 0%,
      rgba(118, 75, 162, 0.9) 100%
    );
    color: white;
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  /* Remove focus outline to prevent visual distraction on mobile */
  .segment-button:focus-visible {
    outline: none;
  }

  /* Container query: Fine-tune sizing at different container widths */
  @container create-header (min-width: 400px) {
    .segment-button {
      font-size: clamp(12px, 3.2cqi, 15px);
      gap: clamp(4px, 1.2cqi, 7px);
    }
  }

  @container create-header (min-width: 600px) {
    .segment-button {
      font-size: clamp(13px, 3.5cqi, 16px);
    }
  }

  /* Mobile responsive - retained for vertical layout which doesn't use container queries */
  @media (max-width: 768px) {
    .create-tab-header.vertical .segment-button {
      padding: 10px 6px;
      min-height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      font-size: var(--font-size-lg);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .segment-button {
      transition: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .segmented-control {
      border: 2px solid rgba(255, 255, 255, 0.5);
    }

    .segment-button.active {
      border: 2px solid #667eea;
    }
  }
</style>
