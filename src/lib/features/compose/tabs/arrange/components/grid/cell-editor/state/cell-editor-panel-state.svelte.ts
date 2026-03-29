import type { TargetHand } from '$lib/features/compose/compose/domain/types';

export type ExpandableSection =
  | 'transform' | 'speed' | 'effects' | 'effort' | 'offset' | 'display'
  | null;

export function createCellEditorPanelState() {
  let expandedSection = $state<ExpandableSection>(null);
  let applyToHand = $state<TargetHand>('both');

  return {
    get expandedSection() { return expandedSection; },
    get applyToHand() { return applyToHand; },

    toggleSection(section: ExpandableSection) {
      expandedSection = expandedSection === section ? null : section;
    },

    closeSection() {
      expandedSection = null;
    },

    setApplyToHand(hand: TargetHand) {
      applyToHand = hand;
    },

    resetForNewCell() {
      expandedSection = null;
      applyToHand = 'both';
    },
  };
}

export type CellEditorPanelState = ReturnType<typeof createCellEditorPanelState>;
