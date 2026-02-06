/**
 * Train Container - ITI Dependency Container
 *
 * Provides all hand detection and training services for the Train feature.
 * Uses factory functions instead of decorators for HMR-friendly DI.
 */

import { createContainer } from "iti";

// Service implementations
import { HandLandmarker } from "$lib/features/train/services/implementations/HandLandmarker";
import { HandednessAnalyzer } from "$lib/features/train/services/implementations/HandednessAnalyzer";
import { HandStateAnalyzer } from "$lib/features/train/services/implementations/HandStateAnalyzer";
import { HandTrackingStabilizer } from "$lib/features/train/services/implementations/HandTrackingStabilizer";
import { HandAssigner } from "$lib/features/train/services/implementations/HandAssigner";
import { MediaPipeDetector } from "$lib/features/train/services/implementations/MediaPipeDetector";
import { CameraManager } from "$lib/features/train/services/implementations/CameraManager";
import { VoiceCommandHandler } from "$lib/features/train/services/implementations/VoiceCommandHandler";
import { PerformanceHistoryTracker } from "$lib/features/train/services/implementations/PerformanceHistoryTracker";
import { TrainChallengeManager } from "$lib/features/train/services/implementations/TrainChallengeManager";
import { SessionCompletionProcessor } from "$lib/features/train/services/implementations/SessionCompletionProcessor";

// Contract types for external dependencies
import type { IAchievementManager } from "$lib/shared/gamification/services/contracts/IAchievementManager";

// Contract types for exports
import type { IHandLandmarker } from "$lib/features/train/services/contracts/IHandLandmarker";
import type { IHandednessAnalyzer } from "$lib/features/train/services/contracts/IHandednessAnalyzer";
import type { IHandStateAnalyzer } from "$lib/features/train/services/contracts/IHandStateAnalyzer";
import type { IHandTrackingStabilizer } from "$lib/features/train/services/contracts/IHandTrackingStabilizer";
import type { IHandAssigner } from "$lib/features/train/services/contracts/IHandAssigner";
import type { IPositionDetector } from "$lib/features/train/services/contracts/IPositionDetector";
import type { ICameraManager } from "$lib/features/train/services/contracts/ICameraManager";
import type { IVoiceCommandHandler } from "$lib/features/train/services/contracts/IVoiceCommandHandler";
import type { IPerformanceHistoryTracker } from "$lib/features/train/services/contracts/IPerformanceHistoryTracker";
import type { ITrainChallengeManager } from "$lib/features/train/services/contracts/ITrainChallengeManager";
import type { ISessionCompletionProcessor } from "$lib/features/train/services/contracts/ISessionCompletionProcessor";

/**
 * Creates the train container with external dependencies.
 *
 * @param achievementManager - The achievement manager from the gamification container
 * @returns The fully configured train container
 */
export function createTrainContainer(achievementManager: IAchievementManager) {
  // Singleton instances for services that need to maintain state
  let handLandmarkerInstance: HandLandmarker | null = null;
  let handednessAnalyzerInstance: HandednessAnalyzer | null = null;
  let handStateAnalyzerInstance: HandStateAnalyzer | null = null;
  let handTrackingStabilizerInstance: HandTrackingStabilizer | null = null;
  let handAssignerInstance: HandAssigner | null = null;
  let positionDetectorInstance: MediaPipeDetector | null = null;
  let cameraManagerInstance: CameraManager | null = null;
  let voiceCommandHandlerInstance: VoiceCommandHandler | null = null;
  let performanceHistoryTrackerInstance: PerformanceHistoryTracker | null =
    null;
  let trainChallengeManagerInstance: TrainChallengeManager | null = null;
  let sessionCompletionProcessorInstance: SessionCompletionProcessor | null =
    null;

  return createContainer()
    .add({
      // === HAND DETECTION SERVICES (no dependencies) ===
      handLandmarker: (): IHandLandmarker => {
        if (!handLandmarkerInstance) {
          handLandmarkerInstance = new HandLandmarker();
        }
        return handLandmarkerInstance;
      },

      handednessAnalyzer: (): IHandednessAnalyzer => {
        if (!handednessAnalyzerInstance) {
          handednessAnalyzerInstance = new HandednessAnalyzer();
        }
        return handednessAnalyzerInstance;
      },

      handStateAnalyzer: (): IHandStateAnalyzer => {
        if (!handStateAnalyzerInstance) {
          handStateAnalyzerInstance = new HandStateAnalyzer();
        }
        return handStateAnalyzerInstance;
      },

      handTrackingStabilizer: (): IHandTrackingStabilizer => {
        if (!handTrackingStabilizerInstance) {
          handTrackingStabilizerInstance = new HandTrackingStabilizer();
        }
        return handTrackingStabilizerInstance;
      },

      // === CAMERA SERVICE (no dependencies) ===
      cameraManager: (): ICameraManager => {
        if (!cameraManagerInstance) {
          cameraManagerInstance = new CameraManager();
        }
        return cameraManagerInstance;
      },

      // === PRACTICE SERVICES (no dependencies) ===
      voiceCommandHandler: (): IVoiceCommandHandler => {
        if (!voiceCommandHandlerInstance) {
          voiceCommandHandlerInstance = new VoiceCommandHandler();
        }
        return voiceCommandHandlerInstance;
      },

      // === PROGRESS SERVICES (no dependencies) ===
      performanceHistoryTracker: (): IPerformanceHistoryTracker => {
        if (!performanceHistoryTrackerInstance) {
          performanceHistoryTrackerInstance = new PerformanceHistoryTracker();
        }
        return performanceHistoryTrackerInstance;
      },
    })
    .add((ctx) => ({
      // === SERVICES WITH DEPENDENCIES (Layer 1) ===

      // HandAssigner depends on HandTrackingStabilizer
      handAssigner: (): IHandAssigner => {
        if (!handAssignerInstance) {
          handAssignerInstance = new HandAssigner(ctx.handTrackingStabilizer);
        }
        return handAssignerInstance;
      },

      // MediaPipeDetector depends on multiple services
      positionDetector: (): IPositionDetector => {
        if (!positionDetectorInstance) {
          positionDetectorInstance = new MediaPipeDetector(
            ctx.handLandmarker,
            ctx.handednessAnalyzer,
            ctx.handStateAnalyzer,
            ctx.handTrackingStabilizer
          );
        }
        return positionDetectorInstance;
      },

      // TrainChallengeManager depends on external IAchievementManager
      trainChallengeManager: (): ITrainChallengeManager => {
        if (!trainChallengeManagerInstance) {
          trainChallengeManagerInstance = new TrainChallengeManager(
            achievementManager
          );
        }
        return trainChallengeManagerInstance;
      },
    }))
    .add((ctx) => ({
      // === SERVICES WITH DEPENDENCIES (Layer 2 - depends on trainChallengeManager) ===

      // SessionCompletionProcessor depends on history, achievements, and challenges
      sessionCompletionProcessor: (): ISessionCompletionProcessor => {
        if (!sessionCompletionProcessorInstance) {
          sessionCompletionProcessorInstance = new SessionCompletionProcessor(
            ctx.performanceHistoryTracker,
            achievementManager,
            ctx.trainChallengeManager
          );
        }
        return sessionCompletionProcessorInstance;
      },
    }));
}

// Type for the container
export type TrainContainer = ReturnType<typeof createTrainContainer>;
