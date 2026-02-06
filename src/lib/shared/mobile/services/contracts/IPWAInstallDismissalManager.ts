export interface PWADismissalState {
  dismissCount: number;
  lastDismissed: number | null;
  neverAskAgain: boolean;
  hasInstalled: boolean;
}

export interface IPWAInstallDismissalManager {
  recordDismissal(): void;
  recordInstallation(): void;
  recordNeverAskAgain(): void;
  canShowPrompt(): boolean;
  getDaysUntilNextPrompt(): number;
  getState(): PWADismissalState;
  reset(): void;
}
