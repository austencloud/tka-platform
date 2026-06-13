/**
 * Persistence Initializer
 *
 * Handles the initialization of the persistence layer.
 * Call this when the app starts up to ensure the database is ready.
 */

import {
  isAvailable as persistenceIsAvailable,
  initialize as persistenceInitialize,
  getActiveTab,
  getStorageInfo,
} from "./dexie-persistence-service";

export class PersistenceInitializer {
  private isInitialized = false;
  private initializationError?: string;

  async initialize(): Promise<void> {
    try {
      if (!persistenceIsAvailable()) {
        throw new Error("IndexedDB is not available in this environment");
      }

      await persistenceInitialize();
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
      isAvailable: persistenceIsAvailable(),
      ...(this.initializationError !== undefined && {
        error: this.initializationError,
      }),
    };
  }

  private async restoreApplicationState(): Promise<void> {
    try {
      await getActiveTab();
      await getStorageInfo();
    } catch {
      // Don't throw here - this is not critical for app startup
    }
  }
}
