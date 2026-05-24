<script lang="ts" module>
  import type { UserNotification } from "$lib/shared/notifications/domain/models/notification-models";

  export interface FilterState {
    readStatus: "all" | "unread" | "read";
    type: UserNotification["type"] | "all";
    searchQuery: string;
  }
</script>

<script lang="ts">
  /**
   * NotificationFilter - Modern chip-based filter controls
   */

  import { slide } from "svelte/transition";
  // Note: UserNotification type is imported in the module script above

  interface Props {
    onFilterChange: (filters: FilterState) => void;
  }

  let { onFilterChange }: Props = $props();

  let filters = $state<FilterState>({
    readStatus: "all", // Always "all" now - no read/unread filtering
    type: "all",
    searchQuery: "",
  });

  let isTypeSheetOpen = $state(false);
  let showTypeFilters = $state(false);

  // Notify parent when filters change
  $effect(() => {
    onFilterChange(filters);
  });

  const notificationTypes: Array<{
    value: UserNotification["type"] | "all";
    label: string;
  }> = [
    { value: "all", label: "All Types" },
    { value: "feedback-resolved", label: "Resolved" },
    { value: "feedback-in-progress", label: "In Progress" },
    { value: "feedback-needs-info", label: "Needs Info" },
    { value: "feedback-response", label: "Response" },
    { value: "sequence-liked", label: "Likes" },
    { value: "user-followed", label: "Follows" },
    { value: "achievement-unlocked", label: "Achievements" },
    { value: "message-received", label: "Messages" },
    { value: "system-announcement", label: "Announcements" },
  ];

  function getTypeLabel(value: UserNotification["type"] | "all"): string {
    return (
      notificationTypes.find((t) => t.value === value)?.label || "All Types"
    );
  }
</script>

