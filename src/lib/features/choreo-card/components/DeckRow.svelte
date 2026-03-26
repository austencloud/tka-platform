<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import {
    DIFFICULTY_LEVELS,
    DEFAULT_DIFFICULTY_STYLE,
  } from "$lib/shared/config/difficulty-styles";

  interface Props {
    deck: Deck;
    accentColor: string;
    accentIcon: string;
    onSelect: (deckId: string) => void;
  }

  const { deck, accentColor, accentIcon, onSelect }: Props = $props();

  const levelStyle = $derived(
    DIFFICULTY_LEVELS[deck.level] ?? DEFAULT_DIFFICULTY_STYLE,
  );

  function formatCount(n: number): string {
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return String(n);
  }
</script>

<button
  type="button"
  class="deck-row"
  aria-label="Open {deck.name} deck"
  onclick={() => onSelect(deck.id)}
>
  <span class="left">
    <i
      class="fas fa-{accentIcon} accent-icon"
      style="color: {accentColor};"
      aria-hidden="true"
    ></i>
    <span class="deck-name">{deck.name}</span>
  </span>

  <span class="meta">
    <span
      class="level-badge"
      style="background: {levelStyle.cssBg}; border-color: {levelStyle.border}; color: {levelStyle.text};"
    >
      {deck.level}
    </span>
    <span class="chip">{deck.gridMode}</span>
    <span class="chip">{deck.families.length} families</span>
  </span>

  <span class="count" aria-label="{deck.totalSequences} sequences">
    {formatCount(deck.totalSequences)}
  </span>
</button>

<style>
  .deck-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    cursor: pointer;
    text-align: left;
    transition: border-color 150ms ease;
    color: var(--theme-text, #fff);
  }

  .deck-row:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .deck-row:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  /* Left: icon + name */
  .left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .accent-icon {
    flex-shrink: 0;
    font-size: var(--font-size-sm, 14px);
  }

  .deck-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Center: badges + chips */
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    line-height: 1.4;
    white-space: nowrap;
  }

  .level-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid;
    font-family: Cambria, serif;
    font-weight: bold;
    font-size: var(--font-size-min, 14px);
    flex-shrink: 0;
  }

  .chip {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  /* Right: sequence count */
  .count {
    flex-shrink: 0;
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    min-width: 36px;
    text-align: right;
  }
</style>
