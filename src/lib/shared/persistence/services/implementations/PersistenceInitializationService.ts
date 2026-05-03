/**
 * Persistence Initialization Service
 *
 * This service handles the initialization of your persistence layer.
 * Call this when your app starts up to ensure the database is ready.
 */

import type { IPersistenceService } from "../contracts/IPersistenceService";

export class PersistenceInitializationService {
  private isInitialized = false;
  private initializationError?: string;

  constructor(private persistenceService: IPersistenceService) {}

  async initialize(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (!this.persistenceService.isAvailable()) {
        throw new Error("IndexedDB is not available in this environment");
      }

      // Initialize the persistence service
      await this.persistenceService.initialize();

      // Restore the last active tab
      await this.restoreApplicationState();

      this.isInitialized = true;
      delete this.initializationError;
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized && !this.initializationError;
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isAvailable: this.persistenceService.isAvailable(),
      ...(this.initializationError !== undefined && {
        error: this.initializationError,
      }),
    };
  }

  /**
   * Restore application state from persistence
   */
  private async restoreApplicationState(): Promise<void> {
    try {
      // Get the last active tab to prepare state restoration
      await this.persistenceService.getActiveTab();
      // Get storage info for potential future use
      await this.persistenceService.getStorageInfo();
    } catch (error) {
      // Don't throw here - this is not critical for app startup
    }
  }
}
