import { createContainer } from "iti";
import { ContentHasher } from "$lib/shared/foundation/services/implementations/ContentHasher";
import { HandPathFactory } from "$lib/shared/foundation/services/implementations/HandPathFactory";
import { HandPathNamer } from "$lib/shared/foundation/services/implementations/HandPathNamer";
import { SoloPropFactory } from "$lib/shared/foundation/services/implementations/SoloPropFactory";
import { StepDeriver } from "$lib/shared/foundation/services/implementations/StepDeriver";
import { SequenceDecomposer } from "$lib/shared/foundation/services/implementations/SequenceDecomposer";
import { SequenceHydrator } from "$lib/shared/foundation/services/implementations/SequenceHydrator";

const contentHasher = new ContentHasher();
const handPathFactory = new HandPathFactory(contentHasher);
const handPathNamer = new HandPathNamer();
const soloPropFactory = new SoloPropFactory(handPathFactory, contentHasher);
const stepDeriver = new StepDeriver();
const sequenceDecomposer = new SequenceDecomposer(soloPropFactory);
const sequenceHydrator = new SequenceHydrator(stepDeriver, sequenceDecomposer);

export const compositionContainer = createContainer()
	.add({ handPathFactory: () => handPathFactory })
	.add({ handPathNamer: () => handPathNamer })
	.add({ soloPropFactory: () => soloPropFactory })
	.add({ stepDeriver: () => stepDeriver })
	.add({ sequenceDecomposer: () => sequenceDecomposer })
	.add({ sequenceHydrator: () => sequenceHydrator });

export type CompositionContainer = typeof compositionContainer;
