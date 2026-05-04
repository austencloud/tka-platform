import { FeedLoader } from './services/implementations/FeedLoader';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';

let instance: FeedLoader | null = null;
export function getFeedLoader(): FeedLoader {
  return instance ??= new FeedLoader(getBrowseLoader());
}
