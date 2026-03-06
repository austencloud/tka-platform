<!--
  RouteTreePicker — Module cards with pill-shaped toggle chips for screenshot route selection.
  Modules are tappable cards with expand/collapse. Tabs are toggle pills with accent tinting.
-->
<script lang="ts">
  import type { ModuleGroup } from "../../services/contracts/IScreenshotOrchestrator";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  interface Props {
    moduleGroups: ModuleGroup[];
    selectedRoutes: string[];
    onchange: (routes: string[]) => void;
  }

  let { moduleGroups, selectedRoutes, onchange }: Props = $props();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Track collapsed state per module
  let collapsed = $state<Record<string, boolean>>({});

  function getModuleRouteLabels(group: ModuleGroup): string[] {
    return group.routes.map((r) => r.label);
  }

  function isModuleFullySelected(group: ModuleGroup): boolean {
    return getModuleRouteLabels(group).every((l) => selectedRoutes.includes(l));
  }

  function isModulePartiallySelected(group: ModuleGroup): boolean {
    const labels = getModuleRouteLabels(group);
    const selectedCount = labels.filter((l) => selectedRoutes.includes(l)).length;
    return selectedCount > 0 && selectedCount < labels.length;
  }

  function toggleModule(group: ModuleGroup) {
    hapticService?.trigger("selection");
    const labels = getModuleRouteLabels(group);
    const allSelected = isModuleFullySelected(group);

    let next: string[];
    if (allSelected) {
      next = selectedRoutes.filter((r) => !labels.includes(r));
    } else {
      const existing = new Set(selectedRoutes);
      for (const label of labels) existing.add(label);
      next = [...existing];
    }
    onchange(next);
  }

  function toggleRoute(label: string) {
    hapticService?.trigger("selection");
    const next = selectedRoutes.includes(label)
      ? selectedRoutes.filter((r) => r !== label)
      : [...selectedRoutes, label];
    onchange(next);
  }

  function toggleCollapse(moduleId: string) {
    collapsed = { ...collapsed, [moduleId]: !collapsed[moduleId] };
  }

  function selectAll() {
    hapticService?.trigger("selection");
    const all = moduleGroups.flatMap((g) => g.routes.map((r) => r.label));
    onchange(all);
  }

  function selectNone() {
    hapticService?.trigger("selection");
    onchange([]);
  }

  function formatTabLabel(route: { label: string; tabId?: string }): string {
    if (route.tabId) {
      return route.tabId.charAt(0).toUpperCase() + route.tabId.slice(1);
    }
    return route.label.charAt(0).toUpperCase() + route.label.slice(1);
  }

  function selectedCountInModule(group: ModuleGroup): number {
    const labels = getModuleRouteLabels(group);
    return labels.filter((l) => selectedRoutes.includes(l)).length;
  }
</script>

