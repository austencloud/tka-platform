import { browser } from '$app/environment';
import { FilenameGenerator } from './services/implementations/FilenameGenerator';

let instance: FilenameGenerator | null = null;

export function getFilenameGenerator(): FilenameGenerator {
	if (!browser) throw new Error('getFilenameGenerator() is browser-only');
	return instance ??= new FilenameGenerator();
}
