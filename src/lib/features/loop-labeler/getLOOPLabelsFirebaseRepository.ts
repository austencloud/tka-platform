import { browser } from '$app/environment';
import { LOOPLabelsFirebaseRepository } from './services/LOOPLabelsFirebaseRepository';

let instance: LOOPLabelsFirebaseRepository | null = null;

export function getLOOPLabelsFirebaseRepository(): LOOPLabelsFirebaseRepository {
	if (!browser) throw new Error('getLOOPLabelsFirebaseRepository() is browser-only');
	return instance ??= new LOOPLabelsFirebaseRepository();
}
