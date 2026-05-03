
import { SequenceHydrator } from './services/implementations/SequenceHydrator';
import { getStepDeriver } from './getStepDeriver';
import { getSequenceDecomposer } from './getSequenceDecomposer';

let instance: SequenceHydrator | null = null;

export function getSequenceHydrator(): SequenceHydrator {
	return instance ??= new SequenceHydrator(getStepDeriver(), getSequenceDecomposer());
}
