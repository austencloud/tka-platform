
import { SequenceHydrator } from './services/implementations/SequenceHydrator';
import { getSequenceDecomposer } from './getSequenceDecomposer';

let instance: SequenceHydrator | null = null;

export function getSequenceHydrator(): SequenceHydrator {
	return instance ??= new SequenceHydrator(getSequenceDecomposer());
}
