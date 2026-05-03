import { FeedPreloader } from './services/implementations/FeedPreloader';

let instance: FeedPreloader | null = null;
export function getFeedPreloader(): FeedPreloader {
  return instance ??= new FeedPreloader();
}
