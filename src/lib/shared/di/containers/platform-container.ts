import { createContainer } from "iti";
import { PlatformDetector as NativePlatformDetector } from "$lib/shared/platform/services/implementations/PlatformDetector";
import { NativeInitializer } from "$lib/shared/platform/services/implementations/NativeInitializer";

export const platformContainer = createContainer()
	.add({
		nativePlatformDetector: () => new NativePlatformDetector(),
	})
	.add((deps) => ({
		nativeInitializer: () => new NativeInitializer(deps.nativePlatformDetector),
	}));

export type PlatformContainerType = typeof platformContainer;
