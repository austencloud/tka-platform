import { browser } from '$app/environment';
import type { ILOOPDesignator } from './services/contracts/ILOOPDesignator';
import { LOOPDesignator } from './services/implementations/LOOPDesignator';

let instance: ILOOPDesignator | null = null;

export function getLOOPDesignator(): ILOOPDesignator {
	if (!browser) throw new Error('getLOOPDesignator() is browser-only');
	return instance ??= new LOOPDesignator();
}
