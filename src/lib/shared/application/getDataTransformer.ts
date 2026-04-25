import { browser } from '$app/environment';
import type { IDataTransformer } from './services/contracts/IDataTransformer';
import { DataTransformer } from './services/implementations/DataTransformer';

let instance: IDataTransformer | null = null;

export function getDataTransformer(): IDataTransformer {
	if (!browser) throw new Error('getDataTransformer() is browser-only');
	return instance ??= new DataTransformer();
}
