import type { CapabilityFeatureId } from "$lib/shared/auth/domain/models/FeatureFlag";

export interface NudgeConfig {
	capability: string;
	description: string;
	premiumBenefit: string;
}

export interface PremiumGateResult {
	allowed: boolean;
	reason?: "premium_required" | "capability_disabled";
	nudge?: NudgeConfig;
}

export interface IPremiumGateChecker {
	check(capability: CapabilityFeatureId): PremiumGateResult;
	checkMultiple(capabilities: CapabilityFeatureId[]): PremiumGateResult[];
	isAllowed(capability: CapabilityFeatureId): boolean;
}
