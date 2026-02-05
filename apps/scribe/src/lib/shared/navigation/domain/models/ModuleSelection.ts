/**
 * ModuleSelection.ts - Domain models for module selection
 */

import type { ModuleDefinition, ModuleId } from "../types";

export interface ModuleSelectionContext {
  allModules: ModuleDefinition[];
  currentModule: ModuleId;
  mainModules: ModuleDefinition[];
  devModules: ModuleDefinition[];
}

export interface ModuleSelectionResult {
  selectedModule: ModuleDefinition;
  previousModule: ModuleId;
  shouldClose: boolean;
  timestamp: number;
}

export interface ModuleSelectionState {
  isSelecting: boolean;
  lastSelected: ModuleDefinition | null;
  selectionHistory: ModuleSelectionResult[];
}

export interface ModuleFilterCriteria {
  includeDeveloperModules: boolean;
  includeDisabledModules: boolean;
  searchQuery?: string;
}
