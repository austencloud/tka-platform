/**
 * Write Tab ITI Container
 *
 * Provides services for the Write tab: act management and music playback.
 */

import { createContainer } from "iti";
import { ActManager } from "$lib/features/write/services/implementations/ActManager";
import { MusicPlayer } from "$lib/features/write/services/implementations/MusicPlayer";

export const writeContainer = createContainer().add({
  actManager: () => new ActManager(),
  musicPlayer: () => new MusicPlayer(),
});

export type WriteContainer = typeof writeContainer;
