import type { WebGLRenderer } from "three";

import { QualityTier, TIER_CONFIGS } from "../effects/types";
import type { QualityTierConfig } from "../effects/types";
import type { QualityTierDetector } from "../effects/quality/quality-tier-detector";

interface AdaptiveQualityLevel {
  tier: QualityTier;
  maxPixelRatio: number;
}

interface AdaptiveQualityOptions {
  devicePixelRatio?: number;
  userAgent?: string;
}

const QUALITY_LEVELS: readonly AdaptiveQualityLevel[] = [
  { tier: QualityTier.LOW, maxPixelRatio: 0.5 },
  { tier: QualityTier.LOW, maxPixelRatio: 1 },
  { tier: QualityTier.MEDIUM, maxPixelRatio: 1.25 },
  { tier: QualityTier.MEDIUM, maxPixelRatio: 1.5 },
  { tier: QualityTier.HIGH, maxPixelRatio: 2 },
];

const INITIAL_LEVEL: Record<QualityTier, number> = {
  [QualityTier.LOW]: 1,
  [QualityTier.MEDIUM]: 2,
  [QualityTier.HIGH]: 4,
};

const MAX_LEVEL: Record<QualityTier, number> = {
  [QualityTier.LOW]: 2,
  [QualityTier.MEDIUM]: 3,
  [QualityTier.HIGH]: 4,
};

const SAMPLE_SECONDS = 0.25;
const SLOW_FPS = 50;
const SEVERELY_SLOW_FPS = 35;
const HEALTHY_FPS = 57;
const DOWNGRADE_SAMPLES = 8;
const DOWNGRADE_VOTES = 6;
const SEVERE_SAMPLES = 4;
const SEVERE_VOTES = 3;
const UPGRADE_SAMPLES = 24;
const UPGRADE_VOTES = 21;
const SEVERE_RECOVERY_DELAY_SECONDS = 60;
const SUSTAINED_RECOVERY_DELAY_SECONDS = 15;

function isMobileUserAgent(userAgent: string): boolean {
  return /Mobi|Android|iPhone|iPad/i.test(userAgent);
}

