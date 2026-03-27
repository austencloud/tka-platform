import { createContainer } from "iti";
import { LedThresholdDetector } from "$lib/features/video/video-trails/services/implementations/LedThresholdDetector";
import { ColorEndpointDetector } from "$lib/features/video/video-trails/services/implementations/ColorEndpointDetector";
import { VideoTipAdapter } from "$lib/features/video/video-trails/services/implementations/VideoTipAdapter";
import { DetectionCorrector } from "$lib/features/video/video-trails/services/implementations/DetectionCorrector";
import { VideoTrailsRepository } from "$lib/features/video/video-trails/services/implementations/VideoTrailsRepository";
import { VideoTrailsExporter } from "$lib/features/video/video-trails/services/implementations/VideoTrailsExporter";
import { EffectConfigMapper } from "$lib/features/video/video-trails/services/implementations/EffectConfigMapper";

export const videoTrailsContainer = createContainer()
	.add({
		ledThresholdDetector: () => new LedThresholdDetector(),
		colorEndpointDetector: () => new ColorEndpointDetector(),
		videoTipAdapter: () => new VideoTipAdapter(),
		detectionCorrector: () => new DetectionCorrector(),
		videoTrailsRepository: () => new VideoTrailsRepository(),
		videoTrailsExporter: () => new VideoTrailsExporter(),
		effectConfigMapper: () => new EffectConfigMapper(),
	});

export type VideoTrailsContainer = typeof videoTrailsContainer;
