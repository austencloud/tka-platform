import { FeedLoader } from './services/feed-loader';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';

let instance: FeedLoader | null = null;
export function getFeedLoader(): FeedLoader {
  return instance ??= new FeedLoader(getBrowseLoader());
}
