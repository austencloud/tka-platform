/**
 * ITrainingDataPersister - Save and manage training data pairs
 *
 * Stores verified training pairs locally in IndexedDB for fast access,
 * with optional sync to Firebase for export and cross-device access.
 * Every human verification creates a training pair that feeds future
 * AI model training.
 */

import type { TrainingPair, TrainingDataStats } from "../../domain/training-models";

export interface ITrainingDataPersister {
  /** Initialize the database connection */
  initialize(): Promise<void>;

  /** Save a new training pair */
  save(pair: TrainingPair): Promise<void>;

  /** Get a training pair by ID */
  get(id: string): Promise<TrainingPair | null>;

  /** List all training pairs, newest first */
  list(): Promise<TrainingPair[]>;

  /** List training pairs for a specific phase */
  listByPhase(phase: number): Promise<TrainingPair[]>;

  /** Delete a training pair by ID */
  delete(id: string): Promise<void>;

  /** Get aggregate statistics about the training data */
  getStats(): Promise<TrainingDataStats>;

  /** Sync unsynced pairs to Firebase */
  syncToFirebase(): Promise<number>;

  /** Export all pairs as a JSON array (for Colab notebooks) */
  exportAll(): Promise<TrainingPair[]>;

  /** Close the database connection */
  close(): void;
}
