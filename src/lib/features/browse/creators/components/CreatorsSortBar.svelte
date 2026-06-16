<script lang="ts">
  /**
   * CreatorsSortBar - Sort controls for creators
   *
   * Simple dropdown-style sort selector matching the existing panel UI.
   */

  import type { CreatorSortCriteria } from "$lib/shared/community/domain/models/enhanced-user-profile";

  interface Props {
    sortBy: CreatorSortCriteria;
    onSortChange: (sortBy: CreatorSortCriteria) => void;
  }

  let { sortBy, onSortChange }: Props = $props();

  let isOpen = $state(false);

  interface SortOption {
    value: CreatorSortCriteria;
    label: string;
    icon: string;
  }

  const sortOptions: SortOption[] = [
    { value: "lastActive", label: "Recently Active", icon: "fa-clock" },
    { value: "joinedDate", label: "Recently Joined", icon: "fa-calendar" },
    { value: "favoriteProp", label: "Group by prop", icon: "fa-layer-group" },
  ];

  // Get current option (always defined since we have a default)
  const currentOption = $derived(
    sortOptions.find((o) => o.value === sortBy) ?? sortOptions[0]!
  );

  function handleSelect(value: CreatorSortCriteria) {
    onSortChange(value);
    isOpen = false;
  }

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function handlePointerDownOutside(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".sort-bar")) {
      isOpen = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      isOpen = false;
    }
  }
</script>

<svelte:window onpointerdown={handlePointerDownOutside} onkeydown={handleKeyDown} />

<div class="sort-bar">
  <button
    class="sort-trigger"
    class:open={isOpen}
    onclick={toggleDropdown}
    aria-expanded={isOpen}
    aria-haspopup="menu"
    aria-label="Sort creators"
  >
    <i class="fas fa-sort" aria-hidden="true"></i>
    <span class="sort-label">Sort:</span>
    <span class="sort-value">{currentOption.label}</span>
    <i class="fas fa-chevron-down chevron" class:rotated={isOpen} aria-hidden="true"></i>
  </button>

  {#if isOpen}
    <div class="sort-dropdown" role="menu">
      {#each sortOptions as option}
        <div
          class="sort-option"
          class:selected={sortBy === option.value}
          onclick={() => handleSelect(option.value)}
          onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(option.value); } }}
          role="menuitem"
          tabindex="0"
        >
          <i class="fas {option.icon}" aria-hidden="true"></i>
          <span>{option.label}</span>
          {#if sortBy === option.value}
            <i class="fas fa-check check-icon" aria-hidden="true"></i>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sort-bar {
    position: relative;
    display: flex;
    flex-shrink: 0;
  }

  .sort-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
  }

  .sort-trigger:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .sort-trigger.open {
    border-color: var(--theme-accent, #6366f1);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .sort-trigger i:first-child {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .sort-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .sort-value {
    font-weight: 500;
  }

  .chevron {
    font-size: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    transition: transform var(--duration-normal, 200ms) ease;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .sort-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 200px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 8px;
    z-index: 100;
    box-shadow: var(--shadow-elevated, 0 8px 32px rgba(0, 0, 0, 0.3));
  }

  .sort-option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: transparent;
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
    text-align: left;
  }

  .sort-option:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .sort-option.selected {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    color: var(--theme-accent, #6366f1);
  }

  .sort-option i:first-child {
    width: 16px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .sort-option.selected i:first-child {
    color: var(--theme-accent, #6366f1);
  }

  .sort-option span {
    flex: 1;
  }

  .check-icon {
    color: var(--theme-accent, #6366f1);
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .sort-bar {
      width: 100%;
    }

    .sort-trigger {
      width: 100%;
      justify-content: center;
    }

    .sort-dropdown {
      left: 0;
      right: 0;
      min-width: unset;
    }
  }
</style>
