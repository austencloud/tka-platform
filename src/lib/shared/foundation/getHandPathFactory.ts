import type { IHandPathFactory } from './services/contracts/IHandPathFactory';
import { HandPathFactory } from './services/implementations/HandPathFactory';
import { getContentHasher } from './getContentHasher';

let instance: IHandPathFactory | null = null;

export function getHandPathFactory(): IHandPathFactory {
	return instance ??= new HandPathFactory(getContentHasher());
}
