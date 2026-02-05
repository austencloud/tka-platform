/**
 * Create module Event Service contract
 * Restored minimal contract to match current implementation.
 */
export interface ICreateModuleEventHandler {
  handleTabSwitch(tabId: string): void;
  handleWorkbenchUpdate(data: unknown): void;
  handleOptionSelection(option: unknown): void;
  setupComponentCoordination(): void;
}
