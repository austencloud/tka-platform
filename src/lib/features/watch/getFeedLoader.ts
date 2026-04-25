import type { IFeedLoader } from './services/contracts/IFeedLoader';
import { FeedLoader } from './services/implementations/FeedLoader';
import { getPublicVideoLoader } from './getPublicVideoLoader';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: IFeedLoader | null = null;
export function getFeedLoader(): IFeedLoader {
  return instance ??= new FeedLoader(getPublicVideoLoader(), getBrowseLoader());
}
