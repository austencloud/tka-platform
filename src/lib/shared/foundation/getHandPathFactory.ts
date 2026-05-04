import { HandPathFactory } from './services/implementations/HandPathFactory';

let instance: HandPathFactory | null = null;

export function getHandPathFactory(): HandPathFactory {
	return instance ??= new HandPathFactory();
}
