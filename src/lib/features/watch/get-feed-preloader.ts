import { FeedPreloader } from './services/feed-preloader';

let instance: FeedPreloader | null = null;
export function getFeedPreloader(): FeedPreloader {
  return instance ??= new FeedPreloader();
}
