import { browser } from '$app/environment';
import { CSVParser } from './services/implementations/data/CsvParser';

let instance: CSVParser | null = null;

export function getCsvParser(): CSVParser {
	if (!browser) throw new Error('getCsvParser() is browser-only');
	return instance ??= new CSVParser();
}
