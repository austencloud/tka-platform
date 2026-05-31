/**
 * Prop Geometry Adjustment Repository
 *
 * Coordinates state and persistence for prop geometry adjustments.
 * Mirrors GlobalArrowAdjustmentRepository but for the letter-free tier.
 */

import {
  generatePropGeometryKeyString,
  parsePropGeometryKeyString,
  type PropGeometryAdjustment,
  type PropGeometryAdjustmentInput,
  type PropGeometryKey,
} from "../domain/PropGeometryAdjustment";
import type { CascadingPropGeometryResult } from "./types";
import type { PropGeometryAdjustmentPersister } from "./prop-geometry-adjustment-persister";
import {
  createPropGeometryAdjustmentState,
  type PropGeometryAdjustmentState,
} from "../state/PropGeometryAdjustmentState.svelte";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import type { Timestamp } from "firebase/firestore";

const logger = createComponentLogger("PropGeometryAdjustmentRepository");
const ADMIN_EMAIL = "austencloud@gmail.com";

export class PropGeometryAdjustmentRepository {
  private readonly state: PropGeometryAdjustmentState;
  private unsubscribe: (() => void) | null = null;
  private initializePromise: Promise<void> | null = null;

  constructor(private readonly persister: PropGeometryAdjustmentPersister) {
    this.state = createPropGeometryAdjustmentState();
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
      logger.info("Initializing prop geometry adjustments...");

      const adjustments = await this.persister.loadAll();
      this.state.loadAll(adjustments);

      this.unsubscribe = this.persister.subscribe(
        (adjustment: PropGeometryAdjustment) => {
          this.state.setAdjustment(adjustment);
          logger.info(
            `Real-time update: ${generatePropGeometryKeyString({
              gridMode: adjustment.gridMode,
              propType: adjustment.propType,
              otherPropType: adjustment.otherPropType,
              positionType: adjustment.positionType,
              endOrientation: adjustment.endOrientation,
              otherEndOrientation: adjustment.otherEndOrientation,
              motionType: adjustment.motionType,
              turns: adjustment.turns,
              arrowColor: adjustment.arrowColor,
            })}`
          );
        },
        (keyString: string) => {
          const key = parsePropGeometryKeyString(keyString);
          if (key) {
            this.state.removeAdjustment(key);
            logger.info(`Real-time removal: ${keyString}`);
          }
        }
      );

      logger.success(
        `Initialized with ${this.state.count} prop geometry adjustments`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to initialize prop geometry adjustments";
      this.state.setError(message);
      logger.error("Initialization failed:", error);
    } finally {
      this.state.setLoading(false);
      this.initializePromise = null;
    }
  }

  getAdjustmentCascading(
    key: PropGeometryKey
  ): CascadingPropGeometryResult | null {
    return this.state.getAdjustmentCascading(key);
  }

  /** Exact (non-cascading) lookup. */
  getAdjustment(key: PropGeometryKey): { x: number; y: number } | null {
    return this.state.getAdjustment(key);
  }

  /** All loaded adjustments, in the exact shape `state.loadAll` consumes (bundle snapshot). */
  getAll(): PropGeometryAdjustment[] {
    return this.state.getAllAdjustments();
  }

  hasAdjustment(key: PropGeometryKey): boolean {
    return this.state.hasAdjustment(key);
  }

  /** In-memory only — live WASD preview before persisting (admin only). */
  saveAdjustmentLocal(input: PropGeometryAdjustmentInput): void {
    if (!this.isAdmin()) {
      throw new Error("Only admin can save prop geometry adjustments");
    }
    const fakeTimestamp = {
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: () => false,
    } as unknown as Timestamp;

    this.state.setAdjustment({
      gridMode: input.gridMode,
      propType: input.propType,
      otherPropType: input.otherPropType,
      positionType: input.positionType,
      endOrientation: input.endOrientation,
      otherEndOrientation: input.otherEndOrientation,
      motionType: input.motionType,
      turns: input.turns,
      arrowColor: input.arrowColor,
      adjustmentX: input.adjustmentX,
      adjustmentY: input.adjustmentY,
      updatedAt: fakeTimestamp,
      updatedBy: authState.user?.email ?? "unknown",
    });
  }

  /** In-memory only — revert preview (admin only). */
  deleteAdjustmentLocal(key: PropGeometryKey): void {
    if (!this.isAdmin()) {
      throw new Error("Only admin can delete prop geometry adjustments");
    }
    this.state.removeAdjustment(key);
  }

  /** Persist a delete (admin only). */
  async deleteAdjustment(key: PropGeometryKey): Promise<void> {
    if (!this.isAdmin()) {
      throw new Error("Only admin can delete prop geometry adjustments");
    }
    await this.persister.delete(generatePropGeometryKeyString(key));
  }

  async saveAdjustment(input: PropGeometryAdjustmentInput): Promise<void> {
    if (!this.isAdmin()) {
      throw new Error("Only admin can save prop geometry adjustments");
    }

    const userEmail = authState.user?.email;
    if (!userEmail) {
      throw new Error("User email not available");
    }

    await this.persister.save(input, userEmail);
  }

  private isAdmin(): boolean {
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
