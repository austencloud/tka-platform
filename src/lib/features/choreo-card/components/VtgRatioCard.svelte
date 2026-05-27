<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE } from "$lib/shared/config/difficulty-styles";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import {
    VTG_RATIO_TURNS_MAP,
    VTG_RATIO_LEVEL_MAP,
  } from "../domain/tnd-element";

  interface Props {
    catalog: Catalog;
    onSelect: () => void;
  }

  const { catalog, onSelect }: Props = $props();

  const ratio = $derived(
    catalog.name.match(/\((\d+:\d+)/)?.[1] ?? "1:1",
  );
  const correctLevel = $derived(VTG_RATIO_LEVEL_MAP[ratio] ?? catalog.level);
  const levelStyle = $derived(
    DIFFICULTY_LEVELS[correctLevel] ?? DEFAULT_DIFFICULTY_STYLE,
  );
  const turns = $derived(
    VTG_RATIO_TURNS_MAP[ratio] ?? 0,
  );
  const turnsLabel = $derived(
    turns === 0 ? "0 turns" : turns === 1 ? "1 turn" : `${turns} turns`,
  );
  const tintColor = $derived(
    levelStyle.stops[0]?.color ?? "rgba(255,255,255,0.1)",
  );
</script>

<button
  type="button"
  class="vtg-ratio-card"
  style="
    --tint: {tintColor};
  "
  aria-label="Open {catalog.name} catalog, {turnsLabel}"
  onclick={onSelect}
>
  <header class="card-header">
    <DifficultyBadge level={correctLevel} />
    <span class="turns-label">{turnsLabel}</span>
  </header>

  <span class="ratio-number">
    {ratio}
  </span>

  <footer class="card-footer">
    <span class="stat">{catalog.totalSequences} sequences</span>
  </footer>
</button>

<style>
  .vtg-ratio-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 20px;
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--tint) 8%, transparent) 0%,
      color-mix(in srgb, var(--tint) 3%, transparent) 100%
    );
    border: 1.5px solid color-mix(in srgb, var(--tint) 30%, transparent);
    border-radius: 14px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    transition:
      transform 150ms ease,
      box-shadow 150ms ease,
      border-color 150ms ease;
  }

  .vtg-ratio-card:hover {
    transform: translateY(-4px);
    border-color: color-mix(in srgb, var(--tint) 50%, transparent);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--tint) 20%, transparent);
  }

  .vtg-ratio-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .vtg-ratio-card {
      transition: none;
    }

    .vtg-ratio-card:hover {
      transform: none;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    justify-content: center;
  }

  .turns-label {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .ratio-number {
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
    color: color-mix(in srgb, var(--tint) 85%, white);
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    justify-content: center;
  }

  .stat {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>
