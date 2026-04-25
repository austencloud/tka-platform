import { browser } from '$app/environment';
import type { ISkillProgressionTracker } from './services/contracts/ISkillProgressionTracker';
import { SkillProgressionTracker } from './services/implementations/SkillProgressionTracker';
import { getAchievementManager } from './getAchievementManager';

let instance: ISkillProgressionTracker | null = null;

export function getSkillProgressionTracker(): ISkillProgressionTracker {
	if (!browser) throw new Error('getSkillProgressionTracker() is browser-only');
	return instance ??= new SkillProgressionTracker(getAchievementManager());
}
