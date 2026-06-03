import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import type { DefaultArrowPlacementDoc, PlacementValue } from "../domain/default-arrow-placement";
import type { DefaultArrowPlacementPersister } from "./default-arrow-placement-persister";
import {
  createDefaultArrowPlacementState,
  type DefaultArrowPlacementState,
} from "../state/default-arrow-placement-state.svelte";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { globalAdjustmentVersion } from "../../global/state/global-adjustment-version.svelte";

const logger = createComponentLogger("DefaultArrowPlacementRepository");
const ADMIN_EMAIL = "austencloud@gmail.com";

export class DefaultArrowPlacementRepository {
  private readonly state: DefaultArrowPlacementState;
  private unsubscribe: (() => void) | null = null;
  private initializePromise: Promise<void> | null = null;

  constructor(private readonly persister: DefaultArrowPlacementPersister) {
    this.state = createDefaultArrowPlacementState();
  }

  get isInitialized(): boolean {
    return this.state.isInitialized;
  }

  async initialize(): Promise<void> {
    if (this.initializePromise) return this.initializePromise;
    if (this.state.isInitialized) return;
    this.initializePromise = this.doInitialize();
    return this.initializePromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.state.setLoading(true);
      logger.info("Initializing default placement overrides...");

      const docs = await this.persister.loadAll();
      this.state.loadAll(docs);

      if (docs.length > 0) {
        globalAdjustmentVersion.increment();
      }

      this.unsubscribe = this.persister.subscribe((doc) => {
        this.state.setDoc(doc);
        globalAdjustmentVersion.increment();
        logger.info(`Real-time update: ${doc.id}`);
      });

      logger.success(`Initialized with ${this.state.count} default placement docs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize";
      this.state.setError(message);
      logger.error("Initialization failed:", error);
      throw error;
    } finally {
      this.state.setLoading(false);
      this.initializePromise = null;
    }
  }

  /** Firestore-first base value, or null when no override exists (resolver consumes this). */
  getValue(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): PlacementValue | null {
    return this.state.getValue(gridMode, propType, motionType, placementKey, turns);
  }

  /** All loaded docs, in the exact shape `state.loadAll` consumes (bundle snapshot). */
  getAll(): DefaultArrowPlacementDoc[] {
    return this.state.getAllDocs();
  }

  hasValue(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): boolean {
    return this.state.getValue(gridMode, propType, motionType, placementKey, turns) !== null;
  }

  /** In-memory live preview during WASD (admin only). */
  saveDefaultLocal(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
    value: PlacementValue,
  ): void {
    this.state.setValue(
      gridMode,
      propType,
      motionType,
      placementKey,
      turns,
      value,
      authState.user?.email ?? "unknown",
    );
  }

  /** In-memory revert preview (admin only). */
  deleteDefaultLocal(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): void {
    this.state.removeValue(gridMode, propType, motionType, placementKey, turns);
  }

  /** Persist a single base value (admin only). */
  async saveDefault(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
    value: PlacementValue,
  ): Promise<void> {
    const email = authState.user?.email;
    if (email !== ADMIN_EMAIL) {
      throw new Error("Only admin can save default placement overrides");
    }
    await this.persister.saveValue(gridMode, propType, motionType, placementKey, turns, value, email);
  }

  /** Persist a single delete (admin only). */
  async deleteDefault(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): Promise<void> {
    const email = authState.user?.email;
    if (email !== ADMIN_EMAIL) {
      throw new Error("Only admin can delete default placement overrides");
    }
    await this.persister.deleteValue(gridMode, propType, motionType, placementKey, turns);
    this.state.removeValue(gridMode, propType, motionType, placementKey, turns);
  }

  isAdmin(): boolean {
    return authState.user?.email === ADMIN_EMAIL;
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.state.clear();
    logger.info("Disposed");
  }
}
