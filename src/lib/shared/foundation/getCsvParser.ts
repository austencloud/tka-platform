import { browser } from '$app/environment';
import type { ICSVParser } from './services/contracts/data/ICSVParser';
import { CSVParser } from './services/implementations/data/CsvParser';

let instance: ICSVParser | null = null;

export function getCsvParser(): ICSVParser {
	if (!browser) throw new Error('getCsvParser() is browser-only');
	return instance ??= new CSVParser();
}
