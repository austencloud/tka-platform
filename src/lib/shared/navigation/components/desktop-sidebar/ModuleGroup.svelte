<!-- Module Group Component -->
<!-- Combines a module button with its expandable sections list -->
<script lang="ts">
  import { tick } from "svelte";
  import type { ModuleDefinition, Section } from "../../domain/types";
  import ModuleButton from "./ModuleButton.svelte";
  import SectionsList from "./SectionsList.svelte";
  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { resolveAccessTier } from "$lib/shared/auth/domain/access-tier";
  import { getAccessibleTabs } from "$lib/shared/auth/domain/guest-access-config";
  import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/user-role";

  let {
    module,
    currentModule,
    currentSection,
    isExpanded,
    isCollapsed,
    isTransitioningFromCollapsed,
    moduleColor,
    onModuleClick,
    onSectionClick,
    onModuleContextMenu,
    onSectionContextMenu,
    celebrateAppearance = false,
    forceActiveStyle = false,
  } = $props<{
    module: ModuleDefinition;
    currentModule: string;
    currentSection: string;
    isExpanded: boolean;
    isCollapsed: boolean;
    isTransitioningFromCollapsed: boolean;
    moduleColor?: string;
    onModuleClick: (moduleId: string, isDisabled: boolean) => void;
    onSectionClick: (moduleId: string, section: Section) => void;
    onModuleContextMenu?: (e: MouseEvent, moduleId: string) => void;
    onSectionContextMenu?: (e: MouseEvent, moduleId: string, section: Section) => void;
    celebrateAppearance?: boolean;
    forceActiveStyle?: boolean;
  }>();

  // Reference to the module group element
  let moduleGroupElement = $state<HTMLDivElement | null>(null);

  const isActive = $derived(currentModule === module.id);
  const isDisabled = $derived(module.disabled ?? false);

  // Filter tabs for guests (e.g., Browse shows only Gallery)
  const accessTier = $derived(
    resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role))
  );
  const filteredSections = $derived.by(() => {
    const allowed = getAccessibleTabs(module.id, accessTier);
    if (!allowed) return module.sections; // No filtering for authenticated users
    return module.sections.filter((s: Section) => allowed.includes(s.id));
  });

  const hasSections = $derived(isExpanded && filteredSections.length > 0);
  // Show active styling if we have sections OR if forced (e.g., during tutorial)
  const showActiveStyle = $derived(hasSections || forceActiveStyle);

  // Badge counts for inbox sections
  const inboxBadgeCounts = $derived.by(
    (): Record<string, number> | undefined => {
      if (module.id !== "inbox") return undefined;
      return {
        notifications: inboxState.unreadNotificationCount,
        messages: inboxState.unreadMessageCount,
      };
    }
  );

  // Scroll the expanded module into view when it expands
  $effect(() => {
    if (!isExpanded || !hasSections || isCollapsed || !moduleGroupElement) return;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    // Wait for DOM update and slide transition to start
    tick().then(() => {
      if (cancelled) return;
      // Small delay to let the slide animation begin
      scrollTimer = setTimeout(() => {
        moduleGroupElement?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 100);
    });
    return () => {
      cancelled = true;
      if (scrollTimer !== undefined) clearTimeout(scrollTimer);
    };
  });
</script>

<div
  bind:this={moduleGroupElement}
  class="module-group"
  class:active={isActive}
  class:has-sections={showActiveStyle}
  style="--module-color: {moduleColor || '#a855f7'};"
>
  <!-- Module Button -->
  <ModuleButton
    {module}
    {isActive}
    {isExpanded}
    {isCollapsed}
    {hasSections}
    insideGlassContainer={showActiveStyle}
    onClick={() => onModuleClick(module.id, isDisabled)}
    onContextMenu={onModuleContextMenu ? (e) => onModuleContextMenu(e, module.id) : undefined}
  />

  <!-- Module Sections/Tabs (collapsible) -->
  {#if isExpanded && filteredSections.length > 0 && !isCollapsed && !isTransitioningFromCollapsed}
    <SectionsList
      sections={filteredSections}
      {currentSection}
      moduleId={module.id}
      {isActive}
      {onSectionClick}
      {onSectionContextMenu}
      {celebrateAppearance}
      badgeCounts={inboxBadgeCounts}
    />
  {/if}
</div>

<style>
  /* ============================================================================
     MODULE GROUP
     ============================================================================ */
  .module-group {
    margin-bottom: 8px;
    border-radius: 12px;
    padding: 4px;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Active module with expanded sections gets unified background */
  .module-group.active.has-sections {
    background: color-mix(in srgb, var(--module-color) 12%, rgba(0, 0, 0, 0.3));
    border: 1px solid color-mix(in srgb, var(--module-color) 20%, transparent);
    padding: 8px 6px;
    margin-bottom: 12px;
  }

  .module-group:last-child {
    margin-bottom: 0;
  }
</style>
