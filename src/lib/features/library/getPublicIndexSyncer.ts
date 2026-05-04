import { PublicIndexSyncer } from './services/implementations/PublicIndexSyncer';
import * as contentModerator from '$lib/features/moderation/services/content-moderator';
import * as contentAppealManager from '$lib/features/moderation/services/content-appeal-manager';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: PublicIndexSyncer | null = null;
export function getPublicIndexSyncer(): PublicIndexSyncer {
  return instance ??= new PublicIndexSyncer(
    contentModerator,
    contentAppealManager,
    getBrowseLoader()
  );
}
