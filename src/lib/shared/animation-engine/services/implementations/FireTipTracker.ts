/**
 * FireTipTracker
 *
 * Tracks prop endpoint positions across frames and computes velocity vectors
 * via finite differencing. Reuses objects to avoid GC pressure in the hot path.
 */

import type { PropState } from "../../domain/PropState";
import type { PropTipData } from "../../domain/types/FireTypes";
import type {
  IFireTipTracker,
  FireTipTrackerConfig,
} from "../contracts/IFireTipTracker";
import { PropPositionCalculator } from "./PropPositionCalculator";
import type { PropEndpointConfig } from "../contracts/IPropPositionCalculator";

/** Minimum dt to avoid velocity spikes on first frame or pauses */
const MIN_DT_SECONDS = 1 / 120;

/** Maximum velocity magnitude to clamp physics outliers */
const MAX_SPEED = 5000;

interface StoredTip {
  x: number;
  y: number;
  time: number;
  valid: boolean;
}

function createStoredTip(): StoredTip {
  return { x: 0, y: 0, time: 0, valid: false };
}

export class FireTipTracker implements IFireTipTracker {
  private positionCalculator = new PropPositionCalculator();

  // Previous frame tip positions: [blueLeft, blueRight, redLeft, redRight]
  // Fixed-size, never reallocated.
  private prev0: StoredTip = createStoredTip();
  private prev1: StoredTip = createStoredTip();
  private prev2: StoredTip = createStoredTip();
  private prev3: StoredTip = createStoredTip();

  // Output array reused each frame
  private outputTips: PropTipData[] = [];

  update(
    blueProp: PropState | null,
    redProp: PropState | null,
    config: FireTipTrackerConfig,
    currentTime: number
  ): PropTipData[] {
    this.outputTips.length = 0;
    let tipIndex = 0;

    if (blueProp) {
      const endpointConfig: PropEndpointConfig = {
        canvasSize: config.canvasSize,
        propDimensions: config.bluePropDimensions,
      };
      const endpoints = this.positionCalculator.calculateEndpoints(
        blueProp,
        endpointConfig,
        config.bluePropType
      );

      // Blue left
      this.emitTip(this.prev0, endpoints.left.x, endpoints.left.y, 0, 0, currentTime, tipIndex++);
      // Blue right
      this.emitTip(this.prev1, endpoints.right.x, endpoints.right.y, 0, 1, currentTime, tipIndex++);
    } else {
      this.prev0.valid = false;
      this.prev1.valid = false;
    }

    if (redProp) {
      const endpointConfig: PropEndpointConfig = {
        canvasSize: config.canvasSize,
        propDimensions: config.redPropDimensions,
      };
      const endpoints = this.positionCalculator.calculateEndpoints(
        redProp,
        endpointConfig,
        config.redPropType
      );

      // Red left
      this.emitTip(this.prev2, endpoints.left.x, endpoints.left.y, 1, 0, currentTime, tipIndex++);
      // Red right
      this.emitTip(this.prev3, endpoints.right.x, endpoints.right.y, 1, 1, currentTime, tipIndex++);
    } else {
      this.prev2.valid = false;
      this.prev3.valid = false;
    }

    return this.outputTips;
  }

  reset(): void {
    this.prev0.valid = false;
    this.prev1.valid = false;
    this.prev2.valid = false;
    this.prev3.valid = false;
    this.outputTips.length = 0;
  }

  private emitTip(
    prev: StoredTip,
    x: number,
    y: number,
    propIndex: 0 | 1,
    endType: 0 | 1,
    currentTime: number,
    outputIndex: number
  ): void {
    let velocityX = 0;
    let velocityY = 0;
    let speed = 0;

    if (prev.valid) {
      const dt = Math.max((currentTime - prev.time) / 1000, MIN_DT_SECONDS);
      velocityX = (x - prev.x) / dt;
      velocityY = (y - prev.y) / dt;
      speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

      // Clamp to prevent physics outliers
      if (speed > MAX_SPEED) {
        const scale = MAX_SPEED / speed;
        velocityX *= scale;
        velocityY *= scale;
        speed = MAX_SPEED;
      }
    }

    // Update stored position
    prev.x = x;
    prev.y = y;
    prev.time = currentTime;
    prev.valid = true;

    // Reuse or create output tip
    const existing = this.outputTips[outputIndex];
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.velocityX = velocityX;
      existing.velocityY = velocityY;
      existing.speed = speed;
      existing.propIndex = propIndex;
      existing.endType = endType;
    } else {
      this.outputTips.push({
        x,
        y,
        velocityX,
        velocityY,
        speed,
        propIndex,
        endType,
      });
    }
  }
}
