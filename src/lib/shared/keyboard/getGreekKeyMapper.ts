import { browser } from '$app/environment';
import { GreekKeyMapper } from './services/implementations/GreekKeyMapper';

let instance: GreekKeyMapper | null = null;

export function getGreekKeyMapper(): GreekKeyMapper {
	if (!browser) throw new Error('getGreekKeyMapper() is browser-only');
	return instance ??= new GreekKeyMapper();
}
