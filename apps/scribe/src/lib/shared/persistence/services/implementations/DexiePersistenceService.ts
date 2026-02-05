/**
 * Dexie Persistence Service Implementation
 *
 * This is where the magic happens! This service implements all the database
 * operations using Dexie. Your components will call these methods, and this
 * service handles all the IndexedDB complexity behind the scenes.
 */

import type { AppSettings } from "../../../settings/domain/AppSettings";
import type { CompleteBrowseState } from "../../../../features/browse/shared/domain/models/browse-models";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { TabId } from "../../../navigation/domain/types";
import {
  createSequenceData,
  type SequenceData,
} from "../../../foundation/domain/models/SequenceData";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";
import { db } from "../../database/TKADatabase";
import { UserWorkType } from "../../domain/enums/UserWorkType";
import type { UserProject } from "../../domain/models/UserProject";
import type { UserWorkData } from "../../domain/models/UserWorkData";
import type { IPersistenceService } from "../contracts/IPersistenceService";

export class DexiePersistenceService implements IPersistenceService {
  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    try {
      await db.open();
    } catch (error) {
      console.error("❌ DexiePersistenceService: Failed to initialize:", error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && "indexedDB" in window;
  }

  // ============================================================================
  // SEQUENCE OPERATIONS
  // ============================================================================

  async saveSequence(sequence: SequenceData): Promise<void> {
    try {
      await db.sequences.put(sequence);
    } catch (error) {
      console.error("❌ Failed to save sequence:", error);
      throw error;
    }
  }

  async loadSequence(id: string): Promise<SequenceData | null> {
    try {
      const sequence = await db.sequences.get(id);
      return sequence ?? null;
    } catch (error) {
      console.error("❌ Failed to load sequence:", error);
      return null;
    }
  }

  async getAllSequences(filter?: {
    author?: string;
    level?: number;
    isFavorite?: boolean;
    tags?: string[];
  }): Promise<SequenceData[]> {
    try {
      let query = db.sequences.toCollection();

      // Apply filters if provided
      if (filter) {
        if (filter.author) {
          query = query.filter((seq) => seq.author === filter.author);
        }
        if (filter.level !== undefined) {
          query = query.filter((seq) => seq.level === filter.level);
        }
        if (filter.isFavorite !== undefined) {
          query = query.filter((seq) => seq.isFavorite === filter.isFavorite);
        }
        if (filter.tags && filter.tags.length > 0) {
          query = query.filter((seq) =>
            filter.tags!.some((tag) => seq.tags.includes(tag))
          );
        }
      }

      return await query.toArray();
    } catch (error) {
      console.error("❌ Failed to get sequences:", error);
      return [];
    }
  }

  async deleteSequence(id: string): Promise<void> {
    try {
      await db.sequences.delete(id);
    } catch (error) {
      console.error("❌ Failed to delete sequence:", error);
      throw error;
    }
  }

  /**
   * Alias for getAllSequences (required by ISequenceRepository contract)
   */
  async loadAllSequences(): Promise<SequenceData[]> {
    return this.getAllSequences();
  }

  async searchSequences(query: string): Promise<SequenceData[]> {
    try {
      const searchTerm = query.toLowerCase();
      return await db.sequences
        .filter(
          (seq) =>
            seq.name.toLowerCase().includes(searchTerm) ||
            seq.word.toLowerCase().includes(searchTerm) ||
            (seq.author?.toLowerCase().includes(searchTerm) ?? false)
        )
        .toArray();
    } catch (error) {
      console.error("❌ Failed to search sequences:", error);
      return [];
    }
  }

  // ============================================================================
  // PICTOGRAPH OPERATIONS
  // ============================================================================

  async savePictograph(pictograph: PictographData): Promise<void> {
    try {
      await db.pictographs.put(pictograph);
    } catch (error) {
      console.error("❌ Failed to save pictograph:", error);
      throw error;
    }
  }

  async loadPictograph(id: string): Promise<PictographData | null> {
    try {
      const pictograph = await db.pictographs.get(id);
      return pictograph ?? null;
    } catch (error) {
      console.error("❌ Failed to load pictograph:", error);
      return null;
    }
  }

  async getPictographsByLetter(letter: string): Promise<PictographData[]> {
    try {
      return await db.pictographs.where("letter").equals(letter).toArray();
    } catch (error) {
      console.error("❌ Failed to get pictographs by letter:", error);
      return [];
    }
  }

  async getAllPictographs(): Promise<PictographData[]> {
    try {
      return await db.pictographs.toArray();
    } catch (error) {
      console.error("❌ Failed to get all pictographs:", error);
      return [];
    }
  }

  // ============================================================================
  // TAB STATE PERSISTENCE
  // ============================================================================

  async saveActiveTab(tabId: TabId): Promise<void> {
    try {
      await this.saveUserWork(UserWorkType.TAB_STATE, "app", {
        activeTab: tabId,
      });
    } catch (error) {
      console.error("❌ Failed to save active tab:", error);
      throw error;
    }
  }

  async getActiveTab(): Promise<TabId | null> {
    try {
      const data = (await this.loadUserWork(UserWorkType.TAB_STATE, "app")) as {
        activeTab?: TabId;
      } | null;
      return data?.activeTab ?? null;
    } catch (error) {
      console.error("❌ Failed to get active tab:", error);
      return null;
    }
  }

  async saveTabState(tabId: TabId, state: unknown): Promise<void> {
    try {
      await this.saveUserWork(UserWorkType.TAB_STATE, tabId, state);
    } catch (error) {
      console.error("❌ Failed to save tab state:", error);
      throw error;
    }
  }

  async loadTabState<T = unknown>(tabId: TabId): Promise<T | null> {
    try {
      return (await this.loadUserWork(
        UserWorkType.TAB_STATE,
        tabId
      )) as T | null;
    } catch (error) {
      console.error("❌ Failed to load tab state:", error);
      return null;
    }
  }

  // ============================================================================
  // Browse STATE PERSISTENCE
  // ============================================================================

  async saveBrowseState(state: CompleteBrowseState): Promise<void> {
    try {
      await this.saveUserWork(UserWorkType.Browse_STATE, "browse", state);
    } catch (error) {
      console.error("❌ Failed to save Browse state:", error);
      throw error;
    }
  }

  async loadBrowseState(): Promise<CompleteBrowseState | null> {
    try {
      return (await this.loadUserWork(
        UserWorkType.Browse_STATE,
        "browse"
      )) as CompleteBrowseState | null;
    } catch (error) {
      console.error("❌ Failed to load Browse state:", error);
      return null;
    }
  }

  // ============================================================================
  // SETTINGS PERSISTENCE
  // ============================================================================

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await db.settings.put({ ...settings, id: "default" } as AppSettings & {
        id: string;
      });
    } catch (error) {
      console.error("❌ Failed to save settings:", error);
      throw error;
    }
  }

  async loadSettings(): Promise<AppSettings | null> {
    try {
      const settings = await db.settings.where("id").equals("default").first();
      return settings ?? null;
    } catch (error) {
      console.error("❌ Failed to load settings:", error);
      return null;
    }
  }

  // ============================================================================
  // USER PROJECTS
  // ============================================================================

  async saveProject(project: UserProject): Promise<void> {
    try {
      await db.userProjects.put(project);
    } catch (error) {
      console.error("❌ Failed to save project:", error);
      throw error;
    }
  }

  async loadProjects(): Promise<UserProject[]> {
    try {
      return await db.userProjects.orderBy("lastModified").reverse().toArray();
    } catch (error) {
      console.error("❌ Failed to load projects:", error);
      return [];
    }
  }

  async deleteProject(id: number): Promise<void> {
    try {
      await db.userProjects.delete(id);
    } catch (error) {
      console.error("❌ Failed to delete project:", error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  async exportAllData(): Promise<unknown> {
    try {
      const data = {
        sequences: await db.sequences.toArray(),
        pictographs: await db.pictographs.toArray(),
        userWork: await db.userWork.toArray(),
        userProjects: await db.userProjects.toArray(),
        settings: await db.settings.toArray(),
        exportedAt: new Date().toISOString(),
        version: 1,
      };
      return data;
    } catch (error) {
      console.error("❌ Failed to export data:", error);
      throw error;
    }
  }

  importData(_data: unknown): Promise<void> {
    throw new Error("Import not yet implemented");
  }

  async clearAllData(): Promise<void> {
    try {
      await db.transaction(
        "rw",
        [
          db.sequences,
          db.pictographs,
          db.userWork,
          db.userProjects,
          db.settings,
        ],
        async () => {
          await db.sequences.clear();
          await db.pictographs.clear();
          await db.userWork.clear();
          await db.userProjects.clear();
          await db.settings.clear();
        }
      );
    } catch (error) {
      console.error("❌ Failed to clear data:", error);
      throw error;
    }
  }

  async getStorageInfo() {
    try {
      return {
        sequences: await db.sequences.count(),
        pictographs: await db.pictographs.count(),
        userWork: await db.userWork.count(),
        projects: await db.userProjects.count(),
      };
    } catch (error) {
      console.error("❌ Failed to get storage info:", error);
      return { sequences: 0, pictographs: 0, userWork: 0, projects: 0 };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Generic method to save user work data
   */
  private async saveUserWork(
    type: UserWorkType,
    tabId: string,
    data: unknown
  ): Promise<void> {
    const workData: UserWorkData = {
      type,
      tabId,
      data,
      lastModified: new Date(),
      version: 1,
    };

    // Update existing record or create new one
    const existing = await db.userWork.where({ type, tabId }).first();

    if (existing) {
      await db.userWork.update(existing.id, {
        data,
        lastModified: new Date(),
      });
    } else {
      await db.userWork.add(workData);
    }
  }

  /**
   * Generic method to load user work data
   */
  private async loadUserWork(
    type: UserWorkType,
    tabId: string
  ): Promise<unknown> {
    const workData = await db.userWork.where({ type, tabId }).first();

    return workData?.data ?? null;
  }

  // ============================================================================
  // SEQUENCE STATE PERSISTENCE (for hot module replacement survival)
  // ============================================================================

  /**
   * Generate mode-specific localStorage key
   * Each creation mode (Constructor, Generator, Assembler) has its own workspace
   */
  private getSequenceStateKey(mode: string): string {
    // Normalize mode name and create mode-specific key
    const normalizedMode = mode.toLowerCase();
    return `tka-${normalizedMode}-sequence-state-v1`;
  }

  saveCurrentSequenceState(state: {
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection?: string;
  }): Promise<void> {
    try {
      const mode = state.activeBuildSection ?? "construct";
      const storageKey = this.getSequenceStateKey(mode);

      // Use localStorage for immediate persistence that survives hot module replacement
      const stateData = {
        currentSequence: state.currentSequence,
        selectedStartPosition: state.selectedStartPosition,
        hasStartPosition: state.hasStartPosition,
        activeBuildSection: mode,
        timestamp: Date.now(),
      };

      localStorage.setItem(storageKey, JSON.stringify(stateData));
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Failed to save current sequence state:", error);
      throw error;
    }
  }

  async loadCurrentSequenceState(mode?: string): Promise<{
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection?: string;
  } | null> {
    try {
      const targetMode = mode ?? "construct";
      const storageKey = this.getSequenceStateKey(targetMode);
      const stateJson = localStorage.getItem(storageKey);

      if (!stateJson) {
        return null;
      }

      const parsed: unknown = JSON.parse(stateJson);

      // Type guard to validate the parsed data
      if (!this.isValidSequenceState(parsed)) {
        console.warn("❌ Invalid sequence state structure, clearing state");
        await this.clearCurrentSequenceState(targetMode);
        return null;
      }

      // Check if the state is not too old (24 hours max)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (
        typeof parsed.timestamp === "number" &&
        Date.now() - parsed.timestamp > maxAge
      ) {
        await this.clearCurrentSequenceState(targetMode);
        return null;
      }

      return {
        // Use createSequenceData for backwards compatibility (beats -> steps migration)
        currentSequence: parsed.currentSequence
          ? createSequenceData(parsed.currentSequence)
          : null,
        selectedStartPosition: parsed.selectedStartPosition,
        hasStartPosition: parsed.hasStartPosition,
        activeBuildSection: parsed.activeBuildSection ?? targetMode,
      };
    } catch (error) {
      console.error("❌ Failed to load current sequence state:", error);
      return null;
    }
  }

  /**
   * Type guard for sequence state validation
   */
  private isValidSequenceState(obj: unknown): obj is {
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection?: string;
    timestamp?: number;
  } {
    if (!obj || typeof obj !== "object") return false;

    const state = obj as Record<string, unknown>;

    return (
      (state["currentSequence"] === null ||
        typeof state["currentSequence"] === "object") &&
      (state["selectedStartPosition"] === null ||
        typeof state["selectedStartPosition"] === "object") &&
      typeof state["hasStartPosition"] === "boolean"
    );
  }

  clearCurrentSequenceState(mode?: string): Promise<void> {
    try {
      if (mode) {
        // Clear specific mode
        const storageKey = this.getSequenceStateKey(mode);
        localStorage.removeItem(storageKey);
      } else {
        // Clear all modes
        const modes = ["construct", "generate", "assemble"];
        modes.forEach((m) => {
          const storageKey = this.getSequenceStateKey(m);
          localStorage.removeItem(storageKey);
        });
      }
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Failed to clear current sequence state:", error);
      throw error;
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const dexiePersistenceService = new DexiePersistenceService();
