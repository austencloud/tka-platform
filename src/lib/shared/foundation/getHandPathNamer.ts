import type { IHandPathNamer } from './services/contracts/IHandPathNamer';
import { HandPathNamer } from './services/implementations/HandPathNamer';

let instance: IHandPathNamer | null = null;

export function getHandPathNamer(): IHandPathNamer {
	return instance ??= new HandPathNamer();
}
