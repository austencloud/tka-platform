<!-- FilterButton - Reusable filter button with optional badge -->
<script lang="ts">
  interface Props {
    label: string;
    icon?: string;
    badgeCount?: number;
    onClick: () => void;
    isActive?: boolean;
    isPanel?: boolean;
  }

  const {
    label,
    icon,
    badgeCount,
    onClick,
    isActive = false,
    isPanel = false,
  }: Props = $props();
</script>

<button
  type="button"
  class="filter-button"
  class:active={isActive}
  class:panel={isPanel}
  onclick={onClick}
  aria-expanded={isActive}
  aria-controls="filter-panel-content"
>
  {#if icon}
    <i class="fas {icon}" aria-hidden="true"></i>
  {/if}
  <span>{label}</span>
  {#if isPanel}
    <i class="fas fa-chevron-right panel-arrow" aria-hidden="true"></i>
  {/if}
  {#if badgeCount !== undefined && badgeCount > 0}
    <span class="filter-count">{badgeCount}</span>
  {/if}
</button>

<style>
  .filter-button {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--min-touch-target);
    padding: 0 21px;
    background: transparent;
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 999px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  .filter-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .filter-button:active {
    transform: scale(0.98);
  }

  .filter-button.active {
    background: color-mix(
      in srgb,
      var(--semantic-success, var(--semantic-success)) 15%,
      transparent
    );
    border-color: var(--semantic-success, var(--semantic-success));
    color: var(--theme-text);
  }

  .filter-button.active i:not(.panel-arrow) {
    color: var(--semantic-success, var(--semantic-success));
  }

  .filter-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .filter-button i {
    font-size: 0.85em;
  }

  .filter-button.panel .panel-arrow {
    font-size: 0.7em;
    margin-left: 6px;
    color: color-mix(
      in srgb,
      var(--theme-text-dim, var(--theme-text-dim)) 80%,
      transparent
    );
    transition: transform var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .filter-button.panel:hover .panel-arrow {
    transform: translateX(2px);
  }

  .filter-count {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    background: var(--semantic-success, var(--semantic-success));
    border-radius: 999px;
    color: white;
    font-size: var(--font-size-compact);
    font-weight: 700;
    animation: popIn var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes popIn {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .filter-count {
      animation: none;
    }
  }
</style>
