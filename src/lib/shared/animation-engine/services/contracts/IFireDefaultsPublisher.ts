import type { FirePhysicsParams } from "../../domain/types/FireTypes";
import type { PropTipConfig } from "../../domain/types/PropTipPoints";

/**
 * Publishes admin-tuned fire defaults to Firestore.
 * Admin-only: writes to config/fireDefaults.
 */
export interface IFireDefaultsPublisher {
	/** Publish fire points + physics to Firestore. Throws if not admin. */
	publish(data: {
		firePoints: Record<string, PropTipConfig>;
		propPhysics: Record<string, FirePhysicsParams>;
		globalPhysics: FirePhysicsParams;
	}): Promise<void>;
}
