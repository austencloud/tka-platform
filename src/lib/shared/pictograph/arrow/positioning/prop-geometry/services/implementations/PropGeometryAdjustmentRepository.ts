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
} from "../../domain/PropGeometryAdjustment";
import type {
  IPropGeometryAdjustmentRepository,
  CascadingPropGeometryResult,
} from "../contracts/IPropGeometryAdjustmentRepository";
import type { PropGeometryAdjustmentPersister } from "./PropGeometryAdjustmentPersister";
import {
  createPropGeometryAdjustmentState,
  type PropGeometryAdjustmentState,
} from "../../state/PropGeometryAdjustmentState.svelte";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("PropGeometryAdjustmentRepository");
const ADMIN_EMAIL = "austencloud@gmail.com";

export class PropGeometryAdjustmentRepository
  implements IPropGeometryAdjustmentRepository
{
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
