<!-- Desktop Navigation Sidebar -->
<!-- Thin wrapper over @austencloud/sidebar. The package owns the hover-expand
     overlay shell, the morphing module/section tree, the brand slide-reveal +
     pin, and the reserved-width behaviour. This wrapper supplies TKA's data and
     bridges TKA services (i18n, haptics, auth, feature flags, inbox) to the
     package's DI seam, and reparents TKA's footer + settings + account popover +
     admin context menu into the package's slots/callbacks. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";
  import { Sidebar } from "@austencloud/sidebar";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "../../application/services/haptic-feedback";
  import type { ModuleDefinition, Section, ModuleId } from "../domain/types";
  import {
    desktopSidebarState,
    setDesktopSidebarCollapsed,
    initializeDesktopSidebarCollapsedState,
    saveDesktopSidebarCollapsedState,
  } from "../../layout/desktop-sidebar-state.svelte";
  import SidebarFooter from "./desktop-sidebar/SidebarFooter.svelte";
  import CollapsedTabButton from "./desktop-sidebar/CollapsedTabButton.svelte";
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
  import { inboxState } from "../../inbox/state/inbox-state.svelte";
  import { prefetchOnIntent } from "../utils/module-prefetch";
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

  let hapticService: HapticFeedback | undefined;

  // Pin state is the package's model (rail vs pinned). It is kept in lockstep
  // with the legacy desktopSidebarState so MainInterface's reserved-width var
  // (--desktop-sidebar-width = desktopSidebarState.width) keeps working
  // unchanged. Seeded from storage on mount; persisted on change.
  let sidebarPinned = $state(false);
  $effect(() => {
    setDesktopSidebarCollapsed(!sidebarPinned);
    saveDesktopSidebarCollapsedState(!sidebarPinned);
  });

  const isInSettings = $derived(navigationState.currentModule === "settings");

  const accessTier = $derived(
    resolveAccessTier(
      authState.isAuthenticated,
      authState.isAnonymous,
      isPremiumOrAbove(authState.role)
    )
  );

  // --- Adapters bridging TKA services to the package seam -------------------
  function onHaptic() {
    hapticService?.trigger("selection");
  }

  function translateLabel(id: string): string {
    getReactiveLocale(); // re-run on locale change
    const m = modules.find((x: ModuleDefinition) => x.id === id);
    return m ? t(m.labelKey) : id;
  }

  function translateSectionLabel(
    moduleId: string,
    sectionId: string,
    fallback: string
  ): string {
    getReactiveLocale();
    const m = modules.find((x: ModuleDefinition) => x.id === moduleId);
    const s = m?.sections.find((x: Section) => x.id === sectionId);
    return s ? t(s.labelKey) : fallback;
  }

  // Role-based access + guest-tier gating (mirrors the old getFilteredSections).
  function filterSection(moduleId: string, sectionId: string): boolean {
    return (
      featureFlagService.canAccessTab(moduleId as ModuleId, sectionId) &&
      isTabAccessible(moduleId as ModuleId, sectionId, accessTier)
    );
  }

  function getBadgeCount(moduleId: string, sectionId?: string): number {
    if (moduleId === "inbox") {
      return sectionId ? 0 : inboxState.totalUnreadCount;
    }
    if (moduleId === "dashboard" && !sectionId) {
      return inboxState.unreadNotificationCount;
    }
    return 0;
  }

  function onModuleHover(id: string) {
    prefetchOnIntent(id);
  }

  // Package calls with plain strings; TKA's onModuleChange wants ModuleId.
  // Link-out entries (e.g. Shop, `linkHref` set) navigate away instead of
  // activating a module — the external @austencloud/sidebar package has no
  // concept of a plain link cell, so this is the seam that intercepts it.
  function handleModuleChange(moduleId: string, targetSection?: string) {
    const def = modules.find((m: ModuleDefinition) => m.id === moduleId);
    if (def?.linkHref) {
      goto(def.linkHref);
      return;
    }
    return onModuleChange?.(moduleId as ModuleId, targetSection);
  }

  // --- Admin context menu (host-rendered) -----------------------------------
  let contextMenuState = $state<ContextMenuState>({ mode: "closed" });

  function openModuleContextMenu(moduleId: string, e: MouseEvent) {
    const m = modules.find((x: ModuleDefinition) => x.id === moduleId);
    if (!m || !m.sections.length) return;
    contextMenuState = {
      mode: "module",
      moduleId: moduleId as ModuleId,
      moduleLabel: m.label,
      x: e.clientX,
      y: e.clientY,
    };
  }

  function openSectionContextMenu(
    moduleId: string,
    sectionId: string,
    e: MouseEvent
  ) {
    const m = modules.find((x: ModuleDefinition) => x.id === moduleId);
    const s = m?.sections.find((x: Section) => x.id === sectionId);
    contextMenuState = {
      mode: "tab",
      moduleId: moduleId as ModuleId,
      tabId: sectionId,
      tabLabel: s?.label ?? sectionId,
      x: e.clientX,
      y: e.clientY,
    };
  }

  function closeContextMenu() {
    contextMenuState = { mode: "closed" };
  }

  // --- Account popover (rendered outside nav to avoid overflow clipping) -----
  let accountPopoverOpen = $state(false);
  let accountSectionEl = $state<HTMLElement | null>(null);

  function toggleAccountPopover() {
    accountPopoverOpen = !accountPopoverOpen;
  }

  function closeAccountPopover() {
    accountPopoverOpen = false;
  }

  // Keep the hover overlay open while an anchored popover/menu is showing.
  const heldOpen = $derived(
    contextMenuState.mode !== "closed" || accountPopoverOpen
  );

  // --- Settings sub-nav (rendered in the beforeTree slot) -------------------
  const filteredSettingsSections = $derived(
    SETTINGS_TABS.filter((section) =>
      featureFlagService.canAccessTab("settings", section.id)
    )
  );

  async function handleSettingsTap() {
    hapticService?.trigger("selection");
    if (navigationState.currentModule === "settings") {
      const previousModule = navigationState.previousModule || "create";
      await onModuleChange?.(previousModule as ModuleId);
    } else {
      await onModuleChange?.("settings" as ModuleId);
    }
  }

  function handleSettingsSectionTap(section: Section) {
    hapticService?.trigger("selection");
    onSectionChange?.(section.id);
  }

  // In settings mode the module tree is empty; the settings nav renders in
  // beforeTree instead.
  const hostModules = $derived<ModuleDefinition[]>(
    isInSettings ? [] : modules
  );

  onMount(() => {
    hapticService = getHapticFeedback();
    initializeDesktopSidebarCollapsedState();
    sidebarPinned = !desktopSidebarState.isCollapsed;
  });
