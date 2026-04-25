import { browser } from '$app/environment';
import type { IImageFormatConverter } from './services/contracts/IImageFormatConverter';
import { ImageFormatConverter } from './services/implementations/ImageFormatConverter';
import { getFileDownloader } from '../foundation/getFileDownloader';

let instance: IImageFormatConverter | null = null;

export function getImageFormatConverter(): IImageFormatConverter {
	if (!browser) throw new Error('getImageFormatConverter() is browser-only');
	return instance ??= new ImageFormatConverter(getFileDownloader());
}
