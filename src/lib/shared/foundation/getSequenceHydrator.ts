import type { ISequenceHydrator } from './services/contracts/ISequenceHydrator';
import { SequenceHydrator } from './services/implementations/SequenceHydrator';
import { getStepDeriver } from './getStepDeriver';
import { getSequenceDecomposer } from './getSequenceDecomposer';

let instance: ISequenceHydrator | null = null;

export function getSequenceHydrator(): ISequenceHydrator {
	return instance ??= new SequenceHydrator(getStepDeriver(), getSequenceDecomposer());
}
