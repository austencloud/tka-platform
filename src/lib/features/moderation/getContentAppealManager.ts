import * as contentAppealManager from './services/content-appeal-manager';

export function getContentAppealManager(): typeof contentAppealManager {
	return contentAppealManager;
}
