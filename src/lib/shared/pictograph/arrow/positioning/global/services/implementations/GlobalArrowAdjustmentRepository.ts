/**
 * Global Arrow Adjustment Repository
 *
 * Coordinates state and persistence for global arrow adjustments.
 * Provides the main interface for the rendering pipeline and UI.
 */

import { Point } from "fabric";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import {
  generateAdjustmentKeyString,
  parseAdjustmentKeyString,
  type GlobalAdjustmentKey,
  type GlobalArrowAdjustment,
  type GlobalArrowAdjustmentInput,
} from "../../domain/GlobalArrowAdjustment";
import type { IGlobalArrowAdjustmentRepository } from "../contracts/IGlobalArrowAdjustmentRepository";
import type { IGlobalArrowAdjustmentPersister } from "../contracts/IGlobalArrowAdjustmentPersister";
import {
  createGlobalArrowAdjustmentState,
  type GlobalArrowAdjustmentState,
} from "../../state/GlobalArrowAdjustmentState.svelte";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("GlobalArrowAdjustmentRepository");

// Admin email for authorization
const ADMIN_EMAIL = "austencloud@gmail.com";

export class GlobalArrowAdjustmentRepository
  implements IGlobalArrowAdjustmentRepository
{
  private readonly state: GlobalArrowAdjustmentState;
  private unsubscribe: (() => void) | null = null;
  private initializePromise: Promise<void> | null = null;

  constructor(private readonly persister: IGlobalArrowAdjustmentPersister) {
    this.state = createGlobalArrowAdjustmentState();
  }

  /**
   * Check if the repository is initialized
   */
  get isInitialized(): boolean {
    return this.state.isInitialized;
  }

  /**
   * Initialize the repository - load all adjustments and start subscription
   */
  async initialize(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initializePromise) {
      return this.initializePromise;
    }

    // Return immediately if already initialized
    if (this.state.isInitialized) {
      return;
    }

    this.initializePromise = this.doInitialize();
    return this.initializePromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.state.setLoading(true);
      logger.info("Initializing global arrow adjustments...");

      // Load all adjustments from Firestore
      const adjustments = await this.persister.loadAll();
      this.state.loadAll(adjustments);

      // Subscribe to real-time updates
      this.unsubscribe = this.persister.subscribe(
        // On add/modify
        (adjustment: GlobalArrowAdjustment) => {
          this.state.setAdjustment(adjustment);
          logger.info(`Real-time update: ${generateAdjustmentKeyString({
            gridMode: adjustment.gridMode,
            oriKey: adjustment.oriKey,
            letter: adjustment.letter,
            turnsTuple: adjustment.turnsTuple,
            arrowKey: adjustment.arrowKey,
          })}`);
        },
        // On remove
        (keyString: string) => {
          // Parse key string to get components
          const key = parseAdjustmentKeyString(keyString);
          if (key) {
            this.state.removeAdjustment(key);
            logger.info(`Real-time removal: ${keyString}`);
          }
        }
      );

      logger.success(
        `Initialized with ${this.state.count} global adjustments`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to initialize adjustments";
      this.state.setError(message);
      logger.error("Initialization failed:", error);
      throw error;
    } finally {
      this.state.setLoading(false);
      this.initializePromise = null;
    }
  }

  /**
   * Get adjustment by key components
   * Returns Point if found, null otherwise
   */
  getAdjustment(key: GlobalAdjustmentKey): Point | null {
    return this.state.getAdjustment(key);
  }

  /**
   * Get full adjustment data by key
   */
  getFullAdjustment(key: GlobalAdjustmentKey): GlobalArrowAdjustment | null {
    return this.state.getFullAdjustment(key);
  }

  /**
   * Check if an adjustment exists
   */
  hasAdjustment(key: GlobalAdjustmentKey): boolean {
    return this.state.hasAdjustment(key);
  }

  /**
   * Save an adjustment to local cache only (admin only).
   * Use this for live preview during WASD adjustment.
   */
  saveAdjustmentLocal(input: GlobalArrowAdjustmentInput): void {
    // Validate admin
    if (!this.isAdmin()) {
      throw new Error("Only admin can save global arrow adjustments");
    }

    const keyString = generateAdjustmentKeyString({
      gridMode: input.gridMode,
      oriKey: input.oriKey,
      letter: input.letter,
      turnsTuple: input.turnsTuple,
      arrowKey: input.arrowKey,
    });

    logger.info(
      `Saving LOCAL adjustment: ${keyString} → (${input.adjustmentX}, ${input.adjustmentY})`
    );

    // Create a full adjustment object for the state
    // Use a fake Timestamp-like object for local-only adjustments
    const fakeTimestamp = {
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: () => false,
    } as any;

    const adjustment: GlobalArrowAdjustment = {
      gridMode: input.gridMode,
      oriKey: input.oriKey,
      letter: input.letter,
      turnsTuple: input.turnsTuple,
      arrowKey: input.arrowKey,
      adjustmentX: input.adjustmentX,
      adjustmentY: input.adjustmentY,
      updatedAt: fakeTimestamp,
      updatedBy: authState.user?.email ?? "unknown",
    };

    // Save to local state only (no Firestore)
    this.state.setAdjustment(adjustment);
  }

  /**
   * Save an adjustment (admin only)
   * @throws Error if user is not admin
   */
  async saveAdjustment(input: GlobalArrowAdjustmentInput): Promise<void> {
    // Validate admin
    if (!this.isAdmin()) {
      throw new Error("Only admin can save global arrow adjustments");
    }

    const userEmail = authState.user?.email;
    if (!userEmail) {
      throw new Error("User email not available");
    }

    const keyString = generateAdjustmentKeyString({
      gridMode: input.gridMode,
      oriKey: input.oriKey,
      letter: input.letter,
      turnsTuple: input.turnsTuple,
      arrowKey: input.arrowKey,
    });

    logger.info(
      `Saving adjustment to Firestore: ${keyString} → (${input.adjustmentX}, ${input.adjustmentY})`
    );

    // Save to Firestore (real-time subscription will update local state)
    await this.persister.save(input, userEmail);
  }

  /**
   * Delete an adjustment (admin only)
   * @throws Error if user is not admin
   */
  async deleteAdjustment(key: GlobalAdjustmentKey): Promise<void> {
    // Validate admin
    if (!this.isAdmin()) {
      throw new Error("Only admin can delete global arrow adjustments");
    }

    const keyString = generateAdjustmentKeyString(key);
    logger.info(`Deleting adjustment from Firestore: ${keyString}`);

    // Delete from Firestore (real-time subscription will update local state)
    await this.persister.delete(keyString);
  }

  /**
   * Delete an adjustment from local cache only (admin only).
   * Use this for live preview during reset.
   */
  deleteAdjustmentLocal(key: GlobalAdjustmentKey): void {
    // Validate admin
    if (!this.isAdmin()) {
      throw new Error("Only admin can delete global arrow adjustments");
    }

    const keyString = generateAdjustmentKeyString(key);
    logger.info(`Deleting LOCAL adjustment: ${keyString}`);

    // Remove from local state only (no Firestore)
    this.state.removeAdjustment(key);
  }

  /**
   * Check if the current user is an admin
   */
  isAdmin(): boolean {
    const userEmail = authState.user?.email;
    return userEmail === ADMIN_EMAIL;
  }

  /**
   * Dispose of resources (unsubscribe from Firestore)
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.state.clear();
    logger.info("Disposed");
  }
}
