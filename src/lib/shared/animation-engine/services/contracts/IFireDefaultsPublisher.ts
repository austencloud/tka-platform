import type { FirePhysicsParams } from "../../domain/types/FireTypes";
import type { PropFirePointConfig } from "../../domain/types/PropFirePoints";

/**
 * Publishes admin-tuned fire defaults to Firestore.
 * Admin-only: writes to config/fireDefaults.
 */
export interface IFireDefaultsPublisher {
	/** Publish fire points + physics to Firestore. Throws if not admin. */
	publish(data: {
		firePoints: Record<string, PropFirePointConfig>;
		propPhysics: Record<string, FirePhysicsParams>;
		globalPhysics: FirePhysicsParams;
	}): Promise<void>;
}
