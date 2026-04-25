import { browser } from '$app/environment';
import type { ILOOPLabelsFirebaseRepository } from './services/contracts/ILOOPLabelsFirebaseRepository';
import { LOOPLabelsFirebaseRepository } from './services/implementations/LOOPLabelsFirebaseRepository';

let instance: ILOOPLabelsFirebaseRepository | null = null;

export function getLOOPLabelsFirebaseRepository(): ILOOPLabelsFirebaseRepository {
	if (!browser) throw new Error('getLOOPLabelsFirebaseRepository() is browser-only');
	return instance ??= new LOOPLabelsFirebaseRepository();
}
