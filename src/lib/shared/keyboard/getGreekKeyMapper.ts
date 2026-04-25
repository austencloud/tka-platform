import { browser } from '$app/environment';
import type { IGreekKeyMapper } from './services/contracts/IGreekKeyMapper';
import { GreekKeyMapper } from './services/implementations/GreekKeyMapper';

let instance: IGreekKeyMapper | null = null;

export function getGreekKeyMapper(): IGreekKeyMapper {
	if (!browser) throw new Error('getGreekKeyMapper() is browser-only');
	return instance ??= new GreekKeyMapper();
}
