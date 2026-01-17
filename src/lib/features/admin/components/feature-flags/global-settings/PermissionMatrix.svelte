<script lang="ts">
  /**
   * PermissionMatrix
   * Matrix view showing Features x Roles with inline editing
   * Modules are collapsible to show/hide their tabs
   */

  import type { FeatureFlagConfig } from "$lib/shared/auth/domain/models/FeatureFlag";
  import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";
  import { ROLE_HIERARCHY, ROLE_DISPLAY, hasRolePrivilege } from "$lib/shared/auth/domain/models/UserRole";
  import { featureFlagService } from "$lib/shared/auth/services/FeatureFlagService.svelte";
  import {
    buildFeatureHierarchy,
    getFeatureIconAndColor,
    getRoleColor,
  } from "../shared/feature-utils";
  import AdminSearchBox from "$lib/shared/admin/components/AdminSearchBox.svelte";
  import MatrixRow from "./MatrixRow.svelte";

  interface Props {
    onError: (message: string) => void;
  }

  let { onError }: Props = $props();

  let searchQuery = $state("");
  let savingFlags = $state<Set<string>>(new Set());
  let expandedModules = $state<Set<string>>(new Set());

  function toggleModule(moduleId: string) {
    const newSet = new Set(expandedModules);
    if (newSet.has(moduleId)) {
      newSet.delete(moduleId);
    } else {
      newSet.add(moduleId);
    }
    expandedModules = newSet;
  }

  function expandAll() {
    expandedModules = new Set(filteredModules().map(m => m.module.id));
  }

  function collapseAll() {
    expandedModules = new Set();
  }

  // Get flags from service
  const featureFlags = $derived(featureFlagService.featureConfigs);

  // Build hierarchy and filter
  const hierarchy = $derived(buildFeatureHierarchy(featureFlags));

  const filteredModules = $derived(() => {
    if (!searchQuery.trim()) return hierarchy.modules;
    const q = searchQuery.toLowerCase();
    return hierarchy.modules.filter((m) => {
      const moduleMatches =
        m.module.name.toLowerCase().includes(q) ||
        m.module.description.toLowerCase().includes(q);
      const tabMatches = m.tabs.some(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
      return moduleMatches || tabMatches;
    });
  });

  const filteredCapabilities = $derived(() => {
    if (!searchQuery.trim()) return hierarchy.capabilities;
    const q = searchQuery.toLowerCase();
    return hierarchy.capabilities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  });

  async function updateFlag(
    flag: FeatureFlagConfig,
    updates: Partial<Pick<FeatureFlagConfig, "minimumRole" | "enabled">>
  ) {
    savingFlags = new Set([...savingFlags, flag.id]);
    try {
      await featureFlagService.updateGlobalFeatureFlag(flag.id, updates);
    } catch (error) {
      console.error("Failed to update flag:", error);
      onError(`Failed to update ${flag.name}`);
    } finally {
      savingFlags = new Set([...savingFlags].filter((id) => id !== flag.id));
    }
  }

  function handleRoleClick(flag: FeatureFlagConfig, role: UserRole) {
    updateFlag(flag, { minimumRole: role });
  }

  function handleEnabledToggle(flag: FeatureFlagConfig) {
    updateFlag(flag, { enabled: !flag.enabled });
  }
</script>

<div class="permission-matrix">
  <div class="matrix-header">
    <div class="header-content">
      <h3>Permission Matrix</h3>
      <p>Click role cells to change minimum required role. Toggle to enable/disable globally.</p>
    </div>
    <div class="header-actions">
      <div class="expand-controls">
        <button type="button" class="expand-btn" onclick={expandAll} title="Expand all modules">
          <i class="fas fa-expand-alt" aria-hidden="true"></i>
          <span>Expand</span>
        </button>
        <button type="button" class="expand-btn" onclick={collapseAll} title="Collapse all modules">
          <i class="fas fa-compress-alt" aria-hidden="true"></i>
          <span>Collapse</span>
        </button>
      </div>
      <div class="search-box">
        <AdminSearchBox
          value={searchQuery}
          placeholder="Filter features..."
          oninput={(e) => (searchQuery = (e.target as HTMLInputElement).value)}
        />
      </div>
    </div>
  </div>

  <div class="matrix-container">
    <!-- Role headers -->
    <div class="matrix-row header-row">
      <div class="feature-cell header-cell">Feature</div>
      {#each ROLE_HIERARCHY as role}
        <div class="role-cell header-cell" style="--role-color: {getRoleColor(role)}">
          <i class="fas {ROLE_DISPLAY[role].icon}" aria-hidden="true"></i>
          <span>{ROLE_DISPLAY[role].label}</span>
        </div>
      {/each}
      <div class="toggle-cell header-cell">Enabled</div>
    </div>

    <!-- Modules -->
    {#each filteredModules() as { module, tabs }}
      {@const moduleStyle = getFeatureIconAndColor(module.id)}
      {@const isExpanded = expandedModules.has(module.id)}
      {@const hasTabs = tabs.length > 0}

      <div class="module-group" style="--module-color: {moduleStyle.color}">
        <div class="module-header" class:expanded={isExpanded}>
          {#if hasTabs}
            <button
              type="button"
              class="expand-toggle"
              onclick={() => toggleModule(module.id)}
              aria-expanded={isExpanded}
              aria-label="{isExpanded ? 'Collapse' : 'Expand'} {module.name}"
            >
              <i class="fas fa-chevron-right" class:rotated={isExpanded} aria-hidden="true"></i>
            </button>
          {:else}
            <div class="expand-placeholder"></div>
          {/if}

          <div class="module-row-content">
            <MatrixRow
              flag={module}
              saving={savingFlags.has(module.id)}
              toggleLocked={module.id === "module:admin"}
              toggleLockedReason="Cannot disable admin module while using it"
              onRoleClick={(role) => handleRoleClick(module, role)}
              onToggle={() => handleEnabledToggle(module)}
            />
          </div>

          {#if hasTabs}
            <span class="tab-count" title="{tabs.length} tab{tabs.length === 1 ? '' : 's'}">
              {tabs.length}
            </span>
          {/if}
        </div>

        {#if isExpanded && hasTabs}
          <div class="tabs-container">
            {#each tabs as tab}
              <MatrixRow
                flag={tab}
                indent
                parentRole={module.minimumRole}
                saving={savingFlags.has(tab.id)}
                toggleLocked={tab.id === "tab:admin:flags"}
                toggleLockedReason="Cannot disable Feature Flags tab while using it"
                onRoleClick={(role) => handleRoleClick(tab, role)}
                onToggle={() => handleEnabledToggle(tab)}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    <!-- Capabilities section -->
    {#if filteredCapabilities().length > 0}
      <div class="section-divider">
        <span><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Capabilities</span>
      </div>
      {#each filteredCapabilities() as capability}
        <MatrixRow
          flag={capability}
          saving={savingFlags.has(capability.id)}
          onRoleClick={(role) => handleRoleClick(capability, role)}
          onToggle={() => handleEnabledToggle(capability)}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .permission-matrix {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .matrix-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  @media (min-width: 600px) {
    .matrix-header {
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px 24px;
    }
  }

  .header-content h3 {
    margin: 0 0 4px 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .header-content p {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .header-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  @media (min-width: 500px) {
    .header-actions {
      flex-direction: row;
      align-items: center;
    }
  }

  .expand-controls {
    display: flex;
    gap: 6px;
  }

  .expand-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .expand-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .expand-btn i {
    font-size: 11px;
  }

  .search-box {
    min-width: 240px;
  }

  .matrix-container {
    flex: 1;
    overflow: auto;
    padding: 12px;

    /* Styled scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .matrix-container::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .matrix-container::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }

  .matrix-container::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .matrix-container::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
    background-clip: padding-box;
  }

  @media (min-width: 600px) {
    .matrix-container {
      padding: 16px 24px;
    }
  }

  .matrix-row {
    display: grid;
    grid-template-columns: 1fr repeat(4, 60px) 56px;
    gap: 4px;
    align-items: center;
    min-height: 44px;
  }

  @media (min-width: 700px) {
    .matrix-row {
      grid-template-columns: 1fr repeat(4, 80px) 64px;
      gap: 8px;
    }
  }

  .matrix-row.header-row {
    position: sticky;
    top: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    z-index: 10;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding-bottom: 8px;
    margin-bottom: 8px;
  }

  .header-cell {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
    padding: 8px 4px;
  }

  .header-cell.feature-cell {
    text-align: left;
  }

  .role-cell.header-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    color: var(--role-color);
  }

  .role-cell.header-cell i {
    font-size: var(--font-size-sm, 14px);
  }

  .role-cell.header-cell span {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  @media (max-width: 500px) {
    .role-cell.header-cell span {
      display: none;
    }
  }

  .section-divider {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 0 8px;
    margin-top: 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .section-divider span {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: #f59e0b;
  }

  /* Collapsible module groups */
  .module-group {
    border-radius: 10px;
    margin-bottom: 4px;
    overflow: hidden;
    border-left: 3px solid var(--module-color, var(--theme-stroke));
    background: color-mix(in srgb, var(--module-color) 3%, transparent);
  }

  .module-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0 2px 4px;
    transition: background var(--duration-fast) ease;
  }

  .module-header:hover {
    background: color-mix(in srgb, var(--module-color) 6%, transparent);
  }

  .module-header.expanded {
    border-bottom: 1px solid color-mix(in srgb, var(--module-color) 15%, transparent);
  }

  .expand-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--module-color, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .expand-toggle:hover {
    background: color-mix(in srgb, var(--module-color) 15%, transparent);
  }

  .expand-toggle i {
    font-size: 11px;
    transition: transform var(--duration-normal) ease;
  }

  .expand-toggle i.rotated {
    transform: rotate(90deg);
  }

  .expand-placeholder {
    width: 28px;
    flex-shrink: 0;
  }

  .module-row-content {
    flex: 1;
    min-width: 0;
  }

  .tab-count {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 20px;
    padding: 0 6px;
    margin-right: 8px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--module-color) 20%, transparent);
    color: var(--module-color);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    flex-shrink: 0;
  }

  .tabs-container {
    padding: 4px 0 8px 32px;
    background: color-mix(in srgb, var(--module-color) 2%, transparent);
    animation: slideDown var(--duration-fast) ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .tabs-container {
      animation: none;
    }
  }
</style>
