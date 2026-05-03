import { browser } from '$app/environment';

import { RotationDirectionPatternManager } from './services/implementations/RotationDirectionPatternManager';

let instance: RotationDirectionPatternManager | null = null;

export function getRotationDirectionPatternManager(): RotationDirectionPatternManager {
	if (!browser) throw new Error('getRotationDirectionPatternManager() is browser-only');
	return instance ??= new RotationDirectionPatternManager();
}
