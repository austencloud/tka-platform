import { browser } from '$app/environment';

import { SkillProgressionTracker } from './services/implementations/SkillProgressionTracker';
import { getAchievementManager } from './getAchievementManager';

let instance: SkillProgressionTracker | null = null;

export function getSkillProgressionTracker(): SkillProgressionTracker {
	if (!browser) throw new Error('getSkillProgressionTracker() is browser-only');
	return instance ??= new SkillProgressionTracker(getAchievementManager());
}
