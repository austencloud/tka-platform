import { browser } from '$app/environment';
import type { ISettingsPersister } from './services/contracts/ISettingsPersister';
import { FirebaseSettingsPersister } from './services/implementations/FirebaseSettingsPersister';

let instance: ISettingsPersister | null = null;

export function getSettingsPersister(): ISettingsPersister {
	if (!browser) throw new Error('getSettingsPersister() is browser-only');
	return instance ??= new FirebaseSettingsPersister();
}
