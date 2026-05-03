import { browser } from '$app/environment';

import { LOOPExplainer } from './services/implementations/LOOPExplainer';

let instance: LOOPExplainer | null = null;

export function getLOOPExplainer(): LOOPExplainer {
	if (!browser) throw new Error('getLOOPExplainer() is browser-only');
	return instance ??= new LOOPExplainer();
}
