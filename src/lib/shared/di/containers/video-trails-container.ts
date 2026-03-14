import { createContainer } from "iti";
import { LedThresholdDetector } from "$lib/features/lab/tabs/video-trails/services/implementations/LedThresholdDetector";
import { VideoTipAdapter } from "$lib/features/lab/tabs/video-trails/services/implementations/VideoTipAdapter";
import { DetectionCorrector } from "$lib/features/lab/tabs/video-trails/services/implementations/DetectionCorrector";
import { VideoTrailsRepository } from "$lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsRepository";
import { VideoTrailsExporter } from "$lib/features/lab/tabs/video-trails/services/implementations/VideoTrailsExporter";

export const videoTrailsContainer = createContainer()
	.add({
		ledThresholdDetector: () => new LedThresholdDetector(),
		videoTipAdapter: () => new VideoTipAdapter(),
		detectionCorrector: () => new DetectionCorrector(),
		videoTrailsRepository: () => new VideoTrailsRepository(),
		videoTrailsExporter: () => new VideoTrailsExporter(),
	});

export type VideoTrailsContainer = typeof videoTrailsContainer;
