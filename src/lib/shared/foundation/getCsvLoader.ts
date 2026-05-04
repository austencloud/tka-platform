import { browser } from '$app/environment';
import { CsvLoader } from './services/implementations/data/CsvLoader';

let instance: CsvLoader | null = null;

export function getCsvLoader(): CsvLoader {
	if (!browser) throw new Error('getCsvLoader() is browser-only');
	return instance ??= new CsvLoader();
}
