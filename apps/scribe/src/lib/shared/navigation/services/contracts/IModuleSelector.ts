import type {
  ModuleSelectionContext,
  ModuleSelectionResult,
  ModuleSelectionState,
} from "../../domain/models/ModuleSelection";

/**
 * Service for managing module selection logic and filtering
 */
export interface IModuleSelector {
  /**
   * Get available modules based on current context
   */
  getAvailableModules(context: ModuleSelectionContext): string[];

  /**
   * Filter modules based on search query
   */
  filterModules(modules: string[], query: string): string[];

  /**
   * Select a module and return the result
   */
  selectModule(
    moduleId: string,
    context: ModuleSelectionContext
  ): ModuleSelectionResult;

  /**
   * Get current selection state
   */
  getSelectionState(): ModuleSelectionState;

  /**
   * Check if a module is currently selected
   */
  isModuleSelected(moduleId: string): boolean;

  /**
   * Get the currently selected module ID
   */
  getCurrentModuleId(): string | null;

  /**
   * Subscribe to selection changes
   * @param callback Function to call when selection changes
   * @returns Unsubscribe function
   */
  onSelectionChange(
    callback: (state: ModuleSelectionState) => void
  ): () => void;
}
