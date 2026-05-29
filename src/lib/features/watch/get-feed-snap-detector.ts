import { FeedSnapDetector } from './services/FeedSnapDetector';

let instance: FeedSnapDetector | null = null;
export function getFeedSnapDetector(): FeedSnapDetector {
  return instance ??= new FeedSnapDetector();
}
