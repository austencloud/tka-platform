
export interface FilterState {
  loopTypes: string[];
  tndFamilies: string[];
  sliceTypes: string[];
  gridModes: string[];
  stepCounts: number[];
  turnPatterns: string[];
  reversalPatterns: string[];
}

export interface AvailableFilters {
  loopTypes: string[];
  tndFamilies: string[];
  sliceTypes: string[];
  gridModes: string[];
  stepCounts: number[];
  turnPatterns: string[];
  reversalPatterns: string[];
}

export type TnDViewMode = 'turns' | 'family';

export interface SavedCatalogBrowseState {
  collection: 'LOOPs' | 'TnD';
  filters: FilterState;
  scrollY: number;
  tndViewMode?: TnDViewMode;
}

export const EMPTY_FILTERS: FilterState = {
  loopTypes: [],
  tndFamilies: [],
  sliceTypes: [],
  gridModes: [],
  stepCounts: [],
  turnPatterns: [],
  reversalPatterns: [],
};

export const TND_FAMILY_LABELS: Record<string, string> = {
  'split-same': 'Split-Same',
  'tog-same': 'Tog-Same',
  'split-opp': 'Split-Opp',
  'tog-opp': 'Tog-Opp',
  'quarter-same': 'Quarter-Same',
  'quarter-opp': 'Quarter-Opp',
};

export const TND_FAMILY_KEYS = Object.keys(TND_FAMILY_LABELS);
