import * as posthogActivityLogger from './services/posthog-activity-logger';
export function getActivityLogger(): typeof posthogActivityLogger { return posthogActivityLogger; }
