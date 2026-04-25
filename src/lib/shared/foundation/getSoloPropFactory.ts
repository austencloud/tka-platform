import type { ISoloPropFactory } from './services/contracts/ISoloPropFactory';
import { SoloPropFactory } from './services/implementations/SoloPropFactory';
import { getHandPathFactory } from './getHandPathFactory';
import { getContentHasher } from './getContentHasher';

let instance: ISoloPropFactory | null = null;

export function getSoloPropFactory(): ISoloPropFactory {
	return instance ??= new SoloPropFactory(getHandPathFactory(), getContentHasher());
}