<div class="notification-filter">
  <!-- Search input -->
  <div class="search-box">
    <i class="fas fa-search" aria-hidden="true"></i>
    <input
      type="text"
      placeholder="Search notifications..."
      bind:value={filters.searchQuery}
      aria-label="Search notifications"
    />
    {#if filters.searchQuery}
      <button
        class="clear-search"
        onclick={() => (filters.searchQuery = "")}
        aria-label="Clear search"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Optional type filter toggle (only shows if filter is active or explicitly opened) -->
  {#if filters.type !== "all" || showTypeFilters}
    <div class="filter-header">
      <button
        class="filter-toggle-btn"
        class:active={showTypeFilters}
        onclick={() => (showTypeFilters = !showTypeFilters)}
        aria-label="Toggle type filters"
        title={showTypeFilters ? "Hide filters" : "Filter by type"}
      >
        <i class="fas fa-filter" aria-hidden="true"></i>
        <span>Filter by type</span>
        {#if filters.type !== "all"}
          <span class="active-filter-badge"></span>
        {/if}
      </button>
    </div>
  {/if}

  <!-- Collapsible type filters -->
  {#if showTypeFilters}
    <div class="type-filter" transition:slide={{ duration: 200 }}>
      <!-- Desktop: Scrollable chip row -->
      <div
        class="chip-scroll desktop-only themed-scrollbar"
        role="group"
        aria-label="Filter by notification type"
      >
        {#each notificationTypes as type}
          <button
            class="chip type-chip"
            class:active={filters.type === type.value}
            onclick={() => (filters.type = type.value)}
            aria-pressed={filters.type === type.value}
          >
            {type.label}
          </button>
        {/each}
      </div>

      <!-- Mobile: Button to open type selector sheet -->
      <button
        class="type-selector-btn mobile-only"
        onclick={() => (isTypeSheetOpen = true)}
        aria-label="Select notification type"
      >
        <i class="fas fa-filter" aria-hidden="true"></i>
        <span>{getTypeLabel(filters.type)}</span>
        <i class="fas fa-chevron-down" aria-hidden="true"></i>
      </button>
    </div>
  {/if}
</div>

<!-- Mobile type selector sheet -->
{#if isTypeSheetOpen}
  <div
    class="sheet-overlay"
    onclick={() => (isTypeSheetOpen = false)}
    onkeydown={(e) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        isTypeSheetOpen = false;
      }
    }}
    role="button"
    tabindex="0"
    aria-label="Close notification type selector"
  >
    <div
      class="sheet"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Select notification type"
      tabindex="-1"
    >
      <div class="sheet-header">
        <h3>Notification Type</h3>
        <button
          class="close-btn"
          onclick={() => (isTypeSheetOpen = false)}
          aria-label="Close"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
      <div class="sheet-content">
        {#each notificationTypes as type}
          <button
            class="type-option"
            class:active={filters.type === type.value}
            onclick={() => {
              filters.type = type.value;
              isTypeSheetOpen = false;
            }}
          >
            {type.label}
            {#if filters.type === type.value}
              <i class="fas fa-check" aria-hidden="true"></i>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .notification-filter {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-box i.fa-search {
    position: absolute;
    left: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-sm);
    pointer-events: none;
  }

  .search-box input {
    flex: 1;
    padding: 10px 12px 10px 36px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-min);
    transition: all var(--duration-normal) ease;
  }

  .search-box input::placeholder {
    color: var(--theme-text-dim);
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--theme-accent, var(--semantic-info));
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .clear-search {
    position: absolute;
    right: 8px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .clear-search:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  /* Filter header */
  .filter-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 20px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-min);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
  }

  .chip:hover:not(.active) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke);
    color: var(--theme-text);
  }

  .chip.active {
    background: var(--theme-accent, var(--semantic-info));
    border-color: var(--theme-accent, var(--semantic-info));
    color: white;
  }

  .chip:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  /* Filter toggle button */
  .filter-toggle-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-min);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .filter-toggle-btn:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .filter-toggle-btn.active {
    background: var(--theme-card-bg);
    color: var(--theme-accent, var(--semantic-info));
  }

  .filter-toggle-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .filter-toggle-btn i:first-child {
    font-size: var(--font-size-compact);
  }

  /* Active filter indicator badge */
  .active-filter-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 8px;
    height: 8px;
    background: var(--semantic-info, var(--semantic-info));
    border: 2px solid var(--theme-panel-bg);
    border-radius: 50%;
  }

  /* Type filter container */
  .type-filter {
    position: relative;
  }

  /* Desktop: Scrollable chip row */
  .chip-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
  }

  .type-chip {
    flex-shrink: 0;
  }

  /* Mobile: Type selector button */
  .type-selector-btn {
    display: none;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-min);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .type-selector-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke);
  }

  .type-selector-btn:focus-visible {
    outline: none;
    border-color: var(--theme-accent, var(--semantic-info));
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .type-selector-btn span {
    flex: 1;
    text-align: left;
    margin: 0 8px;
  }

  /* Sheet overlay */
  .sheet-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: var(--z-modal);
    animation: fadeIn var(--duration-normal) ease;
  }

  .sheet {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 70vh;
    background: var(--theme-panel-bg);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 24px var(--theme-shadow);
    animation: slideUp var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .sheet-header h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .close-btn {
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .sheet-content {
    overflow-y: auto;
    max-height: calc(70vh - 64px);
    padding: 8px;
  }

  .type-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-min);
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .type-option:hover {
    background: var(--theme-card-bg);
  }

  .type-option.active {
    background: var(--theme-card-bg, var(--theme-card-bg));
    color: var(--theme-accent, var(--semantic-info));
    font-weight: 500;
  }

  .type-option i.fa-check {
    color: var(--theme-accent, var(--semantic-info));
  }

  /* Responsive */
  @media (max-width: 768px) {
    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex !important;
    }
  }

  @media (min-width: 769px) {
    .desktop-only {
      display: flex !important;
    }

    .mobile-only {
      display: none !important;
    }
  }

  /* Animations */
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .search-box input,
    .clear-search,
    .chip,
    .filter-toggle-btn,
    .type-filter,
    .type-selector-btn,
    .close-btn,
    .type-option,
    .sheet-overlay,
    .sheet {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
