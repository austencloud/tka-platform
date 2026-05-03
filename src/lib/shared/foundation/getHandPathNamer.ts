
import { HandPathNamer } from './services/implementations/HandPathNamer';

let instance: HandPathNamer | null = null;

export function getHandPathNamer(): HandPathNamer {
	return instance ??= new HandPathNamer();
}
