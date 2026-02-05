/**
 * Presence Container - ITI Dependency Injection
 *
 * Factory-based container for presence tracking services.
 */

import { createContainer } from "iti";
import { PresenceTracker } from "../../presence/services/implementations/PresenceTracker";

export const presenceContainer = createContainer().add({
  presenceTracker: () => new PresenceTracker(),
});

export type PresenceContainer = typeof presenceContainer;
