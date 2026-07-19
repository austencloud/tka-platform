<!-- src/lib/shared/shape-matrix/components/ElementChipRow.svelte
  The six VTG timing-and-direction modes as elemental pickers. Bespoke rather
  than FilterChipBase/SegmentedControl per chip-primitives.md's keep-separate
  carve-out: per-option element accent colors + icon PNGs + stacked
  icon/code/name layout, plus an at-most-one selection that clears on re-click
  (SegmentedControl cannot represent none-selected). Mode → element mapping is
  diamond-grid-specific (see build-mode-realizations.ts). -->
<script lang="ts">
  import { MODE_ORDER, MODE_LABEL, type VtgMode } from "../services/shape-matrix-realizations";
  import { FAMILY_BY_MODE } from "../services/build-mode-realizations";
  import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";

  let { selected, disabled = false, onpick }: {
    selected: VtgMode | null;
    disabled?: boolean;
    onpick: (mode: VtgMode | null) => void;
  } = $props();

  // Matches the guard in build-mode-realizations.ts for the same lookup:
  // FAMILY_BY_MODE/TND_BY_FAMILY are both keyed by generic `string`, so
  // indexing is possibly-undefined to the type checker even though every
  // VtgMode maps to a real family in practice. Filter rather than assert.
  const chips = MODE_ORDER.map((mode) => ({
    mode,
    label: MODE_LABEL[mode],
    el: TND_BY_FAMILY[FAMILY_BY_MODE[mode]],
  })).filter((c): c is typeof c & { el: NonNullable<typeof c.el> } => c.el !== undefined);

  function elementName(raw: string): string {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
</script>

<div class="chip-row" role="group" aria-label="Timing and direction elements">
  {#each chips as c (c.mode)}
    <button
      type="button"
      class="element-chip"
      class:active={selected === c.mode}
      style="--el: {c.el.accentColor}; --el-dark: {c.el.darkComplement}"
      aria-pressed={selected === c.mode}
      aria-label={`${elementName(c.el.element)} (${c.label})`}
      {disabled}
      onclick={() => onpick(selected === c.mode ? null : c.mode)}
    >
      <img class="chip-icon" src={c.el.iconPath} alt="" />
      <span class="chip-code">{c.mode}</span>
      <span class="chip-name">{elementName(c.el.element)}</span>
    </button>
  {/each}
</div>

<style>
  .chip-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.55rem;
  }
  @media (max-width: 479.98px) {
    .chip-row { grid-template-columns: repeat(3, 1fr); }
  }
  .element-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-height: 44px;
    padding: 0.55rem 0.2rem 0.5rem;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--el) 45%, transparent);
    background: color-mix(in srgb, var(--el) 7%, transparent);
    color: oklch(0.88 0.02 270);
    font-family: inherit;
    cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
  }
  .element-chip:hover:not(:disabled) {
    background: color-mix(in srgb, var(--el) 15%, transparent);
    transform: translateY(-1px);
  }
  .element-chip.active {
    background: color-mix(in srgb, var(--el) 26%, transparent);
    border-color: var(--el);
    box-shadow: 0 0 14px color-mix(in srgb, var(--el) 35%, transparent);
  }
  .element-chip:disabled {
    opacity: 0.38;
    cursor: default;
  }
  .element-chip:focus-visible {
    outline: 2px solid var(--el);
    outline-offset: 2px;
  }
  .chip-icon { width: 26px; height: 26px; object-fit: contain; }
  .chip-code {
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em;
    color: color-mix(in srgb, var(--el) 80%, white);
  }
  .chip-name { font-size: 0.68rem; color: oklch(0.66 0.015 270); }
  @media (prefers-reduced-motion: reduce) {
    .element-chip { transition: none; }
    .element-chip:hover:not(:disabled) { transform: none; }
  }
</style>
