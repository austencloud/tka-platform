import type { FirePhysicsParams } from "./FireTypes";
import type { PropFirePointConfig } from "./PropFirePoints";

/**
 * Firestore document shape for admin-published fire defaults.
 * Stored at: config/fireDefaults
 *
 * Admin tunes fire in Flame Lab, then publishes here.
 * All users read these as the baseline fire configuration.
 */
export interface FireDefaultsDocument {
	/** Per-prop fire point positions + wick sizes (from Fire Point Editor) */
	firePoints: Record<string, PropFirePointConfig>;

	/** Per-prop physics baseline (from Tuning Tab). Falls back to globalPhysics if absent. */
	propPhysics: Record<string, FirePhysicsParams>;

	/** Global physics baseline -- the admin's tuned "Fire Spin" default */
	globalPhysics: FirePhysicsParams;

	/** Firestore server timestamp */
	updatedAt: unknown;

	/** UID of the admin who published */
	updatedBy: string;
}

/**
 * Intensity tier multipliers applied on top of admin physics baseline.
 * Users pick Small/Medium/Large; these scale intensity + flameHeight.
 */
export type FireIntensityTier = "small" | "medium" | "large";

export const FIRE_INTENSITY_TIERS: Record<FireIntensityTier, { intensity: number; flameHeight: number }> = {
	small: { intensity: 0.5, flameHeight: 0.6 },
	medium: { intensity: 1.0, flameHeight: 1.0 },
	large: { intensity: 1.5, flameHeight: 1.4 },
};
