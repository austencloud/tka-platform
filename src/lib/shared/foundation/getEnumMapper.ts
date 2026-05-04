import { browser } from '$app/environment';
import { EnumMapper } from './services/implementations/data/EnumMapper';

let instance: EnumMapper | null = null;

export function getEnumMapper(): EnumMapper {
	if (!browser) throw new Error('getEnumMapper() is browser-only');
	return instance ??= new EnumMapper();
}
