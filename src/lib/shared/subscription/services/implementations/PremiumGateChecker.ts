import { featureFlagService } from "$lib/shared/auth/services/PostHogFeatureFlagService.svelte";
import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/UserRole";
import { CAPABILITY_NUDGES } from "../../domain/capability-nudges";
import type {
	IPremiumGateChecker,
	PremiumGateResult,
} from "../contracts/IPremiumGateChecker";
import type { CapabilityFeatureId } from "$lib/shared/auth/domain/models/FeatureFlag";

export class PremiumGateChecker implements IPremiumGateChecker {
	check(capability: CapabilityFeatureId): PremiumGateResult {
		const role = featureFlagService.effectiveRole;

		if (!featureFlagService.userId) {
			return this.authRequired(capability);
		}

		if (isPremiumOrAbove(role)) {
			return { allowed: true };
		}

		if (featureFlagService.canAccess(capability)) {
			return { allowed: true };
		}

		return this.notAllowed(capability);
	}

	checkMultiple(capabilities: CapabilityFeatureId[]): PremiumGateResult[] {
		return capabilities.map((c) => this.check(c));
	}

	isAllowed(capability: CapabilityFeatureId): boolean {
		return this.check(capability).allowed;
	}

	private notAllowed(capability: CapabilityFeatureId): PremiumGateResult {
		const nudge = CAPABILITY_NUDGES[capability];
		return {
			allowed: false,
			reason: "premium_required",
			nudgeType: "premium",
			nudge: nudge ?? {
				capability,
				description: "Premium feature",
				premiumBenefit: "Unlock this feature with Premium",
			},
		};
	}

	private authRequired(capability: CapabilityFeatureId): PremiumGateResult {
		return {
			allowed: false,
			reason: "auth_required",
			nudgeType: "auth",
			nudge: {
				capability,
				description: "Account required",
				premiumBenefit: "Create a free account to access this feature",
			},
		};
	}
}
