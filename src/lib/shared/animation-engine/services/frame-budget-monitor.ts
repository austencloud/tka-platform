/**
 * Frame Budget Monitor Implementation
 *
 * Tracks rolling frame times and uses hysteresis-based tier stepping
 * to adaptively change quality without oscillation.
 *
 * Degradation: After N consecutive over-budget frames, drop one tier.
 * Recovery: After M consecutive under-70%-budget frames, raise one tier.
 * Minimum 2 seconds between changes to prevent thrashing.
 */

import type { QualityAdaptationConfig } from "../domain/types/quality-types";
import {
  QualityTier,
  DeviceTier,
  QUALITY_TIER_PARAMS,
  type QualityHints,
} from "../domain/types/quality-types";

const DEFAULT_CONFIG: QualityAdaptationConfig = {
  targetFrameTimeMs: 16.67,
  degradeAfterFrames: 5,
  recoverAfterFrames: 60,
  recoverThreshold: 0.7,
  minTimeBetweenChangesMs: 2000,
};

/** Ordered tiers from lowest to highest quality */
const TIER_ORDER: QualityTier[] = [QualityTier.LOW, QualityTier.MEDIUM, QualityTier.HIGH];

function deviceTierToQualityTier(deviceTier: DeviceTier): QualityTier {
  switch (deviceTier) {
    case DeviceTier.HIGH:
      return QualityTier.HIGH;
    case DeviceTier.MEDIUM:
      return QualityTier.MEDIUM;
    case DeviceTier.LOW:
      return QualityTier.LOW;
  }
}

export class FrameBudgetMonitor {
  private config: QualityAdaptationConfig;
  private currentTier: QualityTier;
  private maxTier: QualityTier;

  // Consecutive frame counters for hysteresis
  private consecutiveOverBudget: number = 0;
  private consecutiveUnderBudget: number = 0;
  private lastTierChangeTime: number = 0;

  // Cached hints object to avoid per-frame allocation
  private cachedHints: QualityHints;

  constructor(
    deviceTier: DeviceTier = DeviceTier.HIGH,
    config: Partial<QualityAdaptationConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentTier = deviceTierToQualityTier(deviceTier);
    this.maxTier = this.currentTier;
    this.cachedHints = this.buildHints();
  }

  beginFrame(): number {
    return performance.now();
  }

  endFrame(startTime: number): void {
    const frameTime = performance.now() - startTime;
    const now = performance.now();

    const overBudget = frameTime > this.config.targetFrameTimeMs;
    const wellUnderBudget =
      frameTime < this.config.targetFrameTimeMs * this.config.recoverThreshold;

    if (overBudget) {
      this.consecutiveOverBudget++;
      this.consecutiveUnderBudget = 0;
    } else if (wellUnderBudget) {
      this.consecutiveUnderBudget++;
      this.consecutiveOverBudget = 0;
    } else {
      // In the acceptable range: reset both counters
      this.consecutiveOverBudget = 0;
      this.consecutiveUnderBudget = 0;
    }

    // Enforce minimum time between changes
    const timeSinceLastChange = now - this.lastTierChangeTime;
    if (timeSinceLastChange < this.config.minTimeBetweenChangesMs) {
      return;
    }

    // Check for degradation
    if (this.consecutiveOverBudget >= this.config.degradeAfterFrames) {
      this.stepDown(now);
    }

    // Check for recovery
    if (this.consecutiveUnderBudget >= this.config.recoverAfterFrames) {
      this.stepUp(now);
    }
  }

  getQualityHints(): QualityHints {
    return this.cachedHints;
  }

  setConfig(config: Partial<QualityAdaptationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.currentTier = this.maxTier;
    this.consecutiveOverBudget = 0;
    this.consecutiveUnderBudget = 0;
    this.lastTierChangeTime = 0;
    this.cachedHints = this.buildHints();
  }

  private stepDown(now: number): void {
    const currentIndex = TIER_ORDER.indexOf(this.currentTier);
    if (currentIndex > 0) {
      this.currentTier = TIER_ORDER[currentIndex - 1]!;
      this.lastTierChangeTime = now;
      this.consecutiveOverBudget = 0;
      this.consecutiveUnderBudget = 0;
      this.cachedHints = this.buildHints();
    }
  }

  private stepUp(now: number): void {
    const currentIndex = TIER_ORDER.indexOf(this.currentTier);
    const maxIndex = TIER_ORDER.indexOf(this.maxTier);
    // Never recover above the device's starting tier
    if (currentIndex < maxIndex) {
      this.currentTier = TIER_ORDER[currentIndex + 1]!;
      this.lastTierChangeTime = now;
      this.consecutiveOverBudget = 0;
      this.consecutiveUnderBudget = 0;
      this.cachedHints = this.buildHints();
    }
  }

  private buildHints(): QualityHints {
    const params = QUALITY_TIER_PARAMS[this.currentTier];
    return {
      tier: this.currentTier,
      ...params,
    };
  }
}
