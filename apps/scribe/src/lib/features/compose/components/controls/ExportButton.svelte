<!--
  ExportButton.svelte

  Reusable export button component with consistent styling.
  Supports customizable label and icon.
-->
<script lang="ts">
  let {
    label = "Export",
    icon = "fa-download",
    onclick,
    ariaLabel,
  }: {
    label?: string;
    icon?: string;
    onclick?: () => void;
    ariaLabel?: string;
  } = $props();

  const computedAriaLabel = $derived(ariaLabel ?? label);
</script>

<button class="export-btn" {onclick} aria-label={computedAriaLabel}>
  <i class="fas {icon}" aria-hidden="true"></i>
  <span class="export-label">{label}</span>
</button>

<style>
  .export-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.9) 0%,
      rgba(5, 150, 105, 0.9) 100%
    );
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
    -webkit-tap-highlight-color: transparent;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    user-select: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .export-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      background: linear-gradient(
        135deg,
        rgba(16, 185, 129, 1) 0%,
        rgba(5, 150, 105, 1) 100%
      );
    }
  }

  .export-btn:active {
    transform: scale(0.98);
  }

  /* Responsive: hide label on small screens */
  @media (max-width: 480px) {
    .export-label {
      display: none;
    }

    .export-btn {
      padding: 10px 12px;
    }
  }

  .export-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .export-btn {
      transition: none;
    }

    .export-btn:hover {
      transform: none;
    }
  }
</style>
