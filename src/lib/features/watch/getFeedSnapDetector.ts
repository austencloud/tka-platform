import type { IFeedSnapDetector } from './services/contracts/IFeedSnapDetector';
import { FeedSnapDetector } from './services/implementations/FeedSnapDetector';

let instance: IFeedSnapDetector | null = null;
export function getFeedSnapDetector(): IFeedSnapDetector {
  return instance ??= new FeedSnapDetector();
}
