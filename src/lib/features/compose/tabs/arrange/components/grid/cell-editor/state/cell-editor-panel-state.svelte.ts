import type { TargetHand } from '$lib/shared/animation-engine/domain/compose-types';
import type { PillId } from '$lib/shared/animation-panel/pill-nav/pill-types';

export type ScopeLevel = 'grid' | 'cell' | 'layer' | 'hand' | 'tip';

export type ExpandableSection =
  | 'transform' | 'speed' | 'effects' | 'effort' | 'offset' | 'display' | 'colors'
  | null;

export interface PillScopeConfig {
  id: PillId;
  scopes: ScopeLevel[];
}

export const PILL_SCOPE_CONFIG: PillScopeConfig[] = [
  { id: 'grid', scopes: ['grid'] },
  { id: 'layers', scopes: ['cell'] },
  { id: 'effects', scopes: ['cell', 'layer', 'hand', 'tip'] },
  { id: 'effort', scopes: ['cell', 'layer'] },
  { id: 'playback', scopes: ['cell', 'layer'] },
  { id: 'display', scopes: ['cell'] },
  { id: 'export', scopes: [] },
];

export function createCellEditorPanelState() {
  let expandedSection = $state<ExpandableSection>(null);
  let applyToHand = $state<TargetHand>('both');
  let activePill = $state<PillId>('effects');
  let scopeLevel = $state<ScopeLevel>('cell');

  return {
    get expandedSection() { return expandedSection; },
    get applyToHand() { return applyToHand; },
    get activePill() { return activePill; },
    get scopeLevel() { return scopeLevel; },

    toggleSection(section: ExpandableSection) {
      expandedSection = expandedSection === section ? null : section;
    },

    closeSection() {
      expandedSection = null;
    },

    setApplyToHand(hand: TargetHand) {
      applyToHand = hand;
    },

    setActivePill(pill: PillId) { activePill = pill; },
    setScopeLevel(level: ScopeLevel) { scopeLevel = level; },

    resetForNewCell() {
      expandedSection = null;
      applyToHand = 'both';
      scopeLevel = 'cell';
    },
  };
}

export type CellEditorPanelState = ReturnType<typeof createCellEditorPanelState>;
