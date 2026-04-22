<script lang="ts">
  import type { StickerUnit } from "../domain/sticker-types";
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { MAX_COPIES_PER_STICKER } from "../domain/sticker-constants";

  interface Props {
    sticker: StickerUnit;
  }
  let { sticker }: Props = $props();

  const state = getStickerLabContext();

  const variants = ["blue", "red", "full"] as const;
  const backgrounds = [
    { id: "transparent", label: "Clear" },
    { id: "white", label: "White" },
    { id: "radial-gradient", label: "Soft" },
  ] as const;

  function bump(delta: number) {
    state.setCopies(sticker.id, sticker.copies + delta);
  }
</script>

<article class="item" data-sticker-id={sticker.id}>
  <div class="row-primary">
    <span class="word">{sticker.primitiveRef.displayName ?? sticker.primitiveRef.shapeHash.slice(0, 8)}</span>
    <button class="remove" aria-label="Remove sticker" onclick={() => state.removeSticker(sticker.id)}>×</button>
  </div>

  <div class="row-variant" role="radiogroup" aria-label="Variant">
    {#each variants as v}
      <button
        type="button"
        role="radio"
        aria-checked={sticker.variant === v}
        class:active={sticker.variant === v}
        onclick={() => state.setVariant(sticker.id, v)}
      >
        {v}
      </button>
    {/each}
  </div>

  <div class="row-background" role="radiogroup" aria-label="Background">
    {#each backgrounds as b}
      <button
        type="button"
        role="radio"
        aria-checked={sticker.background === b.id}
        class:active={sticker.background === b.id}
        onclick={() => state.setBackground(sticker.id, b.id)}
      >
        {b.label}
      </button>
    {/each}
  </div>

  <div class="row-copies">
    <span>Copies</span>
    <button aria-label="Decrease copies" onclick={() => bump(-1)} disabled={sticker.copies <= 1}>−</button>
    <span class="count">{sticker.copies}</span>
    <button aria-label="Increase copies" onclick={() => bump(1)} disabled={sticker.copies >= MAX_COPIES_PER_STICKER}>+</button>
  </div>
</article>

<style>
  .item {
    display: grid;
    gap: 6px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 12px;
    color: var(--theme-text, white);
  }
  .row-primary {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .word { font-weight: 600; flex: 1; }
  .remove {
    background: none;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
  }
  .remove:hover { color: var(--semantic-error, #ef4444); }

  .row-variant, .row-background {
    display: flex;
    gap: 4px;
  }
  .row-variant button, .row-background button {
    flex: 1;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    text-transform: capitalize;
  }
  .row-variant button.active, .row-background button.active {
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border-color: var(--theme-accent, #8b5cf6);
  }

  .row-copies {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .row-copies button {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text, white);
    border: none;
    cursor: pointer;
  }
  .row-copies button:disabled { opacity: 0.3; cursor: not-allowed; }
  .row-copies .count { min-width: 24px; text-align: center; font-weight: 600; }
</style>
