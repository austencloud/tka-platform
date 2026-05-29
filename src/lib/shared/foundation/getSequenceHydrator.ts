
import { SequenceHydrator } from './services/sequence-hydrator';
import { getSequenceDecomposer } from './getSequenceDecomposer';

let instance: SequenceHydrator | null = null;

export function getSequenceHydrator(): SequenceHydrator {
	return instance ??= new SequenceHydrator(getSequenceDecomposer());
}
