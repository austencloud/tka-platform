<script lang="ts">
  import type { Deck } from '../../../domain/models/Deck';
  import type { ShapeSelections } from '../../../state/deck-drilldown-types';
  import DrillPill from '../DrillPill.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    decks: Deck[];
    currentShape: ShapeSelections | null;
    accentColor: string;
    onSelectShape: (shape: ShapeSelections) => void;
  }

  let { decks, currentShape, accentColor, onSelectShape }: Props = $props();

  const LOOP_TYPE_ORDER = ['Rotated', 'Mirrored', 'Swapped', 'Inverted', 'Rewound'] as const;
  const SLICE_OPTIONS = ['Halved', 'Quartered'] as const;
  const GRID_OPTIONS = ['Diamond', 'Box'] as const;

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  let availableLoopTypes = $derived(
    LOOP_TYPE_ORDER.filter((lt) =>
      decks.some((d) => d.loopType?.toLowerCase() === lt.toLowerCase())
    )
  );

  let availableGridModes = $derived(
    GRID_OPTIONS.filter((g) =>
      decks.some((d) => d.gridMode.toLowerCase() === g.toLowerCase())
    )
  );

  // Read displayed values from the drill state (props), with sensible defaults
  const displayLoopTypes: string[] = $derived(
    currentShape
      ? currentShape.loopTypes.map(t => capitalize(t))
      : (availableLoopTypes.length > 0 ? [availableLoopTypes[0]!] : [])
  );
  const displaySlice: string = $derived(
    currentShape ? capitalize(currentShape.sliceType) : 'Halved'
  );
  const displayGrid: string = $derived(
    currentShape ? capitalize(currentShape.gridMode) : (availableGridModes[0] ?? 'Diamond')
  );

  let rotatedSelected = $derived(
    displayLoopTypes.some((lt) => lt?.toLowerCase() === 'rotated')
  );
  let quarteredLocked = $derived(!rotatedSelected);

  function emitShape(loopTypes: string[], slice: string, grid: string): void {
    if (loopTypes.length === 0 || !grid) return;
    // Force Halved if Quartered is locked
    const effectiveSlice = (!loopTypes.some(lt => lt.toLowerCase() === 'rotated') && slice === 'Quartered')
      ? 'Halved' : slice;
    onSelectShape({
      loopTypes: loopTypes.map((lt) => lt.toLowerCase()),
      sliceType: effectiveSlice.toLowerCase() as 'halved' | 'quartered',
      gridMode: grid.toLowerCase(),
    });
  }

  function toggleLoopType(lt: string): void {
    const current = [...displayLoopTypes];
    const idx = current.indexOf(lt);
    let next: string[];
    if (idx >= 0) {
      if (current.length <= 1) return;
      next = current.filter((_, i) => i !== idx);
    } else {
      next = [...current, lt];
    }
    emitShape(next, displaySlice, displayGrid);
  }

  function selectSlice(s: string): void {
    if (s === 'Quartered' && quarteredLocked) return;
    emitShape([...displayLoopTypes], s, displayGrid);
  }

  function selectGrid(g: string): void {
    emitShape([...displayLoopTypes], displaySlice, g);
  }
</script>

<SidebarFilterSection label="Shape" state="active" {accentColor}>
  <div class="sub-group">
    <span class="sub-label">LOOP TYPE</span>
    <div class="pill-row">
      {#each availableLoopTypes as lt}
        <DrillPill
          label={lt}
          selected={displayLoopTypes.includes(lt)}
          onClick={() => toggleLoopType(lt)}
        />
      {/each}
    </div>
  </div>

  <div class="sub-group">
    <span class="sub-label">SLICE</span>
    <div class="pill-row">
      {#each SLICE_OPTIONS as s}
        <DrillPill
          label={s}
          selected={displaySlice === s}
          locked={s === 'Quartered' && quarteredLocked}
          onClick={() => selectSlice(s)}
        />
      {/each}
    </div>
  </div>

  {#if availableGridModes.length > 0}
    <div class="sub-group">
      <span class="sub-label">GRID</span>
      <div class="pill-row">
        {#each availableGridModes as g}
          <DrillPill
            label={g}
            selected={displayGrid === g}
            onClick={() => selectGrid(g)}
          />
        {/each}
      </div>
    </div>
  {/if}
</SidebarFilterSection>

<style>
  .sub-group {
    margin-bottom: 12px;
  }

  .sub-group:last-child {
    margin-bottom: 0;
  }

  .sub-label {
    display: block;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(255, 255, 255, 0.2);
    margin-bottom: 8px;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
