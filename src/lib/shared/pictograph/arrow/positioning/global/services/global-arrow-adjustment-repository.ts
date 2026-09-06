/**
 * Global Arrow Adjustment Repository
 *
 * Coordinates state and persistence for global arrow adjustments.
 * Provides the main interface for the rendering pipeline and UI.
 */

import type { Timestamp } from "firebase/firestore";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { normalizePlacementFrame } from "../../placement/domain/placement-frame";
import {
  generateAdjustmentKeyString,
  parseAdjustmentKeyString,
  type GlobalAdjustmentKey,
  type GlobalArrowAdjustment,
  type GlobalArrowAdjustmentInput,
} from "../domain/global-arrow-adjustment";
import type { CascadingLookupResult } from "./types";
import type { GlobalArrowAdjustmentPersister } from "./global-arrow-adjustment-persister";
import {
  createGlobalArrowAdjustmentState,
  type GlobalArrowAdjustmentState,
} from "../state/global-arrow-adjustment-state.svelte";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { globalAdjustmentVersion } from "../state/global-adjustment-version.svelte";

const logger = createComponentLogger("GlobalArrowAdjustmentRepository");

// Admin email for authorization
const ADMIN_EMAIL = "austencloud@gmail.com";

export class GlobalArrowAdjustmentRepository {
  private readonly state: GlobalArrowAdjustmentState;
  private unsubscribe: (() => void) | null = null;
  private initializePromise: Promise<void> | null = null;

  constructor(private readonly persister: GlobalArrowAdjustmentPersister) {
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

      // Bump version so all rendered pictographs re-prepare with the now-available adjustments.
      // Without this, pictographs that rendered before initialization stay at fallback positions.
      if (adjustments.length > 0) {
        globalAdjustmentVersion.increment();
      }

      this.startSubscription();

      logger.success(`Initialized with ${this.state.count} global adjustments`);
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

  private startSubscription(): void {
    this.unsubscribe = this.persister.subscribe(
      // On add/modify
      (adjustment: GlobalArrowAdjustment) => {
        this.state.setAdjustment(adjustment);
        logger.info(
          `Real-time update: ${generateAdjustmentKeyString({
            placementFrame: adjustment.placementFrame,
            oriKey: adjustment.oriKey,
            letter: adjustment.letter,
            turnsTuple: adjustment.turnsTuple,
            arrowKey: adjustment.arrowKey,
          })}`
        );
      },
      // On remove
      (keyString: string) => {
        const key = parseAdjustmentKeyString(keyString);
        if (key) {
          this.state.removeAdjustment(key);
          logger.info(`Real-time removal: ${keyString}`);
        }
      }
    );
  }

  /**
   * Get adjustment by key components
   * Returns x/y pair if found, null otherwise
   */
  getAdjustment(key: GlobalAdjustmentKey): { x: number; y: number } | null {
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
   * Cascading lookup: Layer 3 → Layer 2 → Layer 1, with orientation fallback.
   *
   * Within each prop-type layer, tries the specific oriKey first (e.g., "counter_counter"),
   * then falls back to the legacy bucket oriKey (e.g., "from_layer2"). This lets new
   * orientation-specific adjustments take priority while old bucket-based entries serve
   * as the general fallback.
   *
   * Non-staff props never fall back to Layer 1. This prevents staff adjustments
   * from bleeding into other prop types when switching props.
   */
  getAdjustmentCascading(
    baseKey: GlobalAdjustmentKey,
    thisPropType: string,
    otherPropType: string,
    legacyOriKey?: string
  ): CascadingLookupResult | null {
    return this.state.getAdjustmentCascading(
      baseKey,
      thisPropType,
      otherPropType,
      legacyOriKey
    );
  }

  /** All loaded adjustments, in the exact shape `state.loadAll` consumes (bundle snapshot). */
  getAll(): GlobalArrowAdjustment[] {
    return this.state.getAllAdjustments();
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

    // Build key with optional prop types
    const key: GlobalAdjustmentKey = {
      placementFrame: normalizePlacementFrame(input.placementFrame),
      oriKey: input.oriKey,
      letter: input.letter,
      turnsTuple: input.turnsTuple,
      arrowKey: input.arrowKey,
      ...(input.propType && { propType: input.propType }),
      ...(input.otherPropType && { otherPropType: input.otherPropType }),
    };
    const keyString = generateAdjustmentKeyString(key);

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
    } as unknown as Timestamp;

    const adjustment: GlobalArrowAdjustment = {
      placementFrame: normalizePlacementFrame(input.placementFrame),
      oriKey: input.oriKey,
      letter: input.letter,
      turnsTuple: input.turnsTuple,
      arrowKey: input.arrowKey,
      ...(input.propType && { propType: input.propType }),
      ...(input.otherPropType && { otherPropType: input.otherPropType }),
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

    // Build key with optional prop types
    const key: GlobalAdjustmentKey = {
      placementFrame: normalizePlacementFrame(input.placementFrame),
      oriKey: input.oriKey,
      letter: input.letter,
      turnsTuple: input.turnsTuple,
      arrowKey: input.arrowKey,
      ...(input.propType && { propType: input.propType }),
      ...(input.otherPropType && { otherPropType: input.otherPropType }),
    };
    const keyString = generateAdjustmentKeyString(key);

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
