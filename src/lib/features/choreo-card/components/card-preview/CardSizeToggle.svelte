<script lang="ts">
  import { CARD_SIZES, type CardSizeId } from "../../domain/card-sizes";

  interface Props {
    selected: CardSizeId;
    onchange: (size: CardSizeId) => void;
  }

  let { selected, onchange }: Props = $props();

  const sizes = Object.entries(CARD_SIZES) as [CardSizeId, (typeof CARD_SIZES)[CardSizeId]][];
</script>

<div class="size-toggle" role="radiogroup" aria-label="Card size">
  {#each sizes as [id, size]}
    <button
      class="size-option"
      class:active={selected === id}
      role="radio"
      aria-checked={selected === id}
      onclick={() => onchange(id)}
    >
      {size.label}
    </button>
  {/each}
</div>

<style>
  .size-toggle {
    display: flex;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    overflow: hidden;
  }

  .size-option {
    padding: 6px 14px;
    font-size: var(--font-size-compact, 12px);
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .size-option:not(:last-child) {
    border-right: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .size-option.active {
    background: var(--theme-accent, #4a9eff);
    color: #fff;
  }

  .size-option:hover:not(.active) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }
</style>
