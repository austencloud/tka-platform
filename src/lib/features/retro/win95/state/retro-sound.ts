/**
 * Module-level RetroSoundManager singleton.
 *
 * Import this wherever you need to play UI sounds or adjust
 * volume/mute. The instance is shared across all components.
 */

import { RetroSoundManager } from "../services/implementations/RetroSoundManager";

export const retroSound = new RetroSoundManager();
