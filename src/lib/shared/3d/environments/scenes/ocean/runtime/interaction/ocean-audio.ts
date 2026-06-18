import { OceanAudioEngine } from '../../../../../audio/ocean-audio-engine';
import { sceneAudioState } from '../../../../../state/scene-audio-state.svelte';
import { OCEAN_TRACKS } from '../../../../../audio/ocean-audio-tracks';

export function createOceanAudio() {
  const engine = new OceanAudioEngine();
  // Use the first track ("abyss-deep") as the single canonical ocean track — no variant system in v2
  const track = OCEAN_TRACKS[0]!;

  function handleInteraction(): void {
    // Unlock-only: the first user gesture clears the browser's autoplay block so
    // the ambient track CAN start, but it stays paused until the user presses
    // play (sceneAudioState.playing → syncPlayback). No auto-start.
    if (sceneAudioState.audioUnlocked) return;
    sceneAudioState.audioUnlocked = true;
    window.removeEventListener('pointerdown', handleInteraction);
    window.removeEventListener('keydown', handleInteraction);
  }

  function syncVolume(): void {
    engine.setVolume(sceneAudioState.effectiveVolume);
  }

  function syncPlayback(): void {
    if (!sceneAudioState.audioUnlocked) return;
    if (sceneAudioState.playing && !engine.hasContext) {
      engine.createContext();
      engine.play(track.params, sceneAudioState.effectiveVolume);
    } else if (!sceneAudioState.playing) {
      engine.stop();
    }
  }

  function dispose(): void {
    engine.dispose();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    }
  }

  return { handleInteraction, syncVolume, syncPlayback, dispose };
}
