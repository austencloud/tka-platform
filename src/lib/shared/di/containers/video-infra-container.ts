import { createContainer } from "iti";
import { VideoSourceProvider } from "$lib/shared/video/services/implementations/VideoSourceProvider";
import { TrainingDataStore } from "$lib/shared/video/services/implementations/TrainingDataStore";
import { FrameExtractor } from "$lib/shared/video/services/implementations/FrameExtractor";

export const videoInfraContainer = createContainer().add({
	videoSourceProvider: () => new VideoSourceProvider(),
	trainingDataStore: () => new TrainingDataStore(),
	frameExtractor: () => new FrameExtractor(),
});

export type VideoInfraContainer = typeof videoInfraContainer;
