import { FeedScrollBehavior } from './services/FeedScrollBehavior';
import { feedScrollState } from './state/feed-scroll-state.svelte';

let instance: FeedScrollBehavior | null = null;

export function getFeedScrollBehavior(): FeedScrollBehavior {
  return instance ??= new FeedScrollBehavior(feedScrollState);
}
