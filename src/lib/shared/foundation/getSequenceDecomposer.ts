import { SequenceDecomposer } from './services/sequence-decomposer';

let instance: SequenceDecomposer | null = null;

export function getSequenceDecomposer(): SequenceDecomposer {
	return instance ??= new SequenceDecomposer();
}
