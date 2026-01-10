/**
 * Night Sky Container - ITI-based dependency injection for night sky background services
 *
 * This container manages UFO animation services including:
 * - Rendering (UFO hull, dome, shield, beam, lights)
 * - Particle effects (samples, dust, sleep Zs, celebrations)
 * - Mood management (emotional state, wobble animations)
 * - Star scanning (discovery, memory, tracking)
 * - User interaction (click handling, reactions)
 *
 * Pattern matches deep-ocean-container.ts
 */

import { createContainer } from "iti";

// UFO services
import { UFORenderer } from "../../background/night-sky/services/implementations/UFORenderer";
import { UFOParticleRenderer } from "../../background/night-sky/services/implementations/UFOParticleRenderer";
import { UFOMoodManager } from "../../background/night-sky/services/implementations/UFOMoodManager";
import { UFOStarScanner } from "../../background/night-sky/services/implementations/UFOStarScanner";
import { UFOInteractionHandler } from "../../background/night-sky/services/implementations/UFOInteractionHandler";
import { UFOBehaviorRunner } from "../../background/night-sky/services/implementations/UFOBehaviorRunner";

/**
 * Night Sky container with UFO animation services
 *
 * Services are organized in dependency order:
 * 1. Base services with no dependencies (renderers, mood manager, scanners)
 */
export const nightSkyContainer = createContainer()
  // === Layer 1: Base services with no dependencies ===
  .add({
    // UFO rendering services
    ufoRenderer: () => new UFORenderer(),
    ufoParticleRenderer: () => new UFOParticleRenderer(),
    ufoMoodManager: () => new UFOMoodManager(),
    ufoStarScanner: () => new UFOStarScanner(),
    ufoInteractionHandler: () => new UFOInteractionHandler(),
    ufoBehaviorRunner: () => new UFOBehaviorRunner(),
  });

export type NightSkyContainerType = typeof nightSkyContainer;
