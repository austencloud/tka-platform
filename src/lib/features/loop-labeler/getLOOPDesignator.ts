import { browser } from '$app/environment';
import { LOOPDesignator } from './services/implementations/LOOPDesignator';

let instance: LOOPDesignator | null = null;

export function getLOOPDesignator(): LOOPDesignator {
	if (!browser) throw new Error('getLOOPDesignator() is browser-only');
	return instance ??= new LOOPDesignator();
}
