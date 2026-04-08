<script lang="ts">
  import type { CategorySelections } from '../../../state/deck-drilldown-types';
  import { VTG_ELEMENTAL_THEMES } from '../../../domain/elemental-theme';
  import ElementalFamilyCard from '../ElementalFamilyCard.svelte';
  import GridModeCard from '../GridModeCard.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    currentCategory: CategorySelections | null;
    accentColor: string;
    onSelectCategory: (category: CategorySelections) => void;
  }

  let { currentCategory, accentColor, onSelectCategory }: Props = $props();

  const FAMILY_LABELS: Record<string, string> = {
    'split-same': 'Split-Same',
    'tog-same': 'Tog-Same',
    'quarter-same': 'Quarter-Same',
    'split-opp': 'Split-Opp',
    'tog-opp': 'Tog-Opp',
    'quarter-opp': 'Quarter-Opp',
  };

  const sameFamilies = VTG_ELEMENTAL_THEMES.filter((t) => t.familyId.endsWith('-same'));
  const oppFamilies = VTG_ELEMENTAL_THEMES.filter((t) => t.familyId.endsWith('-opp'));

  let selectedFamily = $state<string>(currentCategory?.vtgFamily ?? '');
  let selectedGrid = $state<string>(
    currentCategory ? currentCategory.gridMode.charAt(0).toUpperCase() + currentCategory.gridMode.slice(1) : 'Diamond'
  );

  function selectFamily(familyId: string): void {
    selectedFamily = familyId;
    emitSelection();
  }

  function selectGrid(g: string): void {
    selectedGrid = g;
    emitSelection();
  }

  function emitSelection(): void {
    if (!selectedFamily || !selectedGrid) return;
    onSelectCategory({
      vtgFamily: selectedFamily,
      gridMode: selectedGrid.toLowerCase(),
    });
  }
</script>

<SidebarFilterSection label="Category" state="active" {accentColor}>
  <div class="sub-group">
    <span class="sub-label">SAME DIRECTION</span>
    <div class="family-grid">
      {#each sameFamilies as theme}
        <ElementalFamilyCard
          familyId={theme.familyId}
          familyLabel={FAMILY_LABELS[theme.familyId] ?? theme.familyId}
          element={theme.element}
          accentColor={theme.accentColor}
          selected={selectedFamily === theme.familyId}
          onClick={() => selectFamily(theme.familyId)}
        />
      {/each}
    </div>
  </div>

  <div class="sub-group">
    <span class="sub-label">OPPOSITE DIRECTION</span>
    <div class="family-grid">
      {#each oppFamilies as theme}
        <ElementalFamilyCard
          familyId={theme.familyId}
          familyLabel={FAMILY_LABELS[theme.familyId] ?? theme.familyId}
          element={theme.element}
          accentColor={theme.accentColor}
          selected={selectedFamily === theme.familyId}
          onClick={() => selectFamily(theme.familyId)}
        />
      {/each}
    </div>
  </div>

  <div class="sub-group">
    <span class="sub-label">GRID</span>
    <div class="grid-row">
      <GridModeCard mode="diamond" selected={selectedGrid === 'Diamond'} onClick={() => selectGrid('Diamond')} />
      <GridModeCard mode="box" selected={selectedGrid === 'Box'} onClick={() => selectGrid('Box')} />
    </div>
  </div>
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

  .family-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .family-grid :global(.elemental-card) {
    padding: 14px 10px;
  }

  .family-grid :global(.element-icon) {
    width: 28px;
    height: 28px;
    margin-bottom: 8px;
  }

  .family-grid :global(.family-name) {
    font-size: 11px;
  }

  .family-grid :global(.element-name) {
    font-size: 9px;
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
