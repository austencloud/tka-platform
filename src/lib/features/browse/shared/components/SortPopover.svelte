<!--
  SortPopover - Compact sort chip with spring-animated popover

  Shows current sort method as a single chip. Tap opens a popover
  with all sort options, check mark on selected. Dismisses on
  click-outside, Escape, or selection. Spring animation with overshoot.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { BrowseSortMethod } from "../domain/enums/browse-enums";

  interface SortOption {
    id: BrowseSortMethod;
    label: string;
    icon: string;
  }

  interface Props {
    currentMethod: BrowseSortMethod;
    onSortChange: (method: BrowseSortMethod) => void;
  }

  let { currentMethod, onSortChange }: Props = $props();

  const sortOptions: SortOption[] = [
    { id: BrowseSortMethod.ALPHABETICAL, label: "Alphabetical", icon: "fa-font" },
    { id: BrowseSortMethod.DATE_ADDED, label: "Newest first", icon: "fa-clock" },
    { id: BrowseSortMethod.DIFFICULTY_LEVEL, label: "Difficulty", icon: "fa-signal" },
    { id: BrowseSortMethod.SEQUENCE_LENGTH, label: "Length", icon: "fa-ruler" },
  ];

  // Short labels for the chip display
  const chipLabels: Record<string, string> = {
    [BrowseSortMethod.ALPHABETICAL]: "A-Z",
    [BrowseSortMethod.DATE_ADDED]: "New",
    [BrowseSortMethod.DIFFICULTY_LEVEL]: "Level",
    [BrowseSortMethod.SEQUENCE_LENGTH]: "Length",
  };

  let isOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let popoverEl: HTMLDivElement | null = $state(null);

  // Animation state: controls spring entrance/exit
  let isAnimating = $state(false);
  let isVisible = $state(false);

  const currentIcon = $derived(
    sortOptions.find((o) => o.id === currentMethod)?.icon ?? "fa-sort"
  );
  const currentLabel = $derived(chipLabels[currentMethod] ?? "Sort");

  function openPopover() {
    isOpen = true;
    // Trigger entrance animation after DOM paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isAnimating = true;
        isVisible = true;
      });
    });
  }

  function closePopover() {
    isVisible = false;
    // Wait for exit animation before removing from DOM
    setTimeout(() => {
      isOpen = false;
      isAnimating = false;
    }, 180);
  }

  function handleToggle() {
    if (isOpen) {
      closePopover();
    } else {
      openPopover();
    }
  }

  function handleSelect(method: BrowseSortMethod) {
    onSortChange(method);
    closePopover();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      closePopover();
      triggerEl?.focus();
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (!isOpen) return;
    const target = event.target as Node;
    if (triggerEl?.contains(target) || popoverEl?.contains(target)) return;
    closePopover();
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside, true);
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside, true);
  });
</script>

<div class="sort-popover-container">
  <!-- Trigger chip -->
  <button
    class="sort-trigger"
    class:open={isOpen}
    bind:this={triggerEl}
    onclick={handleToggle}
    onkeydown={handleKeydown}
    type="button"
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    aria-label="Sort by {currentLabel}"
  >
    <i class="fas fa-arrow-down-short-wide sort-icon" aria-hidden="true"></i>
    <span class="trigger-label">{currentLabel}</span>
    <i
      class="fas fa-chevron-down chevron"
      class:rotated={isOpen}
      aria-hidden="true"
    ></i>
  </button>

  <!-- Popover -->
  {#if isOpen}
    <div
      class="sort-popover"
      class:visible={isVisible}
      bind:this={popoverEl}
      role="listbox"
      aria-label="Sort options"
    >
      {#each sortOptions as option, i}
        <button
          class="sort-option"
          class:selected={currentMethod === option.id}
          onclick={() => handleSelect(option.id)}
          role="option"
          aria-selected={currentMethod === option.id}
          style="transition-delay: {isVisible ? i * 30 : 0}ms"
        >
          <i class="fas {option.icon} option-icon" aria-hidden="true"></i>
          <span class="option-label">{option.label}</span>
          {#if currentMethod === option.id}
            <i class="fas fa-check check-icon" aria-hidden="true"></i>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sort-popover-container {
    position: relative;
  }

  /* Trigger chip */
  .sort-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    min-height: var(--min-touch-target, 48px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .sort-trigger:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong);
  }

  .sort-trigger:active {
    transform: scale(0.97);
  }

  .sort-trigger.open {
    background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card-bg));
    border-color: var(--theme-accent);
    color: var(--theme-text);
  }

  .sort-trigger:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .sort-icon {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .trigger-label {
    font-weight: 600;
  }

  .chevron {
    font-size: 10px;
    opacity: 0.5;
    transition: transform var(--duration-normal, 200ms) cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  /* Popover panel */
  .sort-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 180px;
    padding: 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 50;

    /* Entrance animation: scale + opacity with overshoot */
    opacity: 0;
    transform: scale(0.92) translateY(-4px);
    transform-origin: top left;
    transition:
      opacity 180ms ease,
      transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .sort-popover.visible {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  /* Individual options */
  .sort-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 0 14px;
    min-height: 44px;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    text-align: left;

    /* Stagger entrance */
    opacity: 0;
    transform: translateY(-4px);
  }

  .sort-popover.visible .sort-option {
    opacity: 1;
    transform: translateY(0);
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease,
      opacity 150ms ease;
  }

  .sort-option:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    color: var(--theme-text);
  }

  .sort-option:active {
    transform: scale(0.98);
  }

  .sort-option.selected {
    color: var(--theme-accent);
  }

  .sort-option:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: -2px;
  }

  .option-icon {
    width: 16px;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .sort-option.selected .option-icon {
    opacity: 1;
  }

  .option-label {
    flex: 1;
  }

  .check-icon {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-accent);
    animation: checkPop 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes checkPop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    60% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .sort-popover,
    .sort-option,
    .chevron,
    .sort-trigger,
    .check-icon {
      transition: none !important;
      animation: none !important;
    }

    .sort-popover {
      transform: none;
    }

    .sort-popover .sort-option {
      opacity: 1;
      transform: none;
    }
  }
</style>
