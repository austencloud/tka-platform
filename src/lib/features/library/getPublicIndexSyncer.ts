import { PublicIndexSyncer } from './services/implementations/PublicIndexSyncer';
import { getContentModerator } from '$lib/features/moderation/getContentModerator';
import { getContentAppealManager } from '$lib/features/moderation/getContentAppealManager';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: PublicIndexSyncer | null = null;
export function getPublicIndexSyncer(): PublicIndexSyncer {
  return instance ??= new PublicIndexSyncer(
    getContentModerator(),
    getContentAppealManager(),
    getBrowseLoader()
  );
}
