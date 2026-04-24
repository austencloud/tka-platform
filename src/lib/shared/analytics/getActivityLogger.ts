import { browser } from '$app/environment';
import type { IActivityLogger } from './services/contracts/IActivityLogger';
import { PostHogActivityLogger } from './services/implementations/PostHogActivityLogger';

let instance: IActivityLogger | null = null;

export function getActivityLogger(): IActivityLogger {
  if (!browser) throw new Error('getActivityLogger() is browser-only');
  return instance ??= new PostHogActivityLogger();
}
