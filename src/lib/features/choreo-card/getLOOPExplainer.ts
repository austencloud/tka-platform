import { browser } from '$app/environment';
import type { ILOOPExplainer } from './services/contracts/ILOOPExplainer';
import { LOOPExplainer } from './services/implementations/LOOPExplainer';

let instance: ILOOPExplainer | null = null;

export function getLOOPExplainer(): ILOOPExplainer {
	if (!browser) throw new Error('getLOOPExplainer() is browser-only');
	return instance ??= new LOOPExplainer();
}
