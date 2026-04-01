import type { CapabilityFeatureId } from "$lib/shared/auth/domain/models/FeatureFlag";

export interface NudgeConfig {
	capability: CapabilityFeatureId;
	description: string;
	premiumBenefit: string;
}

export interface PremiumGateResult {
	allowed: boolean;
	reason?: "auth_required" | "premium_required" | "capability_disabled";
	nudge?: NudgeConfig;
	nudgeType?: "auth" | "premium";
}

export interface IPremiumGateChecker {
	check(capability: CapabilityFeatureId): PremiumGateResult;
	checkMultiple(capabilities: CapabilityFeatureId[]): PremiumGateResult[];
	isAllowed(capability: CapabilityFeatureId): boolean;
}
