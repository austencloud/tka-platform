import { SequenceDecomposer } from './services/implementations/SequenceDecomposer';
import { getSoloPropFactory } from './getSoloPropFactory';

let instance: SequenceDecomposer | null = null;

export function getSequenceDecomposer(): SequenceDecomposer {
	return instance ??= new SequenceDecomposer(getSoloPropFactory());
}
