import { browser } from '$app/environment';
import type { ICSVLoader } from './services/contracts/data/ICSVLoader';
import { CsvLoader } from './services/implementations/data/CsvLoader';

let instance: ICSVLoader | null = null;

export function getCsvLoader(): ICSVLoader {
	if (!browser) throw new Error('getCsvLoader() is browser-only');
	return instance ??= new CsvLoader();
}
