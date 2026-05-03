import { browser } from '$app/environment';
import { ImageFormatConverter } from './services/implementations/ImageFormatConverter';
import { getFileDownloader } from '../foundation/getFileDownloader';

let instance: ImageFormatConverter | null = null;

export function getImageFormatConverter(): ImageFormatConverter {
	if (!browser) throw new Error('getImageFormatConverter() is browser-only');
	return instance ??= new ImageFormatConverter(getFileDownloader());
}
