import { FeedSnapDetector } from './services/feed-snap-detector';

let instance: FeedSnapDetector | null = null;
export function getFeedSnapDetector(): FeedSnapDetector {
  return instance ??= new FeedSnapDetector();
}
