import { SoloPropFactory } from './services/implementations/SoloPropFactory';

let instance: SoloPropFactory | null = null;

export function getSoloPropFactory(): SoloPropFactory {
	return instance ??= new SoloPropFactory();
}
