<!--
  RouteTreePicker — Checkbox tree of modules/tabs for screenshot capture.
  Modules are parent nodes with indeterminate states. Tabs are leaf nodes.
-->
<script lang="ts">
  import type { ModuleGroup } from "../../services/contracts/IScreenshotOrchestrator";

  interface Props {
    moduleGroups: ModuleGroup[];
    selectedRoutes: string[];
    onchange: (routes: string[]) => void;
  }

  let { moduleGroups, selectedRoutes, onchange }: Props = $props();

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
    const labels = getModuleRouteLabels(group);
    const allSelected = isModuleFullySelected(group);

    let next: string[];
    if (allSelected) {
      // Deselect all routes in this module
      next = selectedRoutes.filter((r) => !labels.includes(r));
    } else {
      // Select all routes in this module
      const existing = new Set(selectedRoutes);
      for (const label of labels) existing.add(label);
      next = [...existing];
    }
    onchange(next);
  }

  function toggleRoute(label: string) {
    const next = selectedRoutes.includes(label)
      ? selectedRoutes.filter((r) => r !== label)
      : [...selectedRoutes, label];
    onchange(next);
  }

  function toggleCollapse(moduleId: string) {
    collapsed = { ...collapsed, [moduleId]: !collapsed[moduleId] };
  }

  function selectAll() {
    const all = moduleGroups.flatMap((g) => g.routes.map((r) => r.label));
    onchange(all);
  }

  function selectNone() {
    onchange([]);
  }

  function formatTabLabel(route: { label: string; tabId?: string }): string {
    if (route.tabId) {
      return route.tabId.charAt(0).toUpperCase() + route.tabId.slice(1);
    }
    return route.label.charAt(0).toUpperCase() + route.label.slice(1);
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
    {#each moduleGroups as group (group.moduleId)}
      {@const fullySelected = isModuleFullySelected(group)}
      {@const partial = isModulePartiallySelected(group)}
      {@const isCollapsed = collapsed[group.moduleId] ?? false}

      <div class="module-node">
        <div class="module-row">
          <button
            class="expand-toggle"
            onclick={() => toggleCollapse(group.moduleId)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Expand ${group.displayName}` : `Collapse ${group.displayName}`}
          >
            <i class="fas fa-chevron-right" class:expanded={!isCollapsed}></i>
          </button>

          <label class="module-label">
            <input
              type="checkbox"
              checked={fullySelected}
              indeterminate={partial}
              aria-checked={partial ? "mixed" : fullySelected}
              onchange={() => toggleModule(group)}
            />
            <span class="module-name">{group.displayName}</span>
            <span class="route-count">{group.routes.length}</span>
          </label>
        </div>

        {#if !isCollapsed}
          <div class="tab-list">
            {#each group.routes as route (route.label)}
              <label class="tab-label">
                <input
                  type="checkbox"
                  checked={selectedRoutes.includes(route.label)}
                  onchange={() => toggleRoute(route.label)}
                />
                <span class="tab-name">{formatTabLabel(route)}</span>
                {#if route.requiresAuth}
                  <i class="fas fa-lock auth-icon" title="Requires authentication"></i>
                {/if}
              </label>
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
    padding: 2px 4px;
    font-family: inherit;
    font-size: inherit;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .separator {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .tree-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .module-node {
    display: flex;
    flex-direction: column;
  }

  .module-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
  }

  .expand-toggle {
    background: none;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    padding: 2px 4px;
    font-size: 10px;
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease;
  }

  .expand-toggle .expanded {
    transform: rotate(90deg);
  }

  .expand-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .module-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    flex: 1;
  }

  .module-label input[type="checkbox"] {
    accent-color: var(--theme-accent, #3b82f6);
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .module-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #fff);
  }

  .route-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: auto;
  }

  .tab-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-left: 40px;
  }

  .tab-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 3px 0;
  }

  .tab-label input[type="checkbox"] {
    accent-color: var(--theme-accent, #3b82f6);
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .tab-name {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #fff);
  }

  .auth-icon {
    font-size: 9px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  @media (prefers-reduced-motion: reduce) {
    .expand-toggle {
      transition: none;
    }
  }
</style>
