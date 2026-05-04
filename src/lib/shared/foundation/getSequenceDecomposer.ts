import { SequenceDecomposer } from './services/implementations/SequenceDecomposer';

let instance: SequenceDecomposer | null = null;

export function getSequenceDecomposer(): SequenceDecomposer {
	return instance ??= new SequenceDecomposer();
}