export function createAdaptiveQualityState(
  detector: QualityTierDetector,
  options: AdaptiveQualityOptions = {}
) {
  const nativePixelRatio = Math.max(
    1,
    options.devicePixelRatio ??
      (typeof window === "undefined" ? 1 : window.devicePixelRatio)
  );
  const userAgent =
    options.userAgent ??
    (typeof navigator === "undefined" ? "" : navigator.userAgent);

  const initialTier =
    !detector.hasOverride && isMobileUserAgent(userAgent)
      ? QualityTier.LOW
      : detector.currentTier;

  let levelIndex = $state(INITIAL_LEVEL[initialTier]);
  let maximumLevel = $state(MAX_LEVEL[initialTier]);
  let fps = $state(0);
  let initialized = $state(false);

  let sampleElapsed = 0;
  let sampleFrames = 0;
  let recentSamples: number[] = [];
  let baselineReported = false;
  let upgradeDelaySeconds = 0;

  function resetSamples(): void {
    sampleElapsed = 0;
    sampleFrames = 0;
    recentSamples = [];
  }

  function setLevel(nextLevel: number, reason: string): void {
    const clamped = Math.max(0, Math.min(maximumLevel, nextLevel));
    if (clamped === levelIndex) return;

    levelIndex = clamped;
    resetSamples();

    const level = QUALITY_LEVELS[levelIndex]!;
    console.info(
      `[AdaptiveQuality] ${reason}: ${level.tier} at ${Math.min(nativePixelRatio, level.maxPixelRatio).toFixed(2)} DPR (${fps} fps)`
    );
  }

  function initialize(renderer: WebGLRenderer): void {
    const detectedTier = detector.detectFromRenderer(renderer);
    levelIndex = INITIAL_LEVEL[detectedTier];
    maximumLevel = detector.hasOverride ? levelIndex : MAX_LEVEL[detectedTier];
    initialized = true;
    baselineReported = false;
    resetSamples();

    const level = QUALITY_LEVELS[levelIndex]!;
    console.info(
      `[AdaptiveQuality] initialized: ${level.tier} at ${Math.min(nativePixelRatio, level.maxPixelRatio).toFixed(2)} DPR`
    );
  }

  function evaluateSamples(): void {
    if (detector.hasOverride) return;

    const severeWindow = recentSamples.slice(-SEVERE_SAMPLES);
    if (
      severeWindow.length === SEVERE_SAMPLES &&
      severeWindow.filter((sample) => sample < SEVERELY_SLOW_FPS).length >=
        SEVERE_VOTES
    ) {
      // A failed quality probe should not come back six seconds later and tank
      // the same scene again. Give the phone time to cool before retrying it.
      upgradeDelaySeconds = Math.max(
        upgradeDelaySeconds,
        SEVERE_RECOVERY_DELAY_SECONDS
      );
      setLevel(levelIndex - 2, "severe frame pressure");
      return;
    }

    const downgradeWindow = recentSamples.slice(-DOWNGRADE_SAMPLES);
    if (
      downgradeWindow.length === DOWNGRADE_SAMPLES &&
      downgradeWindow.filter((sample) => sample < SLOW_FPS).length >=
        DOWNGRADE_VOTES
    ) {
      upgradeDelaySeconds = Math.max(
        upgradeDelaySeconds,
        SUSTAINED_RECOVERY_DELAY_SECONDS
      );
      setLevel(levelIndex - 1, "sustained frame pressure");
      return;
    }

    const upgradeWindow = recentSamples.slice(-UPGRADE_SAMPLES);
    if (
      upgradeDelaySeconds <= 0 &&
      levelIndex < maximumLevel &&
      upgradeWindow.length === UPGRADE_SAMPLES &&
      upgradeWindow.filter((sample) => sample >= HEALTHY_FPS).length >=
        UPGRADE_VOTES
    ) {
      setLevel(levelIndex + 1, "sustained frame headroom");
      return;
    }

    if (!baselineReported && recentSamples.length >= DOWNGRADE_SAMPLES) {
      const average = Math.round(
        recentSamples.reduce((sum, sample) => sum + sample, 0) /
          recentSamples.length
      );
      baselineReported = true;
      console.info(
        `[AdaptiveQuality] stable baseline: ${average} fps at level ${levelIndex}`
      );
    }
  }

  function observeFrame(deltaSeconds: number, active: boolean): void {
    if (!active || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      resetSamples();
      return;
    }

    // A background/resume gap is not a rendering-quality signal. Browser
    // visibility normally filters it, and this catches the remaining cases.
    if (deltaSeconds > 1) {
      resetSamples();
      return;
    }

    upgradeDelaySeconds = Math.max(0, upgradeDelaySeconds - deltaSeconds);
    sampleElapsed += deltaSeconds;
    sampleFrames += 1;
    if (sampleElapsed + 1e-6 < SAMPLE_SECONDS) return;

    fps = Math.round(sampleFrames / sampleElapsed);
    recentSamples.push(fps);
    if (recentSamples.length > UPGRADE_SAMPLES) recentSamples.shift();

    sampleElapsed = 0;
    sampleFrames = 0;
    evaluateSamples();
  }

  return {
    initialize,
    observeFrame,
    get initialized(): boolean {
      return initialized;
    },
    get fps(): number {
      return fps;
    },
    get tier(): QualityTier {
      return QUALITY_LEVELS[levelIndex]!.tier;
    },
    get config(): QualityTierConfig {
      return TIER_CONFIGS[QUALITY_LEVELS[levelIndex]!.tier];
    },
    get pixelRatio(): number {
      return Math.min(
        nativePixelRatio,
        QUALITY_LEVELS[levelIndex]!.maxPixelRatio
      );
    },
    get level(): number {
      return levelIndex;
    },
  };
}

export type AdaptiveQualityState = ReturnType<
  typeof createAdaptiveQualityState
>;
