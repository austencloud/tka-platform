// src/lib/features/choreo-card/state/catalog-browse-types.ts

export interface FilterState {
  loopTypes: string[];
  vtgFamilies: string[];
  sliceTypes: string[];
  gridModes: string[];
  stepCounts: number[];
  turnPatterns: string[];
}

export interface AvailableFilters {
  loopTypes: string[];
  vtgFamilies: string[];
  sliceTypes: string[];
  gridModes: string[];
  stepCounts: number[];
  turnPatterns: string[];
}

export type VtgViewMode = 'turns' | 'family';

export interface SavedCatalogBrowseState {
  collection: 'LOOPs' | 'VTG';
  filters: FilterState;
  scrollY: number;
  vtgViewMode?: VtgViewMode;
}

export const EMPTY_FILTERS: FilterState = {
  loopTypes: [],
  vtgFamilies: [],
  sliceTypes: [],
  gridModes: [],
  stepCounts: [],
  turnPatterns: [],
};

export const VTG_FAMILY_LABELS: Record<string, string> = {
  'split-same': 'Split-Same',
  'tog-same': 'Tog-Same',
  'split-opp': 'Split-Opp',
  'tog-opp': 'Tog-Opp',
  'quarter-same': 'Quarter-Same',
  'quarter-opp': 'Quarter-Opp',
};

export const VTG_FAMILY_KEYS = Object.keys(VTG_FAMILY_LABELS);
