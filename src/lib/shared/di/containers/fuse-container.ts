/**
 * Fuse Module DI Container
 *
 * Services for merging two hand paths or solo props into a combined sequence,
 * and the assembly animation that plays during the fuse transition.
 */

import { createContainer } from "iti";
import { SequenceFuser } from "$lib/features/fuse/services/implementations/SequenceFuser";
import { HandPathLoopDetector } from "$lib/features/fuse/services/implementations/HandPathLoopDetector";

export const fuseContainer = createContainer().add({
	sequenceFuser: () => new SequenceFuser(),
	handPathLoopDetector: () => new HandPathLoopDetector(),
});

export type FuseContainer = typeof fuseContainer;
