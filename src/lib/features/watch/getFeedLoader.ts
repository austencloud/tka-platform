import { FeedLoader } from './services/implementations/FeedLoader';
import { getPublicVideoLoader } from './getPublicVideoLoader';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: FeedLoader | null = null;
export function getFeedLoader(): FeedLoader {
  return instance ??= new FeedLoader(getPublicVideoLoader(), getBrowseLoader());
}
