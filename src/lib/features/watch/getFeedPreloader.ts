import type { IFeedPreloader } from './services/contracts/IFeedPreloader';
import { FeedPreloader } from './services/implementations/FeedPreloader';

let instance: IFeedPreloader | null = null;
export function getFeedPreloader(): IFeedPreloader {
  return instance ??= new FeedPreloader();
}