</script>

<Sidebar
  modules={hostModules}
  {currentModule}
  {currentSection}
  bind:pinned={sidebarPinned}
  railWidth={desktopSidebarState.collapsedWidth}
  expandedWidth={desktopSidebarState.expandedWidth}
  homeHref="/"
  onModuleChange={handleModuleChange}
  {onSectionChange}
  onModuleContextMenu={featureFlagService.isAdmin ? openModuleContextMenu : undefined}
  onSectionContextMenu={featureFlagService.isAdmin ? openSectionContextMenu : undefined}
  {onModuleHover}
  {onHaptic}
  {translateLabel}
  {translateSectionLabel}
  {filterSection}
  {getBadgeCount}
  holdOpen={heldOpen}
  class={isEntryAnimating ? "tka-sidebar-entry" : ""}
>
  <!-- Wordmark in the brand hero face (Fraunces italic 700), matching the
       landing SiteHeader .logo-text so both "TKA"s read as one brand. Both
       words share the treatment to preserve the package's slide-reveal morph. -->
  {#snippet brandLead()}<span class="brand-wordmark">TKA</span>{/snippet}
  {#snippet brandRest()}<span class="brand-wordmark">{" Composer"}</span>{/snippet}

  {#snippet beforeTree(expanded)}
    {#if isInSettings}
      <div class="sidebar-settings-nav">
        {#if expanded}
          <div class="settings-header">
            <i class="fas fa-cog settings-header-icon" aria-hidden="true"></i>
            <span class="settings-header-text">Settings</span>
          </div>
        {/if}

        <button
          class="settings-back-button"
          class:collapsed={!expanded}
          onclick={handleSettingsTap}
          aria-label="Back to modules"
        >
          <div class="back-icon">
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
          </div>
          {#if expanded}
            <span class="back-label">Back</span>
          {/if}
        </button>

        {#if !expanded}
          <div class="collapsed-settings-tabs">
            {#each filteredSettingsSections as section, index}
              {@const isSectionActive = navigationState.activeTab === section.id}
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
          <div class="settings-sections">
            {#each filteredSettingsSections as section, index}
              {@const isSectionActive = navigationState.activeTab === section.id}
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
    {/if}
  {/snippet}

  {#snippet footer(expanded)}
    <SidebarFooter
      isCollapsed={!expanded}
      {isInSettings}
      onSettingsClick={handleSettingsTap}
      onAccountClick={toggleAccountPopover}
      bind:accountSectionElement={accountSectionEl}
    />
  {/snippet}
</Sidebar>

<!-- Context menu + account popover rendered outside the nav (overflow clipping) -->
<SidebarContextMenu menuState={contextMenuState} onClose={closeContextMenu} />
<AccountPopover
  isOpen={accountPopoverOpen}
  onClose={closeAccountPopover}
  anchorElement={accountSectionEl}
/>

<style>
  /* Brand wordmark face — same as the landing SiteHeader .logo-text. The
     @austencloud/sidebar package leaves the brand font-family unset (inherits
     the app sans); these snippets override it to the Fraunces italic voice so
     the desktop-nav "TKA" matches the landing "TKA". Size + gradient stay owned
     by the package's .brand. Authored here, so this scoped rule reaches the
     span even though it renders inside the package. */
  .brand-wordmark {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  /* ============================================================================
     SETTINGS SUB-NAV (rendered via the package's beforeTree slot)
     ============================================================================ */
  .sidebar-settings-nav {
    width: 100%;
  }

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

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 4cqw, 10px);
  }

  .section-button {
    width: 100%;
    min-height: var(--min-touch-target);
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
    animation: label-fade-in var(--duration-normal) ease-out var(--duration-fast) both;
  }

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

  @media (prefers-reduced-motion: reduce) {
    .settings-back-button,
    .back-icon,
    .section-button,
    .section-icon {
      transition: none !important;
    }
    .back-label,
    .section-label {
      animation: none;
    }
  }
</style>
