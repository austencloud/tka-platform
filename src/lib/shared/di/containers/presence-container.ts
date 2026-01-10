/**
 * Presence Container - ITI Dependency Injection
 *
 * Factory-based container for presence tracking services.
 * Depends on SessionTracker from analytics container.
 */

import { createContainer } from "iti";
import { PresenceTracker } from "../../presence/services/implementations/PresenceTracker";
import { analyticsContainer } from "./analytics-container";

export const presenceContainer = createContainer().add({
  presenceTracker: () =>
    new PresenceTracker(analyticsContainer.items.sessionTracker),
});

export type PresenceContainer = typeof presenceContainer;
