/**
 * Landing Preview Container - ITI Dependency Injection Configuration
 *
 * Registers services for the video curator feature.
 */

import { createContainer } from "iti";

// Service implementations
import { VideoCuratorLoader } from "$lib/features/landing-preview/services/implementations/VideoCuratorLoader";
import { VideoCuratorPersister } from "$lib/features/landing-preview/services/implementations/VideoCuratorPersister";
import { SequenceMatcher } from "$lib/features/landing-preview/services/implementations/SequenceMatcher";

// Service contracts
import type { IVideoCuratorLoader } from "$lib/features/landing-preview/services/contracts/IVideoCuratorLoader";
import type { IVideoCuratorPersister } from "$lib/features/landing-preview/services/contracts/IVideoCuratorPersister";
import type { ISequenceMatcher } from "$lib/features/landing-preview/services/contracts/ISequenceMatcher";

/**
 * Create the landing-preview container.
 * No external dependencies required - services are self-contained.
 */
export function createLandingPreviewContainer() {
  return createContainer().add({
    videoCuratorLoader: (): IVideoCuratorLoader => new VideoCuratorLoader(),
    videoCuratorPersister: (): IVideoCuratorPersister => new VideoCuratorPersister(),
    sequenceMatcher: (): ISequenceMatcher => new SequenceMatcher(),
  });
}

/**
 * Type representing the landing-preview container instance.
 */
export type LandingPreviewContainer = ReturnType<typeof createLandingPreviewContainer>;
