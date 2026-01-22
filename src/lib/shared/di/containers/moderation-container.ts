/**
 * Moderation ITI Container
 *
 * Provides services for:
 * - User reporting system (ReportSubmitter, ReportQuerier, ReportResolver)
 * - Content moderation (ContentModerator, ContentAppealManager)
 */

import { createContainer } from 'iti';
import { ReportSubmitter } from '$lib/features/moderation/services/implementations/ReportSubmitter';
import { ReportQuerier } from '$lib/features/moderation/services/implementations/ReportQuerier';
import { ReportResolver } from '$lib/features/moderation/services/implementations/ReportResolver';
import { ContentModerator } from '$lib/features/moderation/services/implementations/ContentModerator';
import { ContentAppealManager } from '$lib/features/moderation/services/implementations/ContentAppealManager';

/**
 * Creates the moderation container.
 * ReportResolver depends on ReportQuerier for fetching reports after updates.
 */
export function createModerationContainer() {
	return createContainer()
		.add({
			reportSubmitter: () => new ReportSubmitter(),
			reportQuerier: () => new ReportQuerier(),
			contentModerator: () => new ContentModerator(),
			contentAppealManager: () => new ContentAppealManager()
		})
		.add((ctx) => ({
			reportResolver: () => new ReportResolver(ctx.reportQuerier)
		}));
}

export type ModerationContainer = ReturnType<typeof createModerationContainer>;
