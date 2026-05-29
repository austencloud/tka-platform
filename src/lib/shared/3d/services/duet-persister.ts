/**
 * DuetPersister Implementation
 *
 * Persists duet sequences to localStorage and resolves sequence IDs
 * to full SequenceData using the browse loader.
 */

import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  DuetSequence,
  DuetSequenceWithData,
  CreateDuetInput,
} from "../domain/duet-sequence";
import { createDuetSequence } from "../domain/duet-sequence";

const STORAGE_KEY = "tka-3d-duets";

/**
 * Stored format for duets (dates serialized)
 */
interface StoredDuet extends Omit<DuetSequence, "createdAt"> {
  createdAt: string;
}

export class DuetPersister {
  private sequenceCache: Map<string, SequenceData> | null = null;

  constructor(private browseLoader: PublicSequencesLoader) {}

  /**
   * Save a new duet sequence
   */
  async saveDuet(input: CreateDuetInput): Promise<string> {
    const duet = createDuetSequence(input);
    const duets = this.loadFromStorage();
    duets.push(this.serializeDuet(duet));
    this.saveToStorage(duets);
    return duet.id;
  }

  /**
   * Update an existing duet
   */
  async updateDuet(duet: DuetSequence): Promise<void> {
    const duets = this.loadFromStorage();
    const index = duets.findIndex((d) => d.id === duet.id);
    if (index >= 0) {
      duets[index] = this.serializeDuet(duet);
      this.saveToStorage(duets);
    }
  }

  /**
   * Get a duet by ID
   */
  async getDuet(id: string): Promise<DuetSequence | null> {
    const duets = this.loadFromStorage();
    const stored = duets.find((d) => d.id === id);
    return stored ? this.deserializeDuet(stored) : null;
  }

  /**
   * Get all saved duets
   */
  async getAllDuets(): Promise<DuetSequence[]> {
    return this.loadFromStorage().map((d) => this.deserializeDuet(d));
  }

  /**
   * Delete a duet by ID
   */
  async deleteDuet(id: string): Promise<void> {
    const duets = this.loadFromStorage();
    const filtered = duets.filter((d) => d.id !== id);
    this.saveToStorage(filtered);
  }

  /**
   * Get a duet with resolved sequence data
   */
  async getDuetWithData(id: string): Promise<DuetSequenceWithData | null> {
    const duet = await this.getDuet(id);
    if (!duet) return null;
    return this.resolveDuetSequences(duet);
  }

  /**
   * Resolve a duet to full sequence data
   */
  async resolveDuetSequences(
    duet: DuetSequence
  ): Promise<DuetSequenceWithData | null> {
    await this.ensureSequenceCache();

    const seq1 = this.sequenceCache?.get(duet.avatar1SequenceId);
    const seq2 = this.sequenceCache?.get(duet.avatar2SequenceId);

    if (!seq1 || !seq2) {
      console.warn("[DuetPersister] Could not resolve sequences:", {
        avatar1Found: !!seq1,
        avatar2Found: !!seq2,
      });
      return null;
    }

    return {
      ...duet,
      avatar1Sequence: seq1,
      avatar2Sequence: seq2,
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private loadFromStorage(): StoredDuet[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (e) {
      console.warn("[DuetPersister] Failed to load duets:", e);
      return [];
    }
  }

  private saveToStorage(duets: StoredDuet[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(duets));
    } catch (e) {
      console.warn("[DuetPersister] Failed to save duets:", e);
    }
  }

  private serializeDuet(duet: DuetSequence): StoredDuet {
    return {
      ...duet,
      createdAt: duet.createdAt.toISOString(),
    };
  }

  private deserializeDuet(stored: StoredDuet): DuetSequence {
    return {
      ...stored,
      createdAt: new Date(stored.createdAt),
    };
  }

  /**
   * Ensure sequence cache is loaded for ID -> SequenceData lookup
   */
  private async ensureSequenceCache(): Promise<void> {
    if (this.sequenceCache) return;

    try {
      const sequences = await this.browseLoader.loadSequenceMetadata();
      this.sequenceCache = new Map();
      for (const seq of sequences) {
        this.sequenceCache.set(seq.id, seq);
      }
    } catch (e) {
      console.error("[DuetPersister] Failed to load sequence cache:", e);
      this.sequenceCache = new Map();
    }
  }
}
