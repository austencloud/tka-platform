<!-- Desktop Navigation Sidebar -->
<!-- Modern 2026-style sidebar navigation for desktop in side-by-side layout -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
import type { HapticFeedback } from "../../application/services/haptic-feedback";
  import { onMount } from "svelte";
  import { slide, fade } from "svelte/transition";
  import { openDebugPanel } from "../../application/state/ui/ui-state.svelte";
  import type { ModuleDefinition, Section, ModuleId } from "../domain/types";
  import {
    desktopSidebarState,
    toggleDesktopSidebarCollapsed,
    initializeDesktopSidebarCollapsedState,
    saveDesktopSidebarCollapsedState,
  } from "../../layout/desktop-sidebar-state.svelte";
  import { createHoverIntent } from "../services/hover-intent";
  import { hasOpenDrawers } from "../../foundation/ui/drawer/drawer-stack";
  import SidebarHeader from "./desktop-sidebar/SidebarHeader.svelte";
  import SidebarFooter from "./desktop-sidebar/SidebarFooter.svelte";
  import ModuleGroup from "./desktop-sidebar/ModuleGroup.svelte";
  import CollapsedTabButton from "./desktop-sidebar/CollapsedTabButton.svelte";
  import CollapsedModuleButton from "./desktop-sidebar/CollapsedModuleButton.svelte";
  import SidebarContextMenu from "./desktop-sidebar/SidebarContextMenu.svelte";
  import type { ContextMenuState } from "./desktop-sidebar/SidebarContextMenu.svelte";
  import AccountPopover from "./account/AccountPopover.svelte";
  import {
    navigationState,
    SETTINGS_TABS,
  } from "../state/navigation-state.svelte";
  import { featureFlagService } from "../../auth/services/post-hog-feature-flag-service.svelte";
  import { authState } from "../../auth/state/auth-state.svelte";
  import { resolveAccessTier } from "../../auth/domain/access-tier";
  import { isTabAccessible } from "../../auth/domain/guest-access-config";
  import { isPremiumOrAbove } from "../../auth/domain/models/user-role";
  import { t } from "../../i18n/i18n.svelte";
  import { getReactiveLocale } from "../../i18n/locale-state.svelte";

  let {
    currentModule,
    currentSection,
    modules = [],
    onModuleChange,
    onSectionChange,
    onHeightChange,
    isEntryAnimating = false,
  } = $props<{
    currentModule: string;
    currentSection: string;
    modules: ModuleDefinition[];
    onModuleChange?: (
      moduleId: ModuleId,
      targetTab?: string
    ) => void | Promise<void>;
    onSectionChange?: (sectionId: string) => void;
    onHeightChange?: (height: number) => void;
    isEntryAnimating?: boolean;
  }>();

  // Services
  let hapticService: HapticFeedback;

  // Reactive locale for re-rendering translations
  const locale = $derived(getReactiveLocale());

  // Ref to sidebar element
  let sidebarElement = $state<HTMLElement | null>(null);

  // Track which modules are expanded - initialized empty, synced from currentModule via $effect below
  let expandedModules = $state<Set<string>>(new Set());

  // Keep expandedModules in sync with currentModule when it changes
  // This ensures the correct module is expanded after page restoration or external navigation
  $effect(() => {
    // When module changes from external source (Dashboard, deep link, etc.),
    // collapse others and expand only the current module
    if (currentModule) {
      expandedModules = new Set([currentModule]);
    }
  });

  // Get collapsed state reactively
  const isCollapsed = $derived(desktopSidebarState.isCollapsed);

  // Check if we're in settings mode (hides main modules)
  const isInSettings = $derived(navigationState.currentModule === "settings");

  // Check if Create module tutorial is active (hides Create tabs until choice step)
  // NOTE: The "tka-create-method-selected" key was never set anywhere in the codebase,
  // causing tabs to be permanently hidden. Since there's no functional tutorial flow,
  // we now always return true to show tabs. If a Create tutorial is implemented later,
  // this should use the standard pattern: tka-create-onboarding-completed
  const hasCompletedCreateTutorial = $derived(() => {
    return true; // No tutorial implemented - always show tabs
  });

  // Tutorial is active when in Create module AND tutorial not completed yet
  // This prevents the flash of tabs on initial load
  const isCreateTutorialActive = $derived(
    navigationState.currentModule === "create" && !hasCompletedCreateTutorial()
  );
  // No Create tutorial implemented - always show tabs
  const isOnTutorialChoiceStep = $derived(false);

  // Get filtered settings sections using feature flag service
  const filteredSettingsSections = $derived(
    SETTINGS_TABS.filter((section) => {
      return featureFlagService.canAccessTab("settings", section.id);
    })
  );

  // --- Hover-expand overlay state (rail mode only) -------------------------
  // hoverExpanded is a purely VISUAL flag: it widens the sidebar above the
  // content without touching desktopSidebarState.width (the reserved width).
  let hoverExpanded = $state(false);
  let pointerInside = $state(false);
  let focusInside = $state(false);
  let hoverCapable = $state(false);

  // What the user SEES (and therefore how the sidebar behaves)
  const visuallyExpanded = $derived(!isCollapsed || hoverExpanded);

  const hoverIntent = createHoverIntent({
    // Edge-anchored rail: the pointer can't overshoot past it (it's against
    // the viewport edge), so entering is almost always intentional. Near-zero
    // open delay makes it feel instant, like Cloudflare's; a tiny 50ms still
    // filters a fast vertical flick clipping the edge. Close keeps its grace.
    openDelay: 50,
    onOpen: () => {
      hoverExpanded = true;
    },
    onClose: () => {
      hoverExpanded = false;
    },
  });

  // Context menu state
  let contextMenuState = $state<ContextMenuState>({ mode: "closed" });

  // Account popover state (rendered outside nav to avoid overflow clipping)
  let accountPopoverOpen = $state(false);
  let accountSectionEl = $state<HTMLElement | null>(null);

  // Floating UI anchored to sidebar elements must hold the overlay open —
  // collapsing under an open menu/popover would orphan its anchor.
  const holdOpen = $derived(
    contextMenuState.mode !== "closed" || accountPopoverOpen
  );

  function handleSidebarPointerEnter() {
    pointerInside = true;
    // Drawers (z 400) sit above the sidebar (z 200) anchored at the reserved
    // edge — expanding underneath one looks broken, so suppress.
    if (!hoverCapable || !isCollapsed || hasOpenDrawers()) return;
    hoverIntent.pointerEnter();
  }

  function handleSidebarPointerLeave() {
    pointerInside = false;
    if (!hoverExpanded) {
      hoverIntent.cancel();
      return;
    }
    if (holdOpen) return; // the $effect below re-arms close when guard clears
    hoverIntent.pointerLeave();
  }

  function handleSidebarFocusIn() {
    focusInside = true;
    if (!isCollapsed) return;
    // Keyboard users get no intent delay
    hoverIntent.openNow();
  }

  function handleSidebarFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && sidebarElement?.contains(next)) return;
    focusInside = false;
    if (pointerInside || holdOpen) return;
    hoverIntent.closeNow();
  }

  function handleSidebarKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && hoverExpanded) {
      hoverIntent.closeNow();
    }
  }

  // When a hold-open guard clears and both pointer and focus are already
  // gone, start the close grace so the overlay doesn't hang open forever.
  // focusInside matters: a keyboard-focus expansion has no pointer inside,
  // and must not self-close while the user is still tabbing through it.
  $effect(() => {
    if (!holdOpen && !pointerInside && !focusInside && hoverExpanded) {
      hoverIntent.pointerLeave();
    }
  });

  function toggleAccountPopover() {
    accountPopoverOpen = !accountPopoverOpen;
  }

  function closeAccountPopover() {
    accountPopoverOpen = false;
  }

  function handleModuleContextMenu(e: MouseEvent, moduleId: string) {
    if (!featureFlagService.isAdmin) return; // Admin-only feature
    e.preventDefault();
    const moduleDef = modules.find((m: ModuleDefinition) => m.id === moduleId);
    if (!moduleDef || !moduleDef.sections.length) return; // No tabs to toggle
    contextMenuState = {
      mode: "module",
      moduleId: moduleId as ModuleId,
      moduleLabel: moduleDef.label,
      x: e.clientX,
      y: e.clientY,
    };
  }

  function handleTabContextMenu(e: MouseEvent, moduleId: string, section: Section) {
    if (!featureFlagService.isAdmin) return; // Admin-only feature
    e.preventDefault();
    contextMenuState = {
      mode: "tab",
      moduleId: moduleId as ModuleId,
      tabId: section.id,
      tabLabel: section.label,
      x: e.clientX,
      y: e.clientY,
    };
  }

  function handleEmptySpaceContextMenu(e: MouseEvent) {
    if (!featureFlagService.isAdmin) return;
    // Only trigger if right-clicking on the container itself or empty space,
    // not on a module button or its children
    const target = e.target as HTMLElement;
    if (target.closest(".module-group, .module-context-group, button, a")) return;
    e.preventDefault();
    contextMenuState = {
      mode: "modules",
      x: e.clientX,
      y: e.clientY,
    };
  }

  function closeContextMenu() {
    contextMenuState = { mode: "closed" };
  }

  function toggleModuleExpansion(moduleId: string) {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    expandedModules = newExpanded;
  }

  function handleModuleTap(moduleId: string, isDisabled: boolean = false) {
    // Don't trigger haptic or allow interaction for disabled modules
    if (isDisabled) {
      return;
    }

    hapticService?.trigger("selection");

    // Find the module definition to check if it has sections
    const moduleDefinition = modules.find(
      (m: ModuleDefinition) => m.id === moduleId
    );
    const hasNoSections = !moduleDefinition?.sections?.length;
    const isCurrentModule = moduleId === currentModule;

    // If sidebar reads as a rail OR module has no sections, switch directly.
    // Keyed off VISUAL state: a hover-expanded rail behaves like the
    // expanded sidebar because that is what the user is looking at.
    if (!visuallyExpanded || hasNoSections) {
      // Switch to the clicked module
      onModuleChange?.(moduleId as ModuleId);
      // Also expand/collapse the module group
      if (visuallyExpanded) {
        toggleModuleExpansion(moduleId);
      }
    } else {
      // Peek, don't navigate: module headers toggle their tab list so the
      // expanded sidebar is a discovery surface. Navigating here would fire
      // a view transition that yanks the hover overlay shut mid-browse and
      // bounce the user to the module's last tab. Tabs are the navigators.
      toggleModuleExpansion(moduleId);
    }
  }

  async function handleSectionTap(moduleId: string, section: Section) {
    if (!section.disabled) {
      hapticService?.trigger("selection");

      // Switch to the section's module if we're not already on it
      // Pass the target section so the correct tab is set immediately
      if (moduleId !== currentModule) {
        await onModuleChange?.(moduleId as ModuleId, section.id);
      } else {
        // Already in this module, just switch the section
        onSectionChange?.(section.id);
      }

      // Ensure the module is expanded after navigation
      expandedModules = new Set([...expandedModules, moduleId]);
    }
  }

  async function handleSettingsTap() {
    hapticService?.trigger("selection");

    // Toggle behavior: if in settings, go back to previous module
    if (navigationState.currentModule === "settings") {
      const previousModule = navigationState.previousModule || "create";
      await onModuleChange?.(previousModule as ModuleId);
    } else {
      await onModuleChange?.("settings" as ModuleId);
    }
  }

  function handleToggleCollapse() {
    hapticService?.trigger("selection");
    const pinning = desktopSidebarState.isCollapsed; // rail → pinned
    toggleDesktopSidebarCollapsed();
    saveDesktopSidebarCollapsedState(desktopSidebarState.isCollapsed);
    hoverIntent.cancel();
    // Pinning: visual expansion now comes from !isCollapsed. Unpinning under
    // the cursor: stay visually open until the pointer leaves (no snap-shut).
    hoverExpanded = pinning ? false : pointerInside;
  }

  function handleDebugTap() {
    hapticService?.trigger("selection");
    openDebugPanel();
  }

  function handleSettingsSectionTap(section: Section) {
    hapticService?.trigger("selection");
    // Use onSectionChange to go through navigation coordinator for URL updates
    onSectionChange?.(section.id);
  }

  // Guest tab gating: mirror the expanded sidebar (ModuleGroup.svelte). Role-based
  // canAccessTab() passes for the guest's implicit "user" role, so without the
  // guest-config check the collapsed sidebar leaks gated tabs (collections,
  // creators, hall-of-shame) to guests.
  const accessTier = $derived(
    resolveAccessTier(
      authState.isAuthenticated,
      authState.isAnonymous,
      isPremiumOrAbove(authState.role)
    )
  );

  // Filter sections based on module-specific rules (e.g., admin-only tabs)
  // Uses featureFlagService.canAccessTab() for role-based access control,
  // plus isTabAccessible() for guest-tier gating (only subtracts for guests).
  function getFilteredSections(module: ModuleDefinition): Section[] {
    // Hide Create module tabs during tutorial (until choice step)
    if (
      module.id === "create" &&
      isCreateTutorialActive &&
      !isOnTutorialChoiceStep
    ) {
      return [];
    }

    return module.sections.filter((section) => {
      return (
        featureFlagService.canAccessTab(module.id, section.id) &&
        isTabAccessible(module.id, section.id, accessTier)
      );
    });
  }

  onMount(() => {
    // Initialize collapsed state from localStorage
    initializeDesktopSidebarCollapsedState();

    // Initialize services
    hapticService = getHapticFeedback();

    // Hover-expand only for real pointers; convertibles can flip mid-session
    const hoverMq = window.matchMedia("(hover: hover) and (pointer: fine)");
    hoverCapable = hoverMq.matches;
    const onHoverMqChange = (ev: MediaQueryListEvent) => {
      hoverCapable = ev.matches;
      if (!ev.matches) hoverIntent.closeNow();
    };
    hoverMq.addEventListener("change", onHoverMqChange);

    // Set up ResizeObserver to measure and report sidebar height
    let resizeObserver: ResizeObserver | null = null;
    if (sidebarElement) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height =
            entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          onHeightChange?.(height);
        }
      });
      resizeObserver.observe(sidebarElement);

      // Report initial height
      const initialHeight = sidebarElement.getBoundingClientRect().height;
      if (initialHeight > 0) {
        onHeightChange?.(initialHeight);
      }
    }

    // Return cleanup function
    return () => {
      resizeObserver?.disconnect();
      hoverMq.removeEventListener("change", onHoverMqChange);
      hoverIntent.cancel();
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav
  class="desktop-navigation-sidebar"
  class:collapsed={!visuallyExpanded}
  class:hover-expanded={hoverExpanded && isCollapsed}
  class:entry-animating={isEntryAnimating}
  bind:this={sidebarElement}
  style="view-transition-name: sidebar"
  aria-label="Main navigation"
  onpointerenter={handleSidebarPointerEnter}
  onpointerleave={handleSidebarPointerLeave}
  onfocusin={handleSidebarFocusIn}
  onfocusout={handleSidebarFocusOut}
  onkeydown={handleSidebarKeydown}
>
  <!-- Sidebar Header/Branding -->
  <SidebarHeader
    mode={!visuallyExpanded ? "rail" : isCollapsed ? "hover" : "pinned"}
    onToggleCollapse={handleToggleCollapse}
  />

  <!-- Unified Navigation Content Container -->
  <!-- Single container holds both modules and settings tabs - no flexbox recalculation -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="navigation-content themed-scrollbar" class:tabs-mode={!visuallyExpanded} onscroll={closeContextMenu} oncontextmenu={handleEmptySpaceContextMenu}>
    {#if isInSettings}
      <!-- Settings Content with Back Button Header -->
      <div
        class="sidebar-settings-nav"
        in:slide={{ duration: 250, axis: "y" }}
        out:slide={{ duration: 200, axis: "y" }}
      >
        <!-- Settings Header (expanded only) -->
        {#if visuallyExpanded}
          <div class="settings-header">
            <i class="fas fa-cog settings-header-icon" aria-hidden="true"></i>
            <span class="settings-header-text">Settings</span>
          </div>
        {/if}

        <!-- Back Button Header -->
        <button
          class="settings-back-button"
          class:collapsed={!visuallyExpanded}
          onclick={handleSettingsTap}
          aria-label="Back to modules"
        >
          <div class="back-icon">
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
          </div>
          {#if visuallyExpanded}
            <span class="back-label">Back</span>
          {/if}
        </button>

        {#if !visuallyExpanded}
          <!-- Collapsed Settings Tabs -->
          <div class="collapsed-settings-tabs">
            {#each filteredSettingsSections as section, index}
              {@const isSectionActive =
                navigationState.activeTab === section.id}
              <div in:fade={{ duration: 150, delay: index * 25 }}>
                <CollapsedTabButton
                  {section}
                  moduleId="settings"
                  isActive={isSectionActive}
                  onClick={() => handleSettingsSectionTap(section)}
                />
              </div>
            {/each}
          </div>
        {:else}
          <!-- Expanded Settings Tabs -->
          <div class="settings-sections">
            {#each filteredSettingsSections as section, index}
              {@const isSectionActive =
                navigationState.activeTab === section.id}
              <button
                class="section-button"
                class:active={isSectionActive}
                onclick={() => handleSettingsSectionTap(section)}
                in:fade={{ duration: 150, delay: 50 + index * 30 }}
                style="--section-color: {section.color || '#64748b'};"
              >
                <span class="section-icon">{@html section.icon}</span>
                <span class="section-label">{t(section.labelKey)}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <!-- Modules List -->
      <div
        class="modules-content"
        in:slide={{ duration: 250, axis: "y" }}
        out:slide={{ duration: 200, axis: "y" }}
      >
        {#if !visuallyExpanded}
          <!-- VS Code-style Activity Bar: Modules with nested tabs -->
          <div class="activity-bar">
            {#each modules.filter((m: ModuleDefinition) => m.isMain) as module}
              {@const isModuleActive = currentModule === module.id}
              {@const moduleColor = module.color || "#a855f7"}
              {@const filteredSections = getFilteredSections(module)}
              {@const hasTabs = isModuleActive && filteredSections.length > 0}
              {@const isCreateInTutorialCollapsed =
                module.id === "create" &&
                isCreateTutorialActive &&
                !isOnTutorialChoiceStep}
              {@const forceActiveCollapsed = isCreateInTutorialCollapsed}
              {@const shouldShowGlassContainer =
                (isModuleActive || forceActiveCollapsed) && hasTabs}

              <!-- Module Context Group: Unified visual container for module + tabs -->
              <div
                class="module-context-group"
                class:active={isModuleActive || forceActiveCollapsed}
                class:has-tabs={shouldShowGlassContainer}
                style="--module-color: {moduleColor};"
              >
                <!-- Module Button -->
                <CollapsedModuleButton
                  {module}
                  isActive={isModuleActive || forceActiveCollapsed}
                  onClick={() =>
                    handleModuleTap(module.id, module.disabled ?? false)}
                  onContextMenu={(e) => handleModuleContextMenu(e, module.id)}
                  {moduleColor}
                  {hasTabs}
                />

                <!-- Nested Tabs (shown only for active module) -->
                {#if hasTabs}
                  <div
                    class="nested-tabs"
                    in:slide={{ duration: 200, axis: "y" }}
                    out:slide={{ duration: 150, axis: "y" }}
                  >
                    {#each filteredSections as section, index}
                      {@const isSectionActive = currentSection === section.id}

                      <div
                        in:fade={{ duration: 150, delay: index * 30 }}
                        out:fade={{ duration: 100 }}
                      >
                        <CollapsedTabButton
                          {section}
                          moduleId={module.id}
                          isActive={isSectionActive}
                          onClick={() => handleSectionTap(module.id, section)}
                          onContextMenu={(e) => handleTabContextMenu(e, module.id, section)}
                        />
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <!-- Show modules with expandable sections when expanded -->
          {#each modules.filter((m: ModuleDefinition) => m.isMain) as module}
            {@const isExpanded = expandedModules.has(module.id)}
            {@const moduleColor = module.color || "#a855f7"}
            {@const filteredSections = getFilteredSections(module)}
            {@const isCreateOnChoiceStep =
              module.id === "create" && isOnTutorialChoiceStep}
            {@const shouldCelebrate =
              isCreateOnChoiceStep && filteredSections.length > 0}
            {@const isCreateInTutorial =
              module.id === "create" &&
              isCreateTutorialActive &&
              !isOnTutorialChoiceStep}
            {@const forceActiveStyleLocal = isCreateInTutorial}

            <ModuleGroup
              module={{ ...module, sections: filteredSections }}
              {currentModule}
              {currentSection}
              {isExpanded}
              {moduleColor}
              onModuleClick={handleModuleTap}
              onSectionClick={handleSectionTap}
              onModuleContextMenu={handleModuleContextMenu}
              onSectionContextMenu={handleTabContextMenu}
              celebrateAppearance={shouldCelebrate}
              forceActiveStyle={forceActiveStyleLocal}
            />
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <!-- Sidebar Footer - settings, inbox, version -->
  <SidebarFooter
    isCollapsed={!visuallyExpanded}
    {isInSettings}
    onSettingsClick={handleSettingsTap}
    onAccountClick={toggleAccountPopover}
    bind:accountSectionElement={accountSectionEl}
  />

</nav>

<!-- Context menu rendered outside nav to avoid overflow: hidden clipping -->
<SidebarContextMenu menuState={contextMenuState} onClose={closeContextMenu} />

<!-- Account popover rendered outside nav to avoid overflow: hidden clipping -->
<AccountPopover
  isOpen={accountPopoverOpen}
  onClose={closeAccountPopover}
  anchorElement={accountSectionEl}
/>

<style>
  /* ============================================================================
     DESKTOP NAVIGATION SIDEBAR - 2026 MODERN DESIGN
     ============================================================================ */
  .desktop-navigation-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 220px;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border-right: 1px solid var(--theme-stroke);
    z-index: var(--z-sidebar);
    overflow: hidden;
    transition:
      width var(--duration-emphasis, 280ms)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      box-shadow var(--duration-emphasis, 280ms)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      top 0.2s ease;

    /* Completely exclude from view transitions */
    view-transition-name: none;

    /* Safe area support */
    padding-left: env(safe-area-inset-left);
  }

  .desktop-navigation-sidebar.collapsed {
    width: 64px;
  }

  /* Hover-expanded overlay (rail mode): floats above content, so it gets
     elevation. Width comes from the base rule (collapsed class is absent). */
  .desktop-navigation-sidebar.hover-expanded {
    box-shadow: 24px 0 48px -12px rgba(0, 0, 0, 0.45);
    border-right-color: var(--theme-stroke-strong, var(--theme-stroke));
  }

  /* ============================================================================
     UNIFIED NAVIGATION CONTENT CONTAINER
     ============================================================================ */
  .navigation-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px 8px;
    position: relative;
    /* Width tracks the animating nav (no fixed-220 pin). The module icons are
       left-anchored by their fixed 44px column, so they hold x=32 regardless
       of content width — no pin needed. A fixed 220px here made this flex
       child wider than the nav near the animation tail, and the flex cross-
       axis algorithm nudged it a few px left for a frame: the whole module
       stack sprang. Letting it track the nav keeps its left edge at 0. */

    /* Enable container queries for responsive sizing */
    container-type: inline-size;
    container-name: nav-content;
  }

  /* Tabs mode - VS Code activity bar layout when sidebar is collapsed */
  .navigation-content.tabs-mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 8px;
    width: 64px;
    /* Hide the scrollbar in rail mode (wheel/keys still scroll): a visible
       bar eats 10px of the 64px rail and shifts the centered icon column
       off the expanded tree's x=32 anchor. */
    scrollbar-width: none;
  }

  .navigation-content.tabs-mode::-webkit-scrollbar {
    display: none;
  }

  /* Inner content wrappers for transition targeting */
  .modules-content,
  .sidebar-settings-nav {
    width: 100%;
  }

  /* ============================================================================
     SETTINGS BACK BUTTON (at top of settings content)
     ============================================================================ */
  .settings-back-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .settings-back-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .settings-back-button.collapsed {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    justify-content: center;
    margin-bottom: 8px;
  }

  .back-icon {
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

  .settings-back-button.collapsed .back-icon {
    width: 100%;
    height: 100%;
    background: transparent;
    border-radius: 12px;
  }

  .settings-back-button:hover .back-icon {
    background: var(--theme-card-hover-bg);
  }

  .back-label {
    flex: 1;
    text-align: left;
    font-weight: 500;
    animation: label-fade-in var(--duration-normal) ease-out var(--duration-fast) both;
  }

  .settings-back-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* ============================================================================
     SETTINGS HEADER
     ============================================================================ */
  .settings-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 14px 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.7;
  }

  .settings-header-icon {
    font-size: var(--font-size-sm);
  }

  .settings-header-text {
    flex: 1;
  }

  /* ============================================================================
     SETTINGS SECTIONS (within unified container)
     ============================================================================ */
  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 4cqw, 10px);
  }

  .section-button {
    width: 100%;
    min-height: var(--min-touch-target); /* WCAG touch target minimum */
    display: flex;
    align-items: center;
    gap: clamp(10px, 6cqw, 14px);
    padding: clamp(12px, 7cqw, 16px) clamp(12px, 7cqw, 16px);
    background: transparent;
    border: none;
    border-radius: clamp(8px, 5cqw, 12px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    font-size: clamp(13px, 7.5cqw, 15px);
    font-weight: 600;
    text-align: left;
  }

  .section-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .section-button.active {
    background: color-mix(in srgb, var(--section-color) 18%, transparent);
    color: white;
    border-left: 3px solid var(--section-color);
    padding-left: 9px;
  }

  .section-icon {
    width: clamp(20px, 12cqw, 26px);
    height: clamp(20px, 12cqw, 26px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(16px, 10cqw, 20px);
    opacity: 0.8;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .section-button:hover .section-icon {
    opacity: 1;
  }

  .section-button.active .section-icon {
    opacity: 1;
    color: var(--section-color);
  }

  .section-icon :global(i) {
    font-size: inherit;
  }

  .section-label {
    flex: 1;

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

  /* Collapsed settings tabs */
  .collapsed-settings-tabs {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .section-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* ============================================================================
     ACTIVITY BAR (Collapsed Sidebar Mode)
     ============================================================================ */
  .activity-bar {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  /* Module Context Group - Unified container for module + tabs */
  .module-context-group {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 4px;
    padding: 4px;
    border-radius: 12px;
    position: relative;
    transition: all var(--duration-normal, 200ms)
      var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }

  /* Active module with tabs gets subtle unified background */
  .module-context-group.active.has-tabs {
    background: color-mix(in srgb, var(--module-color) 12%, rgba(0, 0, 0, 0.3));
    border: 1px solid color-mix(in srgb, var(--module-color) 20%, transparent);
    padding: 8px 4px 8px 4px; /* Increased top padding to contain module button */
    margin-bottom: 10px;
  }

  /* Nested Tabs - shown under active module. Vertical footprint (top gap 6px,
     47px per-row pitch, 3px trailing) matches the expanded SectionsList so the
     active-module tab block is the SAME height in both trees — modules below
     the active one don't jump on the hover-expand swap. */
  .nested-tabs {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 0 0 3px 0;
    margin-top: 6px;
    position: relative;
  }

  /* ============================================================================
     ENTRY ANIMATION - Choreographed slide-in after first-run wizard
     ============================================================================ */
  .desktop-navigation-sidebar.entry-animating {
    animation: sidebar-slide-in 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes sidebar-slide-in {
    from {
      opacity: 0;
      transform: translateX(-220px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* ============================================================================
     ANIMATIONS & TRANSITIONS
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .desktop-navigation-sidebar * {
      transition: none !important;
      animation: none !important;
    }

    .desktop-navigation-sidebar.entry-animating {
      animation: none;
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-contrast: high) {
    .desktop-navigation-sidebar {
      background: rgba(0, 0, 0, 0.95);
      border-right: 2px solid white;
    }
  }
</style>
