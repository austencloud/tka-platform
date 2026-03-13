import { createContainer } from "iti";
import { ContentHasher } from "$lib/shared/foundation/services/implementations/ContentHasher";
import { HandPathFactory } from "$lib/shared/foundation/services/implementations/HandPathFactory";
import { SoloPropFactory } from "$lib/shared/foundation/services/implementations/SoloPropFactory";
import { StepDeriver } from "$lib/shared/foundation/services/implementations/StepDeriver";
import { SequenceDecomposer } from "$lib/shared/foundation/services/implementations/SequenceDecomposer";

const contentHasher = new ContentHasher();
const handPathFactory = new HandPathFactory(contentHasher);
const soloPropFactory = new SoloPropFactory(handPathFactory, contentHasher);
const stepDeriver = new StepDeriver();
const sequenceDecomposer = new SequenceDecomposer(soloPropFactory);

export const compositionContainer = createContainer()
	.add({ contentHasher: () => contentHasher })
	.add({ handPathFactory: () => handPathFactory })
	.add({ soloPropFactory: () => soloPropFactory })
	.add({ stepDeriver: () => stepDeriver })
	.add({ sequenceDecomposer: () => sequenceDecomposer });

export type CompositionContainer = typeof compositionContainer;
