export interface IPersistenceInitializationService {
  /**
   * Initialize the entire persistence system
   */
  initialize(): Promise<void>;

  /**
   * Check if persistence is ready
   */
  isReady(): boolean;

  /**
   * Get initialization status
   */
  getStatus(): {
    isInitialized: boolean;
    isAvailable: boolean;
    error?: string;
  };
}
