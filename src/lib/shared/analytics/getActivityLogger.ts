import { browser } from '$app/environment';
import { PostHogActivityLogger } from './services/implementations/PostHogActivityLogger';

let instance: PostHogActivityLogger | null = null;

export function getActivityLogger(): PostHogActivityLogger {
  if (!browser) throw new Error('getActivityLogger() is browser-only');
  return instance ??= new PostHogActivityLogger();
}
