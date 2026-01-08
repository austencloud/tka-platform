<!--
NavigationSidebar - Advanced Browse Navigation

Provides sophisticated navigation sections matching desktop functionality:
- Favorites section with quick access
- Date-based navigation (Recently Added)
- Length-based grouping
- Letter-based organization
- Difficulty level sections
- Author groupings

Follows Svelte 5 runes + microservices architecture.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type {
    ExploreNavigationConfig,
    ExploreNavigationItem,
  } from "../domain/models/navigation-models";
  import type { IHapticFeedback } from "../../../../../shared/application/services/contracts/IHapticFeedback";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    sections = [],
    onSectionToggle = () => {},
    onItemClick = () => {},
    isCollapsed = false,
    onToggleCollapse: _onToggleCollapse = () => {},
  } = $props<{
    sections?: ExploreNavigationConfig[];
    onSectionToggle?: (sectionId: string) => void;
    onItemClick?: (sectionId: string, itemId: string) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
  }>();

  // Services
  let hapticService: IHapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Handle section header click
  function handleSectionClick(section: ExploreNavigationConfig) {
    hapticService?.trigger("selection");
    onSectionToggle(section.id);
  }

  // Handle navigation item click
  function handleItemClick(
    section: ExploreNavigationConfig,
    item: ExploreNavigationItem
  ) {
    hapticService?.trigger("selection");
    onItemClick(section.id, item.id);
  }

  // Note: Section titles already include emojis from Navigator
  // No need for additional icon function

  // Format item count for display
  function formatCount(count: number): string {
    if (count === 0) return "";
    if (count === 1) return "(1)";
    return `(${count})`;
  }
</script>

<div class="navigation-sidebar" class:collapsed={isCollapsed}>
  <!-- Navigation Sections -->
  {#if !isCollapsed}
    <div class="navigation-sections">
      {#each sections as section (section.id)}
        <div
          class="navigation-section"
          class:has-items={section.items.length > 0}
        >
          <!-- Section Header -->
          <button
            class="section-header"
            class:expanded={section.isExpanded}
            onclick={() => handleSectionClick(section)}
            disabled={section.items.length === 0}
          >
            <div class="section-header-content">
              <span class="section-title">{section.title}</span>
              <span class="section-count"
                >{formatCount(section.totalCount)}</span
              >
            </div>

            {#if section.items.length > 0}
              <div
                class="section-expand-icon"
                class:rotated={section.isExpanded}
              >
                ▶
              </div>
            {/if}
          </button>

          <!-- Section Items -->
          {#if section.isExpanded && section.items.length > 0}
            <div class="section-items" transition:slide={{ duration: 200 }}>
              {#if section.type === "letter"}
                <!-- Special grid layout for letters -->
                <div class="letter-grid">
                  {#each section.items as item (item.id)}
                    <button
                      class="letter-item"
                      class:active={item.isActive}
                      onclick={() => handleItemClick(section, item)}
                      title="{item.label} ({item.count} sequences)"
                    >
                      <span class="letter-label">{item.label}</span>
                      <span class="letter-count">{item.count}</span>
                    </button>
                  {/each}
                </div>
              {:else}
                <!-- Standard vertical layout for other sections -->
                {#each section.items as item (item.id)}
                  <button
                    class="navigation-item"
                    class:active={item.isActive}
                    onclick={() => handleItemClick(section, item)}
                  >
                    <span class="item-label">{item.label}</span>
                    <span class="item-count">{formatCount(item.count)}</span>
                  </button>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Footer Stats -->
    {#if sections.length > 0}
      {@const totalSequences = sections.reduce(
        (sum: number, section: ExploreNavigationConfig) =>
          sum + section.totalCount,
        0
      )}
      {@const expandedCount = sections.filter(
        (s: ExploreNavigationConfig) => s.isExpanded
      ).length}
      <div class="sidebar-footer">
        <div class="footer-stats">
          <div class="stat-item">
            <span class="stat-label">Total Sequences:</span>
            <span class="stat-value">{totalSequences}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Sections:</span>
            <span class="stat-value">{expandedCount}/{sections.length}</span>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .navigation-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: rgba(255, 255, 255, 0.02);
    border-right: var(--glass-border);
    backdrop-filter: blur(10px);
    overflow: hidden;
    transition: width var(--transition-normal);
  }

  .navigation-sidebar.collapsed {
    width: 60px;
  }

  /* Navigation Sections */
  .navigation-sections {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-sm) 0;
  }

  .navigation-section {
    margin-bottom: var(--spacing-xs);
  }

  .navigation-section:not(.has-items) {
    opacity: 0.5;
  }

  /* Section Header */
  .section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    background: none;
    border: none;
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .section-header:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .section-header:disabled {
    cursor: default;
  }

  .section-header.expanded {
    background: var(--theme-card-bg);
  }

  .section-header-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: 1;
  }

  .section-title {
    flex: 1;
  }

  .section-count {
    font-size: var(--font-size-xs);
    color: var(--theme-text-dim);
    font-weight: 400;
  }

  .section-expand-icon {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    transform: rotate(0deg);
    transition: transform var(--transition-fast);
  }

  .section-expand-icon.rotated {
    transform: rotate(90deg);
  }

  /* Section Items */
  .section-items {
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid var(--theme-stroke);
  }

  .navigation-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-xs) var(--spacing-lg);
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .navigation-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }

  .navigation-item.active {
    background: rgba(var(--primary-color-rgb), 0.2);
    color: var(--primary-color);
    border-left: 2px solid var(--primary-color);
  }

  .item-label {
    flex: 1;
  }

  .item-count {
    font-size: var(--font-size-xs);
    color: var(--theme-text-dim);
    font-weight: 400;
  }

  .navigation-item.active .item-count {
    color: rgba(var(--primary-color-rgb), 0.8);
  }

  /* Letter Grid Layout */
  .letter-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
  }

  .letter-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xs);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
    min-height: var(--min-touch-target);
    aspect-ratio: 1;
  }

  .letter-item:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .letter-item.active {
    background: rgba(var(--primary-color-rgb), 0.2);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  .letter-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    line-height: 1;
  }

  .letter-count {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    font-weight: 400;
    margin-top: 2px;
  }

  .letter-item.active .letter-count {
    color: rgba(var(--primary-color-rgb), 0.8);
  }

  /* Footer */
  .sidebar-footer {
    flex-shrink: 0;
    padding: var(--spacing-md);
    border-top: var(--glass-border);
    background: rgba(0, 0, 0, 0.2);
  }

  .footer-stats {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-xs);
  }

  .stat-label {
    color: var(--theme-text-dim);
  }

  .stat-value {
    color: white;
    font-weight: 500;
  }

  /* Custom scrollbar */
  .navigation-sections::-webkit-scrollbar {
    width: 6px;
  }

  .navigation-sections::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }

  .navigation-sections::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .navigation-sections::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .navigation-sidebar {
      display: none;
    }
  }
</style>
