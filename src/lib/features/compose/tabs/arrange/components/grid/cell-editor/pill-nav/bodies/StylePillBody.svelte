<script lang="ts">
  import type { TransformType } from '$lib/features/compose/compose/domain/types';
  import type { PropColors } from '$lib/features/compose/compose/domain/types';
  import type { TipEffortMap } from '$lib/shared/animation-engine/domain/types/TipEffectTypes';
  import type { CellEditorPanelState } from '../../state/cell-editor-panel-state.svelte';
  import TransformSection from '../../sections/TransformSection.svelte';
  import ColorsSection from '../../sections/ColorsSection.svelte';
  import UnifiedEffortSection from '../../sections/UnifiedEffortSection.svelte';

  let {
    panelState,
    currentColors,
    currentEffort,
    tipEffortMap = {},
    onTransform,
    onSetColors,
    onSetEffort,
    onUpdateTipEffortMap,
  }: {
    panelState: CellEditorPanelState;
    currentColors: PropColors;
    currentEffort: string | undefined;
    tipEffortMap?: TipEffortMap;
    onTransform: (type: TransformType) => void;
    onSetColors: (colors: PropColors) => void;
    onSetEffort: (effort: string) => void;
    onUpdateTipEffortMap?: (map: TipEffortMap) => void;
  } = $props();
</script>

<div class="style-body">
  <span class="section-label">TRANSFORM</span>
  <TransformSection {panelState} {onTransform} />

  <span class="section-label">COLORS</span>
  <ColorsSection {currentColors} onSetColors={onSetColors} />

  <span class="section-label">EFFORT</span>
  <UnifiedEffortSection
    {currentEffort}
    currentMap={tipEffortMap}
    bluePropType="staff"
    redPropType="staff"
    onSetEffort={onSetEffort}
    onUpdateMap={map => onUpdateTipEffortMap?.(map)}
  />
</div>

<style>
  .style-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 4px;
  }

  .section-label:first-child { margin-top: 0; }
</style>
