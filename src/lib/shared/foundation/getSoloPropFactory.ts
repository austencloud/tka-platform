import { SoloPropFactory } from './services/implementations/SoloPropFactory';
import { getHandPathFactory } from './getHandPathFactory';
import { getContentHasher } from './getContentHasher';

let instance: SoloPropFactory | null = null;

export function getSoloPropFactory(): SoloPropFactory {
	return instance ??= new SoloPropFactory(getHandPathFactory(), getContentHasher());
}
