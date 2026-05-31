import type { ModuleDefinition } from "../domain/types";
import type {
  ModuleSelectionState,
  ModuleSelectionContext,
  ModuleSelectionResult,
} from "../domain/models/module-selection";

export class ModuleSelector {
  private selectionState: ModuleSelectionState = {
    isSelecting: false,
    lastSelected: null,
    selectionHistory: [],
  };

  private subscriptions = new Set<(state: ModuleSelectionState) => void>();

  getAvailableModules(context: ModuleSelectionContext): string[] {
    const { allModules } = context;
    return allModules.map((m) => m.id);
  }

  filterModules(modules: string[], query: string): string[] {
    if (!query.trim()) {
      return modules;
    }

    const lowercaseQuery = query.toLowerCase();
    return modules.filter((moduleId) =>
      moduleId.toLowerCase().includes(lowercaseQuery)
    );
  }

  selectModule(
    moduleId: string,
    context: ModuleSelectionContext
  ): ModuleSelectionResult {
    const { allModules, currentModule } = context;
    const targetModule = allModules.find(
      (m: ModuleDefinition) => m.id === moduleId
    );

    if (!targetModule) {
      throw new Error(`Module "${moduleId}" not found`);
    }

    const result: ModuleSelectionResult = {
      selectedModule: targetModule,
      previousModule: currentModule,
      shouldClose: true,
      timestamp: Date.now(),
    };

    // Update internal state
    this.selectionState = {
      ...this.selectionState,
      isSelecting: false,
      lastSelected: targetModule,
      selectionHistory: [...this.selectionState.selectionHistory, result],
    };

    this.notifySubscribers();
    return result;
  }

  getSelectionState(): ModuleSelectionState {
    return this.selectionState;
  }

  isModuleSelected(moduleId: string): boolean {
    return this.selectionState.lastSelected?.id === moduleId;
  }

  getCurrentModuleId(): string | null {
    return this.selectionState.lastSelected?.id || null;
  }

  onSelectionChange(
    callback: (state: ModuleSelectionState) => void
  ): () => void {
    this.subscriptions.add(callback);
    return () => {
      this.subscriptions.delete(callback);
    };
  }

  // Additional methods for managing selection state
  startSelection(): void {
    this.selectionState = {
      ...this.selectionState,
      isSelecting: true,
    };
    this.notifySubscribers();
  }

  cancelSelection(): void {
    this.selectionState = {
      ...this.selectionState,
      isSelecting: false,
    };
    this.notifySubscribers();
  }

  // Helper methods for module categorization (extracted from ModuleSelector logic)
  getMainModules(modules: ModuleDefinition[]): ModuleDefinition[] {
    return modules.filter((m: ModuleDefinition) => m.isMain);
  }

  getDeveloperModules(modules: ModuleDefinition[]): ModuleDefinition[] {
    return modules.filter((m: ModuleDefinition) => !m.isMain);
  }

  private notifySubscribers(): void {
    this.subscriptions.forEach((callback) => callback(this.selectionState));
  }
}
