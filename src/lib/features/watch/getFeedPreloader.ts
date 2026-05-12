import { FeedPreloader } from './services/FeedPreloader';

let instance: FeedPreloader | null = null;
export function getFeedPreloader(): FeedPreloader {
  return instance ??= new FeedPreloader();
}
