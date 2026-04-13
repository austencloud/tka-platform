<script lang="ts">
  /**
   * ChoreoCardGlyphToggles
   *
   * Chip-style toggles for glyph visibility on 2D pictographs.
   * Glyphs are disabled when not all motions are visible (same
   * rule as the old context menu).
   */

  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";

  const vm = getVisibilityStateManager();

  let version = $state(0);
  $effect(() => {
    const bump = () => { version++; };
    vm.registerObserver(bump);
    return () => vm.unregisterObserver(bump);
  });

  // Internal glyph keys match the VisibilityStateManager's settings field names.
  // Dependent glyphs (tkaGlyph, vtgGlyph, elementalGlyph, positionsGlyph) are
  // only available when both motions are visible. reversalIndicators is independent.
  type GlyphKey = "tkaGlyph" | "vtgGlyph" | "elementalGlyph" | "positionsGlyph" | "reversalIndicators";

  const GLYPHS: { key: GlyphKey; label: string }[] = [
    { key: "tkaGlyph", label: "TKA" },
    { key: "vtgGlyph", label: "VTG" },
    { key: "elementalGlyph", label: "Elemental" },
    { key: "positionsGlyph", label: "Positions" },
    { key: "reversalIndicators", label: "Reversals" },
  ];

  function allMotionsVisible(): boolean {
    void version;
    return vm.areAllMotionsVisible();
  }

  function isGlyphEnabled(key: GlyphKey): boolean {
    void version;
    return vm.getRawGlyphVisibility(key);
  }

  function toggleGlyph(key: GlyphKey) {
    vm.setGlyphVisibility(key, !isGlyphEnabled(key));
  }

  // Recomputes whenever `version` increments (observer fires)
  const motionsVisible = $derived(allMotionsVisible());
</script>

<div class="glyph-chips">
  {#each GLYPHS as glyph (glyph.key)}
    {@const enabled = isGlyphEnabled(glyph.key)}
    {@const isDependent = glyph.key !== "reversalIndicators"}
    {@const isDisabled = isDependent && !motionsVisible}
    <button
      class="chip"
      class:active={enabled}
      disabled={isDisabled}
      onclick={() => toggleGlyph(glyph.key)}
      aria-pressed={enabled}
      title={isDisabled ? `${glyph.label} (show all motions first)` : glyph.label}
    >
      {glyph.label}
    </button>
  {/each}
</div>

{#if !motionsVisible}
  <p class="hint">Show both motions to toggle glyphs</p>
{/if}

<style>
  .glyph-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
  }

  .chip {
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .chip:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .chip:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .chip.active {
    border-color: color-mix(in srgb, #8b8bff 40%, transparent);
    background: color-mix(in srgb, #8b8bff 15%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }

  .hint {
    margin: 6px 0 0;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }
</style>
