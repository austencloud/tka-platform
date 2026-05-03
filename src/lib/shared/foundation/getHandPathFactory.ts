import { HandPathFactory } from './services/implementations/HandPathFactory';
import { getContentHasher } from './getContentHasher';

let instance: HandPathFactory | null = null;

export function getHandPathFactory(): HandPathFactory {
	return instance ??= new HandPathFactory(getContentHasher());
}
