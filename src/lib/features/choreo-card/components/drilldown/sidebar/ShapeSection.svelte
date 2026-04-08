<script lang="ts">
  import type { Deck } from '../../../domain/models/Deck';
  import type { ShapeSelections } from '../../../state/deck-drilldown-types';
  import DrillPill from '../DrillPill.svelte';
  import GridModeCard from '../GridModeCard.svelte';
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

  let selectedLoopTypes = $state<string[]>(
    currentShape ? currentShape.loopTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)) : []
  );
  let selectedSlice = $state<string>(
    currentShape ? currentShape.sliceType.charAt(0).toUpperCase() + currentShape.sliceType.slice(1) : 'Halved'
  );
  let selectedGrid = $state<string>(
    currentShape ? currentShape.gridMode.charAt(0).toUpperCase() + currentShape.gridMode.slice(1) : ''
  );

  $effect(() => {
    if (selectedLoopTypes.length === 0 && availableLoopTypes.length > 0) {
      selectedLoopTypes = [availableLoopTypes[0]!];
    }
  });

  $effect(() => {
    if (!selectedGrid && availableGridModes.length > 0) {
      selectedGrid = availableGridModes[0]!;
    }
  });

  let rotatedSelected = $derived(
    selectedLoopTypes.some((lt) => lt.toLowerCase() === 'rotated')
  );
  let quarteredLocked = $derived(!rotatedSelected);

  $effect(() => {
    if (quarteredLocked && selectedSlice === 'Quartered') {
      selectedSlice = 'Halved';
    }
  });

  function emitSelection(): void {
    if (selectedLoopTypes.length === 0 || !selectedGrid) return;
    onSelectShape({
      loopTypes: selectedLoopTypes.map((lt) => lt.toLowerCase()),
      sliceType: selectedSlice.toLowerCase() as 'halved' | 'quartered',
      gridMode: selectedGrid.toLowerCase(),
    });
  }

  function toggleLoopType(lt: string): void {
    const idx = selectedLoopTypes.indexOf(lt);
    if (idx >= 0) {
      if (selectedLoopTypes.length > 1) {
        selectedLoopTypes = selectedLoopTypes.filter((_, i) => i !== idx);
      }
    } else {
      selectedLoopTypes = [...selectedLoopTypes, lt];
    }
    emitSelection();
  }

  function selectSlice(s: string): void {
    if (s === 'Quartered' && quarteredLocked) return;
    selectedSlice = s;
    emitSelection();
  }

  function selectGrid(g: string): void {
    selectedGrid = g;
    emitSelection();
  }
</script>

<SidebarFilterSection label="Shape" state="active" {accentColor}>
  <div class="sub-group">
    <span class="sub-label">LOOP TYPE</span>
    <div class="pill-row">
      {#each availableLoopTypes as lt}
        <DrillPill
          label={lt}
          selected={selectedLoopTypes.includes(lt)}
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
          selected={selectedSlice === s}
          locked={s === 'Quartered' && quarteredLocked}
          onClick={() => selectSlice(s)}
        />
      {/each}
    </div>
  </div>

  {#if availableGridModes.length > 0}
    <div class="sub-group">
      <span class="sub-label">GRID</span>
      <div class="grid-row">
        {#each availableGridModes as g}
          <GridModeCard
            mode={g.toLowerCase() as 'diamond' | 'box'}
            selected={selectedGrid === g}
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

  .grid-row {
    display: flex;
    gap: 8px;
  }

  .grid-row :global(.grid-mode-card) {
    padding: 10px 16px;
  }

  .grid-row :global(.grid-svg) {
    width: 40px;
    height: 40px;
  }
</style>
