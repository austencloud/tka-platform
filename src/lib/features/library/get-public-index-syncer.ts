import { PublicIndexSyncer } from './services/public-index-syncer';
import * as contentModerator from '$lib/features/moderation/services/content-moderator';
import * as contentAppealManager from '$lib/features/moderation/services/content-appeal-manager';
import { getBrowseLoader } from '$lib/shared/browse/get-browse-loader';

let instance: PublicIndexSyncer | null = null;
export function getPublicIndexSyncer(): PublicIndexSyncer {
  return instance ??= new PublicIndexSyncer(
    contentModerator,
    contentAppealManager,
    getBrowseLoader()
  );
}
