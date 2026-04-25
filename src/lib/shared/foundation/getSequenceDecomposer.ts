import type { ISequenceDecomposer } from './services/contracts/ISequenceDecomposer';
import { SequenceDecomposer } from './services/implementations/SequenceDecomposer';
import { getSoloPropFactory } from './getSoloPropFactory';

let instance: ISequenceDecomposer | null = null;

export function getSequenceDecomposer(): ISequenceDecomposer {
	return instance ??= new SequenceDecomposer(getSoloPropFactory());
}
