import { browser } from '$app/environment';
import type { IRotationDirectionPatternManager } from './services/contracts/IRotationDirectionPatternManager';
import { RotationDirectionPatternManager } from './services/implementations/RotationDirectionPatternManager';

let instance: IRotationDirectionPatternManager | null = null;

export function getRotationDirectionPatternManager(): IRotationDirectionPatternManager {
	if (!browser) throw new Error('getRotationDirectionPatternManager() is browser-only');
	return instance ??= new RotationDirectionPatternManager();
}
