import type { FeatureFlagConfig } from "$lib/shared/auth/domain/models/feature-flag";

/**
 * Onboarding-related capability flags. Kept separate from
 * PREMIUM_CAPABILITY_CONFIGS (subscription/domain/capability-flag-configs.ts)
 * because these are not premium gates — they are rollout kill-switches for
 * onboarding experiments, defaulted off until explicitly enabled via
 * PostHog or an admin override.
 */
export const ONBOARDING_CAPABILITY_CONFIGS: FeatureFlagConfig[] = [
	{
		id: "capability:onboarding:first-session-activation",
		name: "First-Session Activation",
		description: "First-sequence starter and keep-on-first-save account nudge",
		minimumRole: "user",
		enabled: false,
		category: "capability",
	},
];
