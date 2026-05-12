/**
 * ActManager - Implementation for Write tab Act operations
 */
import type { ActSummary } from "./types";

export class ActManager {
  private acts: Map<string, ActSummary> = new Map();
  private initialized = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // TODO: Load acts from persistent storage
    // For now, create some sample acts
    const sampleActs: ActSummary[] = [
      {
        id: "act-1",
        name: "Sample Act 1",
        description: "A sample act for testing",
        sequences: [],
      },
      {
        id: "act-2",
        name: "Sample Act 2",
        description: "Another sample act",
        sequences: [],
      },
    ];

    for (const act of sampleActs) {
      this.acts.set(act.id, act);
    }

    this.initialized = true;
  }

  cleanup(): void {
    this.acts.clear();
    this.initialized = false;
  }

  async loadAct(idOrPath: string): Promise<ActSummary | null> {
    await this.ensureInitialized();

    const act = this.acts.get(idOrPath);
    if (act) {
      return { ...act }; // Return a copy
    }

    return null;
  }

  async getAllActs(): Promise<ActSummary[]> {
    await this.ensureInitialized();

    const acts = Array.from(this.acts.values()).map((act) => ({ ...act }));
    return acts;
  }

  async addSequenceToAct(actId: string, sequenceId: string): Promise<void> {
    await this.ensureInitialized();

    const act = this.acts.get(actId);
    if (!act) {
      throw new Error(`Act not found: ${actId}`);
    }

    if (!act.sequences) {
      act.sequences = [];
    }

    if (!act.sequences.includes(sequenceId)) {
      act.sequences.push(sequenceId);
    }
  }

  async removeSequenceFromAct(
    actId: string,
    sequenceId: string
  ): Promise<void> {
    await this.ensureInitialized();

    const act = this.acts.get(actId);
    if (!act) {
      throw new Error(`Act not found: ${actId}`);
    }

    if (act.sequences) {
      const index = act.sequences.indexOf(sequenceId);
      if (index > -1) {
        act.sequences.splice(index, 1);
      }
    }
  }

  async exportAct(actId: string): Promise<void> {
    await this.ensureInitialized();

    const act = this.acts.get(actId);
    if (!act) {
      throw new Error(`Act not found: ${actId}`);
    }

    // TODO: Implement export functionality
    console.warn("🚧 ActManager: Export functionality not yet implemented");
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
