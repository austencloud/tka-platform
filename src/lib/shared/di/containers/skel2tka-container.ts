/**
 * Skel2TKA Container - ITI Dependency Container
 *
 * Provides video-to-TKA analysis services for the Skel2TKA Lab.
 * Uses its own ImageModeHandLandmarker (not the train module's VIDEO mode
 * singleton) to avoid timestamp conflicts and running mode mismatches.
 */

import { createContainer } from "iti";

import { VideoFrameExtractor } from "$lib/features/skel2tka/services/implementations/VideoFrameExtractor";
import { VideoHandAnalyzer } from "$lib/features/skel2tka/services/implementations/VideoHandAnalyzer";
import { BeatBoundaryDetector } from "$lib/features/skel2tka/services/implementations/BeatBoundaryDetector";
import { ImageModeHandLandmarker } from "$lib/features/skel2tka/services/implementations/ImageModeHandLandmarker";
import { Phase1OverlayRenderer } from "$lib/features/skel2tka/services/implementations/Phase1OverlayRenderer";
import { SanityChecker } from "$lib/features/skel2tka/services/implementations/SanityChecker";
import { TrainingDataPersister } from "$lib/features/skel2tka/services/implementations/TrainingDataPersister";

import type { IVideoFrameExtractor } from "$lib/features/skel2tka/services/contracts/IVideoFrameExtractor";
import type { IVideoHandAnalyzer } from "$lib/features/skel2tka/services/contracts/IVideoHandAnalyzer";
import type { IBeatBoundaryDetector } from "$lib/features/skel2tka/services/contracts/IBeatBoundaryDetector";
import type { IImageModeHandLandmarker } from "$lib/features/skel2tka/services/contracts/IImageModeHandLandmarker";
import type { IOverlayRenderer } from "$lib/features/skel2tka/services/contracts/IOverlayRenderer";
import type { ISanityChecker } from "$lib/features/skel2tka/services/contracts/ISanityChecker";
import type { ITrainingDataPersister } from "$lib/features/skel2tka/services/contracts/ITrainingDataPersister";

/**
 * Creates the skel2tka container. No external dependencies —
 * owns its own MediaPipe instance in IMAGE mode.
 */
export function createSkel2TKAContainer() {
  let landmarkerInstance: ImageModeHandLandmarker | null = null;
  let frameExtractorInstance: VideoFrameExtractor | null = null;
  let handAnalyzerInstance: VideoHandAnalyzer | null = null;
  let beatDetectorInstance: BeatBoundaryDetector | null = null;
  let phase1OverlayInstance: Phase1OverlayRenderer | null = null;
  let sanityCheckerInstance: SanityChecker | null = null;
  let trainingDataPersisterInstance: TrainingDataPersister | null = null;

  return createContainer().add({
    imageModeHandLandmarker: (): IImageModeHandLandmarker => {
      if (!landmarkerInstance) {
        landmarkerInstance = new ImageModeHandLandmarker();
      }
      return landmarkerInstance;
    },

    videoFrameExtractor: (): IVideoFrameExtractor => {
      if (!frameExtractorInstance) {
        frameExtractorInstance = new VideoFrameExtractor();
      }
      return frameExtractorInstance;
    },

    videoHandAnalyzer: (): IVideoHandAnalyzer => {
      if (!handAnalyzerInstance) {
        if (!landmarkerInstance) {
          landmarkerInstance = new ImageModeHandLandmarker();
        }
        handAnalyzerInstance = new VideoHandAnalyzer(landmarkerInstance);
      }
      return handAnalyzerInstance;
    },

    beatBoundaryDetector: (): IBeatBoundaryDetector => {
      if (!beatDetectorInstance) {
        beatDetectorInstance = new BeatBoundaryDetector();
      }
      return beatDetectorInstance;
    },

    phase1OverlayRenderer: (): IOverlayRenderer => {
      if (!phase1OverlayInstance) {
        phase1OverlayInstance = new Phase1OverlayRenderer();
      }
      return phase1OverlayInstance;
    },

    sanityChecker: (): ISanityChecker => {
      if (!sanityCheckerInstance) {
        sanityCheckerInstance = new SanityChecker();
      }
      return sanityCheckerInstance;
    },

    trainingDataPersister: (): ITrainingDataPersister => {
      if (!trainingDataPersisterInstance) {
        trainingDataPersisterInstance = new TrainingDataPersister();
      }
      return trainingDataPersisterInstance;
    },
  });
}

export type Skel2TKAContainer = ReturnType<typeof createSkel2TKAContainer>;
