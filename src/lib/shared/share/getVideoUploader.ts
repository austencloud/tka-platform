import { browser } from '$app/environment';
import { R2VideoUploader } from './services/implementations/R2VideoUploader';
import { getR2Presigner } from './getR2Presigner';

let instance: R2VideoUploader | null = null;

export function getVideoUploader(): R2VideoUploader {
	if (!browser) throw new Error('getVideoUploader() is browser-only');
	return instance ??= new R2VideoUploader(getR2Presigner());
}
