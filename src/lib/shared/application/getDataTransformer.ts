import { browser } from '$app/environment';
import { DataTransformer } from './services/implementations/DataTransformer';

let instance: DataTransformer | null = null;

export function getDataTransformer(): DataTransformer {
	if (!browser) throw new Error('getDataTransformer() is browser-only');
	return instance ??= new DataTransformer();
}
