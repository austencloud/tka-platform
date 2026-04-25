import { browser } from '$app/environment';
import type { IEnumMapper } from './services/contracts/data/IEnumMapper';
import { EnumMapper } from './services/implementations/data/EnumMapper';

let instance: IEnumMapper | null = null;

export function getEnumMapper(): IEnumMapper {
	if (!browser) throw new Error('getEnumMapper() is browser-only');
	return instance ??= new EnumMapper();
}
