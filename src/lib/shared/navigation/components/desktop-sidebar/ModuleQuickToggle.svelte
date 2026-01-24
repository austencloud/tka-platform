<!--
  ModuleQuickToggle - Full-viewport modal for managing module visibility and order

  Layout:
  - LEFT: Hidden modules (not shown in sidebar) - tap to show
  - RIGHT: Visible modules (shown in sidebar) - tap to hide, drag to reorder

  Features:
  - Only shows modules the user has role-based access to
  - Drag-and-drop reordering within Visible section
  - Order persists to Firestore and affects sidebar display
  - Core modules (create, explore, settings, admin) shown with lock icon, cannot be hidden
-->
<script lang="ts">
  import { onMount } from "svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import { featureFlagService } from "../../../auth/services/FeatureFlagService.svelte";
  import { getModuleDefinitions } from "../../../navigation-coordinator/navigation-coordinator.svelte";
  import { MODULE_DEFINITIONS } from "../../config/module-definitions";
  import { moduleIdToFeatureId } from "../../../auth/domain/models/FeatureFlag";
  import type { ModuleDefinition, ModuleId } from "../../domain/types";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  interface Props {
    isCollapsed: boolean;
  }

  let { isCollapsed }: Props = $props();

  let hapticService: IHapticFeedback | null = null;
  let open = $state(false);
  let saving = $state(false);

  // Core modules that cannot be toggled (always visible, shown but not clickable)
  const CORE_MODULES: ModuleId[] = ["create", "explore", "settings", "admin"];

  // Helper to check if a module is a core module
  function isCoreModule(moduleId: ModuleId): boolean {
    return CORE_MODULES.includes(moduleId);
  }

  // Get modules currently visible in sidebar (what getModuleDefinitions returns)
  // This is the source of truth for what the sidebar shows
  const sidebarModules = $derived(getModuleDefinitions());

  // Get modules the user has HIDDEN (in disabledFeatures but would otherwise be accessible)
  // These need to be shown so the user can un-hide them
  const hiddenModules = $derived.by(() => {
    const overrides = featureFlagService.userOverrides;
    const disabledFeatures = overrides.disabledFeatures;

    // Get modules that are in disabledFeatures
    const hiddenModuleDefs: ModuleDefinition[] = [];

    for (const featureId of disabledFeatures) {
      // Only process module features (not tabs or capabilities)
      if (!featureId.startsWith("module:")) continue;

      const moduleId = featureId.replace("module:", "") as ModuleId;

      // Skip core modules (they can't be hidden)
      if (isCoreModule(moduleId)) continue;

      // Find the module definition from the full list
      // If it's in disabledFeatures, user must have had access to disable it
      const fullDef = MODULE_DEFINITIONS.find((m) => m.id === moduleId);
      if (fullDef) {
        hiddenModuleDefs.push(fullDef);
      }
    }

    return hiddenModuleDefs;
  });

  // Visible modules = what's in the sidebar (excluding core, which are handled separately)
  const visibleModules = $derived.by(() => {
    const overrides = featureFlagService.userOverrides;
    const moduleOrder = overrides.moduleOrder || [];

    // Start with sidebar modules (already filtered by role and enabled status)
    const enabledModules = sidebarModules.filter((m) => m.isMain);

    // Sort by custom order, then by default order for unordered ones
    const ordered: ModuleDefinition[] = [];

    // First, add modules in the custom order
    for (const id of moduleOrder) {
      const mod = enabledModules.find((m) => m.id === id);
      if (mod) ordered.push(mod);
    }

    // Then add remaining enabled modules not in the order
    for (const mod of enabledModules) {
      if (!ordered.includes(mod)) {
        ordered.push(mod);
      }
    }

    return ordered;
  });

  // Drag state
  let draggedModule = $state<ModuleDefinition | null>(null);
  let dragOverIndex = $state<number | null>(null);

  function openModal() {
    hapticService?.trigger("selection");
    open = true;
  }

  function closeModal() {
    hapticService?.trigger("selection");
    open = false;
  }

  // Move a module from Hidden to Visible
  async function showModule(module: ModuleDefinition) {
    const userId = featureFlagService.userId;
    if (!userId) return;

    saving = true;
    hapticService?.trigger("selection");

    try {
      const currentOverrides = featureFlagService.userOverrides;
      const featureId = moduleIdToFeatureId(module.id);

      // Remove from disabled list
      const newDisabledFeatures = currentOverrides.disabledFeatures.filter(
        (f) => f !== featureId
      );

      // Add to end of module order
      const currentOrder = currentOverrides.moduleOrder || visibleModules.map((m) => m.id);
      const newOrder = [...currentOrder, module.id];

      await featureFlagService.setUserFeatureOverrides(userId, {
        ...currentOverrides,
        disabledFeatures: newDisabledFeatures,
        moduleOrder: newOrder,
      });
    } catch (error) {
      console.error("Failed to show module:", error);
      hapticService?.trigger("error");
    } finally {
      saving = false;
    }
  }

  // Move a module from Visible to Hidden
  async function hideModule(module: ModuleDefinition) {
    const userId = featureFlagService.userId;
    if (!userId) return;

    saving = true;
    hapticService?.trigger("selection");

    try {
      const currentOverrides = featureFlagService.userOverrides;
      const featureId = moduleIdToFeatureId(module.id);

      // Add to disabled list
      const newDisabledFeatures = [...currentOverrides.disabledFeatures, featureId];

      // Remove from module order
      const currentOrder = currentOverrides.moduleOrder || visibleModules.map((m) => m.id);
      const newOrder = currentOrder.filter((id) => id !== module.id);

      await featureFlagService.setUserFeatureOverrides(userId, {
        ...currentOverrides,
        disabledFeatures: newDisabledFeatures,
        moduleOrder: newOrder,
      });
    } catch (error) {
      console.error("Failed to hide module:", error);
      hapticService?.trigger("error");
    } finally {
      saving = false;
    }
  }

  // Drag and drop handlers
  function handleDragStart(e: DragEvent, module: ModuleDefinition) {
    if (!e.dataTransfer) return;
    draggedModule = module;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", module.id);
    hapticService?.trigger("selection");
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    e.dataTransfer.dropEffect = "move";
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  async function handleDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    dragOverIndex = null;

    if (!draggedModule) return;

    const userId = featureFlagService.userId;
    if (!userId) return;

    const currentIndex = visibleModules.findIndex((m) => m.id === draggedModule!.id);
    if (currentIndex === targetIndex || currentIndex === -1) {
      draggedModule = null;
      return;
    }

    saving = true;
    hapticService?.trigger("impact");

    try {
      // Create new order
      const newOrder = visibleModules.map((m) => m.id);
      newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, draggedModule.id);

      const currentOverrides = featureFlagService.userOverrides;
      await featureFlagService.setUserFeatureOverrides(userId, {
        ...currentOverrides,
        moduleOrder: newOrder,
      });
    } catch (error) {
      console.error("Failed to reorder modules:", error);
      hapticService?.trigger("error");
    } finally {
      draggedModule = null;
      saving = false;
    }
  }

  function handleDragEnd() {
    draggedModule = null;
    dragOverIndex = null;
  }

  // Touch-based reordering (for mobile)
  let touchDragModule = $state<ModuleDefinition | null>(null);
  let touchStartY = $state(0);
  let touchCurrentY = $state(0);
  let touchDragElement = $state<HTMLElement | null>(null);

  function handleTouchStart(e: TouchEvent, module: ModuleDefinition, element: HTMLElement) {
    // Long press to start drag
    touchDragModule = module;
    touchStartY = e.touches[0].clientY;
    touchCurrentY = e.touches[0].clientY;
    touchDragElement = element;
    hapticService?.trigger("selection");
  }

  function handleTouchMove(e: TouchEvent) {
    if (!touchDragModule) return;
    e.preventDefault();
    touchCurrentY = e.touches[0].clientY;

    // Calculate which index we're over
    const elements = document.querySelectorAll(".visible-module-cell");
    const currentY = e.touches[0].clientY;

    for (let i = 0; i < elements.length; i++) {
      const rect = elements[i].getBoundingClientRect();
      if (currentY >= rect.top && currentY <= rect.bottom) {
        dragOverIndex = i;
        break;
      }
    }
  }

  async function handleTouchEnd() {
    if (!touchDragModule || dragOverIndex === null) {
      touchDragModule = null;
      touchDragElement = null;
      dragOverIndex = null;
      return;
    }

    const currentIndex = visibleModules.findIndex((m) => m.id === touchDragModule!.id);
    if (currentIndex !== dragOverIndex && currentIndex !== -1) {
      await handleDrop(new DragEvent("drop"), dragOverIndex);
    }

    touchDragModule = null;
    touchDragElement = null;
    dragOverIndex = null;
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<!-- Trigger Button -->
<button
  class="toggle-trigger"
  class:collapsed={isCollapsed}
  onclick={openModal}
  type="button"
  aria-label="Manage modules"
>
  <div class="button-icon">
    <i class="fas fa-sliders-h" aria-hidden="true"></i>
  </div>
  {#if !isCollapsed}
    <span class="button-label">Modules</span>
  {/if}
</button>

<!-- Full-viewport Modal -->
<BaseModal bind:open size="module-grid" animation="pop">
  {#snippet header()}
    <div class="modal-header">
      <h2 class="modal-title">Manage Modules</h2>
      <button
        class="close-button"
        onclick={closeModal}
        type="button"
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="sections-container">
    <!-- Hidden Modules Section (LEFT) -->
    <section class="module-section hidden-section">
      <div class="section-header">
        <h3 class="section-title">
          <i class="fas fa-eye-slash" aria-hidden="true"></i>
          Hidden from Sidebar
        </h3>
        <span class="section-hint">Tap to show</span>
      </div>

      {#if hiddenModules.length === 0}
        <div class="empty-state">
          <p>All modules visible</p>
          <p class="empty-hint">Modules you hide will appear here</p>
        </div>
      {:else}
        <div class="module-grid hidden-grid" role="list" aria-label="Hidden modules">
          {#each hiddenModules as module, index (module.id)}
            <button
              class="module-cell hidden-module-cell"
              onclick={() => showModule(module)}
              type="button"
              style="--module-color: {module.color}; --stagger-index: {index}"
              role="listitem"
              aria-label="{module.label}, tap to show in sidebar"
              disabled={saving}
            >
              <div class="cell-background"></div>
              <div class="cell-content">
                <span class="cell-icon">{@html module.icon}</span>
                <span class="cell-label">{module.label}</span>
              </div>
              <div class="add-indicator">
                <i class="fas fa-plus-circle" aria-hidden="true"></i>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Divider -->
    <div class="section-divider">
      <span class="divider-line"></span>
      <span class="divider-icon">
        <i class="fas fa-arrows-alt-h" aria-hidden="true"></i>
      </span>
      <span class="divider-line"></span>
    </div>

    <!-- Visible Modules Section (RIGHT) - syncs to sidebar -->
    <section class="module-section visible-section">
      <div class="section-header">
        <h3 class="section-title">
          <i class="fas fa-eye" aria-hidden="true"></i>
          Visible in Sidebar
        </h3>
        <span class="section-hint">Drag to reorder</span>
      </div>

      {#if visibleModules.length === 0}
        <div class="empty-state">
          <p>No visible modules</p>
          <p class="empty-hint">Tap a hidden module to add it</p>
        </div>
      {:else}
        <div
          class="module-grid visible-grid"
          role="list"
          aria-label="Visible modules in sidebar order, drag to reorder"
        >
          {#each visibleModules as module, index (module.id)}
            {@const isCore = isCoreModule(module.id)}
            {@const isDragging = !isCore && draggedModule?.id === module.id}
            {@const isDropTarget = dragOverIndex === index && !isDragging}
            {#if isCore}
              <!-- Core module - always visible, not toggleable -->
              <div
                class="module-cell visible-module-cell core-module"
                style="--module-color: {module.color}; --stagger-index: {index + hiddenModules.length}"
                role="listitem"
                aria-label="{module.label}, always visible"
              >
                <div class="cell-background"></div>
                <div class="cell-glow"></div>
                <div class="cell-content">
                  <span class="cell-icon">{@html module.icon}</span>
                  <span class="cell-label">{module.label}</span>
                </div>
                <div class="lock-indicator">
                  <i class="fas fa-lock" aria-hidden="true"></i>
                </div>
              </div>
            {:else}
              <!-- Toggleable module -->
              <button
                class="module-cell visible-module-cell"
                class:dragging={isDragging}
                class:drop-target={isDropTarget}
                draggable="true"
                ondragstart={(e) => handleDragStart(e, module)}
                ondragover={(e) => handleDragOver(e, index)}
                ondragleave={handleDragLeave}
                ondrop={(e) => handleDrop(e, index)}
                ondragend={handleDragEnd}
                onclick={() => hideModule(module)}
                type="button"
                style="--module-color: {module.color}; --stagger-index: {index + hiddenModules.length}"
                role="listitem"
                aria-label="{module.label}, tap to hide from sidebar"
                disabled={saving}
              >
                <div class="cell-background"></div>
                <div class="cell-glow"></div>
                <div class="cell-content">
                  <div class="drag-handle">
                    <i class="fas fa-grip-vertical" aria-hidden="true"></i>
                  </div>
                  <span class="cell-icon">{@html module.icon}</span>
                  <span class="cell-label">{module.label}</span>
                </div>
                <div class="remove-indicator">
                  <i class="fas fa-minus-circle" aria-hidden="true"></i>
                </div>
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <!-- Saving indicator -->
  {#if saving}
    <div class="saving-overlay">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Saving...</span>
    </div>
  {/if}
</BaseModal>

<style>
  /* ============================================================================
     TRIGGER BUTTON
     ============================================================================ */
  .toggle-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .toggle-trigger:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .toggle-trigger.collapsed {
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
    background: var(--theme-card-bg);
    transition: all var(--duration-normal) ease;
  }

  .toggle-trigger.collapsed .button-icon {
    width: 100%;
    height: 100%;
    background: transparent;
    border-radius: 12px;
  }

  .toggle-trigger:hover .button-icon {
    background: var(--theme-card-hover-bg);
  }

  .button-label {
    flex: 1;
    text-align: left;
    font-weight: 500;
  }

  .toggle-trigger:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* ============================================================================
     MODAL HEADER
     ============================================================================ */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .modal-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .close-button {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    font-size: var(--font-size-base);
  }

  .close-button:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .close-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* ============================================================================
     SECTIONS CONTAINER
     ============================================================================ */
  .sections-container {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 24px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .module-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 8px;
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-title i {
    font-size: 12px;
    opacity: 0.7;
  }

  .section-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    font-style: italic;
  }

  .section-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: var(--theme-stroke);
  }

  .divider-icon {
    color: var(--theme-text-dim);
    font-size: 12px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    text-align: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
  }

  .empty-state p {
    margin: 0;
  }

  .empty-hint {
    font-size: var(--font-size-compact);
    opacity: 0.7;
    margin-top: 4px;
  }

  /* ============================================================================
     MODULE GRIDS
     ============================================================================ */
  .module-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px;
    flex: 1;
    align-content: start;
    overflow-y: auto;
    min-height: 0;
    padding: 4px;
  }

  .visible-grid {
    min-height: 80px;
  }

  .hidden-grid {
    min-height: 60px;
  }

  /* ============================================================================
     MODULE CELLS
     ============================================================================ */
  .module-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: var(--theme-text);
    cursor: pointer;
    text-align: center;
    overflow: hidden;
    isolation: isolate;
    transition:
      transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 0.2s ease;
  }

  .cell-background {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
  }

  .cell-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 50% 25%,
      var(--module-color, #667eea) 0%,
      transparent 60%
    );
    opacity: 0.1;
    transition: opacity var(--duration-emphasis) ease;
    z-index: 1;
    mix-blend-mode: screen;
  }

  .cell-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 6px;
    width: 100%;
    height: 100%;
    z-index: 2;
  }

  .cell-icon {
    font-size: 22px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--duration-normal) ease;
  }

  .cell-icon :global(svg),
  .cell-icon :global(i) {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  .cell-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--theme-text);
    line-height: 1.2;
  }

  /* ============================================================================
     VISIBLE MODULE CELLS - Vibrant, module-colored (shown in sidebar)
     ============================================================================ */
  .visible-module-cell .cell-background {
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--module-color) 25%, rgba(255, 255, 255, 0.08)) 0%,
      color-mix(in srgb, var(--module-color) 15%, rgba(255, 255, 255, 0.03)) 100%
    );
    border: 1.5px solid color-mix(in srgb, var(--module-color) 50%, rgba(255, 255, 255, 0.2));
    box-shadow: 0 0 20px color-mix(in srgb, var(--module-color) 25%, transparent);
  }

  .visible-module-cell .cell-glow {
    opacity: 0.15;
  }

  .visible-module-cell:hover .cell-background {
    border-color: color-mix(in srgb, var(--module-color) 60%, rgba(255, 255, 255, 0.3));
    box-shadow: 0 0 28px color-mix(in srgb, var(--module-color) 35%, transparent);
  }

  .visible-module-cell:hover .cell-glow {
    opacity: 0.22;
  }

  .visible-module-cell:hover {
    transform: scale(1.02);
  }

  .visible-module-cell:hover .cell-icon {
    transform: scale(1.1);
  }

  .visible-module-cell .cell-icon :global(svg),
  .visible-module-cell .cell-icon :global(i) {
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--module-color) 40%, transparent));
  }

  /* Drag handle */
  .drag-handle {
    position: absolute;
    top: 6px;
    left: 6px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 10px;
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
  }

  .visible-module-cell:hover .drag-handle {
    opacity: 1;
  }

  /* Remove indicator */
  .remove-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    color: rgba(239, 68, 68, 0.6);
    font-size: 14px;
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
  }

  .visible-module-cell:hover .remove-indicator {
    opacity: 1;
  }

  /* Dragging state */
  .visible-module-cell.dragging {
    opacity: 0.5;
    transform: scale(0.95);
  }

  /* Drop target state */
  .visible-module-cell.drop-target .cell-background {
    border-color: var(--theme-accent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  /* Core module - always visible, not toggleable */
  .visible-module-cell.core-module {
    cursor: default;
  }

  .visible-module-cell.core-module .cell-background {
    opacity: 0.7;
  }

  .visible-module-cell.core-module:hover {
    transform: none;
  }

  .visible-module-cell.core-module:hover .cell-icon {
    transform: none;
  }

  /* Lock indicator for core modules */
  .lock-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 10px;
  }

  /* ============================================================================
     HIDDEN MODULE CELLS - Dimmed, gray (not in sidebar)
     ============================================================================ */
  .hidden-module-cell {
    opacity: 0.5;
  }

  .hidden-module-cell .cell-background {
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
  }

  .hidden-module-cell .cell-glow {
    opacity: 0;
  }

  .hidden-module-cell .cell-icon {
    filter: grayscale(0.6);
    opacity: 0.7;
  }

  .hidden-module-cell:hover {
    opacity: 0.8;
    transform: scale(1.02);
  }

  .hidden-module-cell:hover .cell-background {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(16, 185, 129, 0.3);
    border-style: solid;
  }

  .hidden-module-cell:hover .cell-icon {
    filter: grayscale(0);
    opacity: 1;
  }

  .hidden-module-cell .cell-label {
    color: var(--theme-text-dim);
  }

  /* Add indicator */
  .add-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    color: rgba(16, 185, 129, 0.7);
    font-size: 14px;
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
  }

  .hidden-module-cell:hover .add-indicator {
    opacity: 1;
  }

  /* ============================================================================
     SAVING OVERLAY
     ============================================================================ */
  .saving-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.5);
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    z-index: 100;
    border-radius: inherit;
  }

  /* ============================================================================
     DISABLED STATE
     ============================================================================ */
  .module-cell:disabled {
    cursor: not-allowed;
    pointer-events: none;
  }

  /* ============================================================================
     FOCUS STYLES
     ============================================================================ */
  .module-cell:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* ============================================================================
     RESPONSIVE
     ============================================================================ */
  @media (min-width: 768px) {
    .module-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
    }

    .module-cell {
      min-height: 85px;
    }

    .sections-container {
      padding: 24px;
    }
  }

  @media (min-width: 1100px) {
    .sections-container {
      flex-direction: row;
      gap: 24px;
    }

    .module-section {
      flex: 1;
      max-height: 100%;
    }

    .section-divider {
      flex-direction: column;
      padding: 0 12px;
      flex-shrink: 0;
    }

    .divider-line {
      width: 1px;
      height: auto;
      flex: 1;
    }

    .module-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }
  }

  @media (max-width: 520px) {
    .sections-container {
      padding: 16px;
    }

    .module-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .module-cell {
      min-height: 75px;
    }

    .cell-icon {
      font-size: 22px;
      width: 32px;
      height: 32px;
    }

    .cell-label {
      font-size: 10px;
    }

    .modal-header {
      padding: 16px 16px 12px;
    }

    .modal-title {
      font-size: var(--font-size-base, 16px);
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }

  /* ============================================================================
     REDUCED MOTION
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .toggle-trigger,
    .button-icon,
    .module-cell,
    .close-button,
    .cell-background,
    .cell-glow,
    .cell-icon,
    .drag-handle,
    .remove-indicator,
    .add-indicator {
      transition: none !important;
    }

    .module-cell:hover,
    .module-cell:active,
    .module-cell.dragging {
      transform: none !important;
    }
  }
</style>