<div class="route-tree">
  <div class="tree-header">
    <span class="tree-title">Routes</span>
    <div class="bulk-actions">
      <button class="link-btn" onclick={selectAll}>All</button>
      <span class="separator">/</span>
      <button class="link-btn" onclick={selectNone}>None</button>
    </div>
  </div>

  <div class="tree-body">
    {#each moduleGroups as group, groupIdx (group.moduleId)}
      {@const fullySelected = isModuleFullySelected(group)}
      {@const partial = isModulePartiallySelected(group)}
      {@const isCollapsed = collapsed[group.moduleId] ?? false}
      {@const selCount = selectedCountInModule(group)}

      <div class="module-card" style="--group-i: {groupIdx};">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="module-header"
          class:fully-selected={fullySelected}
          class:partial={partial}
          onclick={() => toggleCollapse(group.moduleId)}
          onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollapse(group.moduleId); } }}
          role="button"
          tabindex="0"
          aria-expanded={!isCollapsed}
          aria-label="{isCollapsed ? 'Expand' : 'Collapse'} {group.displayName}"
        >
          <i class="fas fa-chevron-right chevron" class:expanded={!isCollapsed}></i>
          <span class="module-name">{group.displayName}</span>
          <span class="route-count">
            {#if selCount > 0}
              <span class="sel-badge">{selCount}/{group.routes.length}</span>
            {:else}
              {group.routes.length}
            {/if}
          </span>
          <button
            class="module-toggle-btn"
            onclick={(e) => { e.stopPropagation(); toggleModule(group); }}
            aria-label="{fullySelected ? 'Deselect' : 'Select'} all {group.displayName} routes"
          >
            {fullySelected ? "Deselect" : "Select"} all
          </button>
        </div>

        {#if !isCollapsed}
          <div class="pill-grid" role="group" aria-label="{group.displayName} routes">
            {#each group.routes as route, pillIdx (route.label)}
              {@const isSelected = selectedRoutes.includes(route.label)}
              <button
                class="toggle-pill"
                class:selected={isSelected}
                style="--pill-i: {pillIdx};"
                role="switch"
                aria-checked={isSelected}
                onclick={() => toggleRoute(route.label)}
              >
                <span class="pill-label">{formatTabLabel(route)}</span>
                {#if route.requiresAuth}
                  <i class="fas fa-lock pill-lock" title="Requires authentication"></i>
                {/if}
                {#if isSelected}
                  <i class="fas fa-check pill-check"></i>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .route-tree {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tree-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .tree-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--theme-accent, #3b82f6);
    cursor: pointer;
    padding: 4px 8px;
    font-family: inherit;
    font-size: inherit;
    border-radius: 4px;
    transition: transform var(--duration-instant, 100ms) var(--ease-out, ease-out);
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .link-btn:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .separator {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .tree-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Module Card */
  .module-card {
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    overflow: hidden;
    animation: slideUp var(--duration-normal, 200ms) var(--ease-out, ease-out) both;
    animation-delay: calc(var(--stagger-normal, 50ms) * var(--group-i, 0));
  }

  .module-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    font-family: inherit;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    text-align: left;
    width: 100%;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      background var(--duration-fast, 150ms) var(--ease-out, ease-out),
      border-color var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .module-header:hover {
    transform: scale(var(--hover-scale-md, 1.02)) translateY(var(--hover-lift-sm, -1px));
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .module-header:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .module-header.partial {
    border-left: 4px solid var(--theme-accent, #3b82f6);
  }

  .module-header.fully-selected {
    border-color: var(--theme-accent, #3b82f6);
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 8%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)));
  }

  .module-header:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  .chevron {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    transition: transform var(--duration-fast, 150ms) var(--ease-out, ease-out);
    flex-shrink: 0;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .module-name {
    flex: 1;
  }

  .route-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .sel-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
    color: var(--theme-accent, #3b82f6);
    font-weight: 600;
    font-size: 10px;
  }

  .module-toggle-btn {
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-family: inherit;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition:
      color var(--duration-instant, 100ms) var(--ease-out, ease-out),
      border-color var(--duration-instant, 100ms) var(--ease-out, ease-out);
    flex-shrink: 0;
  }

  .module-toggle-btn:hover {
    color: var(--theme-accent, #3b82f6);
    border-color: var(--theme-accent, #3b82f6);
  }

  /* Pill Grid */
  .pill-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
  }

  .toggle-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-family: inherit;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      background var(--duration-fast, 150ms) var(--ease-out, ease-out),
      border-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
      color var(--duration-fast, 150ms) var(--ease-out, ease-out);
    min-height: 34px;
    animation: popIn var(--duration-emphasis, 280ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
    animation-delay: calc(var(--stagger-micro, 30ms) * var(--pill-i, 0));
  }

  .toggle-pill:hover {
    transform: scale(var(--hover-scale-md, 1.02));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #fff);
    filter: brightness(1.08);
  }

  .toggle-pill:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .toggle-pill.selected {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 50%, transparent);
    color: var(--theme-text, #fff);
  }

  .toggle-pill:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  .pill-label {
    white-space: nowrap;
  }

  .pill-lock {
    font-size: 9px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .pill-check {
    font-size: 9px;
    color: var(--theme-accent, #3b82f6);
    animation: popIn var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }

  /* Mobile touch targets */
  @media (max-width: 768px) {
    .toggle-pill {
      min-height: var(--min-touch-target);
      padding: 10px 16px;
    }

    .module-header {
      min-height: var(--min-touch-target);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .module-card,
    .toggle-pill,
    .pill-check {
      animation: none;
    }

    .module-header,
    .toggle-pill,
    .chevron,
    .link-btn,
    .module-toggle-btn {
      transition: none;
    }

    .module-header:hover,
    .module-header:active,
    .toggle-pill:hover,
    .toggle-pill:active,
    .link-btn:active {
      transform: none;
      filter: none;
    }
  }
</style>
