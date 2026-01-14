<script lang="ts">
  /**
   * PermissionMatrix
   * Matrix view showing Features x Roles with inline editing
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
    <div class="search-box">
      <AdminSearchBox
        value={searchQuery}
        placeholder="Filter features..."
        oninput={(e) => (searchQuery = (e.target as HTMLInputElement).value)}
      />
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
      <MatrixRow
        flag={module}
        saving={savingFlags.has(module.id)}
        toggleLocked={module.id === "module:admin"}
        toggleLockedReason="Cannot disable admin module while using it"
        onRoleClick={(role) => handleRoleClick(module, role)}
        onToggle={() => handleEnabledToggle(module)}
      />

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
</style>
