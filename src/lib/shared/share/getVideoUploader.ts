import { browser } from '$app/environment';
import type { IVideoUploader } from './services/contracts/IVideoUploader';
import { R2VideoUploader } from './services/implementations/R2VideoUploader';
import { getR2Presigner } from './getR2Presigner';

let instance: IVideoUploader | null = null;

export function getVideoUploader(): IVideoUploader {
	if (!browser) throw new Error('getVideoUploader() is browser-only');
	return instance ??= new R2VideoUploader(getR2Presigner());
}
