import { FeedSnapDetector } from './services/implementations/FeedSnapDetector';

let instance: FeedSnapDetector | null = null;
export function getFeedSnapDetector(): FeedSnapDetector {
  return instance ??= new FeedSnapDetector();
}
