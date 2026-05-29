import * as contentModerator from './services/content-moderator';

export function getContentModerator(): typeof contentModerator {
	return contentModerator;
}
