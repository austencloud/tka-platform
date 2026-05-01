import type { AppSettings } from "../../../settings/domain/AppSettings";
import type { CompleteBrowseState } from "../../../../features/browse/shared/domain/models/browse-models";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { TabId } from "../../../navigation/domain/types";
import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { UserProject } from "../../domain/models/UserProject";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";

export interface IPersistenceService {
  initialize(): Promise<void>;

  isAvailable(): boolean;

  saveSequence(sequence: SequenceData): Promise<void>;

  loadSequence(id: string): Promise<SequenceData | null>;

  Get all sequences (with optional filtering)
  getAllSequences(filter?: {
    author?: string;
    level?: number;
    isFavorite?: boolean;
    tags?: string[];
  }): Promise<SequenceData[]>;

  deleteSequence(id: string): Promise<void>;

  loadAllSequences(): Promise<SequenceData[]>;

  searchSequences(query: string): Promise<SequenceData[]>;

  savePictograph(pictograph: PictographData): Promise<void>;

  loadPictograph(id: string): Promise<PictographData | null>;

  getPictographsByLetter(letter: string): Promise<PictographData[]>;

  getAllPictographs(): Promise<PictographData[]>;

  saveActiveTab(tabId: TabId): Promise<void>;

  getActiveTab(): Promise<TabId | null>;

  saveTabState(tabId: TabId, state: unknown): Promise<void>;

  loadTabState<T = unknown>(tabId: TabId): Promise<T | null>;

  saveBrowseState(state: CompleteBrowseState): Promise<void>;

  loadBrowseState(): Promise<CompleteBrowseState | null>;

  saveSettings(settings: AppSettings): Promise<void>;

  loadSettings(): Promise<AppSettings | null>;

  saveProject(project: UserProject): Promise<void>;

  loadProjects(): Promise<UserProject[]>;

  deleteProject(id: number): Promise<void>;

  exportAllData(): Promise<unknown>;

  importData(data: unknown): Promise<void>;

  clearAllData(): Promise<void>;

  getStorageInfo(): Promise<{
    sequences: number;
    pictographs: number;
    userWork: number;
    projects: number;
    totalSize?: number;
  }>;

  saveCurrentSequenceState(state: {
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection?: string;
  }): Promise<void>;

  /**
   * @param mode - Optional mode to load state for (construct, generator, assembler)
   */
  loadCurrentSequenceState(mode?: string): Promise<{
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection?: string;
  } | null>;

  /**
   * @param mode - Optional mode to clear state for (construct, generator, assembler)
   */
  clearCurrentSequenceState(mode?: string): Promise<void>;
}
