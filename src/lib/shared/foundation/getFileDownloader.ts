import { browser } from '$app/environment';
import { FileDownloader } from './services/implementations/FileDownloader';

let instance: FileDownloader | null = null;

export function getFileDownloader(): FileDownloader {
	if (!browser) throw new Error('getFileDownloader() is browser-only');
	return instance ??= new FileDownloader();
}
