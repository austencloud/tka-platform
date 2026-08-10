import { OceanAudioEngine } from "../../../audio/ocean-audio-engine";
import { CELESTIAL_TRACK } from "../../../audio/ocean-audio-tracks";
import { sceneAudioState } from "../../../state/scene-audio-state.svelte";

export function createCelestialAudio() {
  const engine = new OceanAudioEngine();

  function handleInteraction(): void {
    if (sceneAudioState.audioUnlocked) return;
    sceneAudioState.audioUnlocked = true;
    window.removeEventListener("pointerdown", handleInteraction);
    window.removeEventListener("keydown", handleInteraction);
  }

  function syncVolume(): void {
    engine.setVolume(sceneAudioState.effectiveVolume);
  }

  function syncPlayback(): void {
    if (!sceneAudioState.audioUnlocked) return;
    if (sceneAudioState.playing && !engine.isPlaying) {
      if (!engine.hasContext) engine.createContext();
      engine.play(CELESTIAL_TRACK.params, sceneAudioState.effectiveVolume);
    } else if (!sceneAudioState.playing) {
      engine.stop();
    }
  }

  function dispose(): void {
    engine.dispose();
    if (typeof window !== "undefined") {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    }
  }

  return { handleInteraction, syncVolume, syncPlayback, dispose };
}
