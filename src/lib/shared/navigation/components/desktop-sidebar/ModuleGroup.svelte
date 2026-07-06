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
    isCollapsed = false,
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
    isCollapsed?: boolean;
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
    resolveAccessTier(authState.isAuthenticated, authState.isAnonymous, isPremiumOrAbove(authState.role))
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

  <!-- Module Sections/Tabs (collapsible). Rendered in BOTH rail and expanded
       states now (the trees are unified — 2026-07-06-sidebar-tree-unification
       spec). SectionsList morphs its tabs on isCollapsed instead of the sidebar
       swapping to a separate CollapsedTabButton rail. -->
  {#if isExpanded && filteredSections.length > 0}
    <SectionsList
      sections={filteredSections}
      groups={module.groups}
      {currentSection}
      moduleId={module.id}
      {isActive}
      {isCollapsed}
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
    /* One unified tree now renders this in both rail and expanded states, so
       these metrics ARE the module's y-rhythm (no cross-tree matching needed).
       2px horizontal padding keeps the ModuleButton icon center at x=32px. */
    margin-bottom: 4px;
    border-radius: 12px;
    padding: 4px 2px;
    /* Visuals only. `all` here tweens the padding/background swap between the
       plain and .active.has-sections states during the expand, nudging the
       icon column; geometry must snap so the stack doesn't spring. */
    transition:
      background-color var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1),
      border-color var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Active module with expanded sections gets a unified glass background
     (replaces the old rail's .module-context-group.active.has-tabs — same
     element in both states now). */
  .module-group.active.has-sections {
    background: color-mix(in srgb, var(--module-color) 12%, rgba(0, 0, 0, 0.3));
    border: 1px solid color-mix(in srgb, var(--module-color) 20%, transparent);
    padding: 8px 2px;
    margin-bottom: 10px;
  }

  .module-group:last-child {
    margin-bottom: 0;
  }
</style>
