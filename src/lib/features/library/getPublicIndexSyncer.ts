import type { IPublicIndexSyncer } from './services/contracts/IPublicIndexSyncer';
import { PublicIndexSyncer } from './services/implementations/PublicIndexSyncer';
import { getContentModerator } from '$lib/features/moderation/getContentModerator';
import { getContentAppealManager } from '$lib/features/moderation/getContentAppealManager';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: IPublicIndexSyncer | null = null;
export function getPublicIndexSyncer(): IPublicIndexSyncer {
  return instance ??= new PublicIndexSyncer(
    getContentModerator(),
    getContentAppealManager(),
    getBrowseLoader()
  );
}
