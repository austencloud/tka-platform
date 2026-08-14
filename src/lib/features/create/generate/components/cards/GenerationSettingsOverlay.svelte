<script lang="ts">
  import "../customize-accent.css";
  import type { Snippet } from "svelte";
  import { quintOut } from "svelte/easing";
  import { scale } from "svelte/transition";

  let {
    title,
    titleId,
    closeLabel,
    onClose,
    actions,
    children,
  }: {
    title: string;
    titleId?: string;
    closeLabel: string;
    onClose: () => void;
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div
  class="generation-settings-overlay customize-accent-scope"
  transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
>
  <div class="overlay-header">
    <h3 class="overlay-title" id={titleId}>{title}</h3>
    {#if actions}
      {@render actions()}
    {/if}
    <button class="close-button" onclick={onClose} aria-label={closeLabel}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>

  {@render children()}
</div>

<style>
  .generation-settings-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    overflow: hidden;
    background: var(--customize-surface-gradient);
    border: 2px solid
      color-mix(in srgb, var(--customize-accent) 40%, transparent);
    border-radius: 16px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 24px color-mix(in srgb, var(--customize-accent) 20%, transparent);
  }

  .overlay-header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 8px;
    margin-bottom: 4px;
  }

  .overlay-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    color: var(--theme-text, white);
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 8px;
    color: var(--theme-text, white);
    cursor: pointer;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    transition:
      background var(--duration-normal) ease,
      border-color var(--duration-normal) ease;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-button {
      transition: none;
    }
  }
</style>
