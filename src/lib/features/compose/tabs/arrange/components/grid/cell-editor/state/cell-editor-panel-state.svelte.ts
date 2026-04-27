import type { TargetHand } from '$lib/features/compose/compose/domain/types';
import type { PillId, ScopeLevel, EditorMode } from '../pill-nav/types';

export type ExpandableSection =
  | 'transform' | 'speed' | 'effects' | 'effort' | 'offset' | 'display' | 'colors'
  | null;

export function createCellEditorPanelState() {
  let expandedSection = $state<ExpandableSection>(null);
  let applyToHand = $state<TargetHand>('both');

  let activePill = $state<PillId>('effects');
  let scopeLevel = $state<ScopeLevel>('cell');
  let editorMode = $state<EditorMode>('simple');
  let usePillNav = $state<boolean>(true);

  return {
    get expandedSection() { return expandedSection; },
    get applyToHand() { return applyToHand; },

    get activePill() { return activePill; },
    get scopeLevel() { return scopeLevel; },
    get editorMode() { return editorMode; },
    get usePillNav() { return usePillNav; },

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
    setEditorMode(mode: EditorMode) { editorMode = mode; },
    setUsePillNav(enabled: boolean) { usePillNav = enabled; },

    resetForNewCell() {
      expandedSection = null;
      applyToHand = 'both';
      scopeLevel = 'cell';
    },
  };
}

export type CellEditorPanelState = ReturnType<typeof createCellEditorPanelState>;
