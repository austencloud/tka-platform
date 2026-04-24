import { browser } from '$app/environment';
import type { IFileDownloader } from './services/contracts/IFileDownloader';
import { FileDownloader } from './services/implementations/FileDownloader';

let instance: IFileDownloader | null = null;

export function getFileDownloader(): IFileDownloader {
	if (!browser) throw new Error('getFileDownloader() is browser-only');
	return instance ??= new FileDownloader();
}
