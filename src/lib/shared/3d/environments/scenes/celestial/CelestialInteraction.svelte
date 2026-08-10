<script lang="ts">
  import { createCelestialAudio } from "./celestial-audio";
  import { sceneAudioState } from "../../../state/scene-audio-state.svelte";

  interface Props {
    onActivate?: () => void;
  }

  let { onActivate }: Props = $props();
  const audio = createCelestialAudio();

  function handleInteraction(): void {
    audio.handleInteraction();
    onActivate?.();
  }

  $effect(() => {
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      audio.dispose();
    };
  });

  $effect(() => {
    void sceneAudioState.effectiveVolume;
    audio.syncVolume();
  });

  $effect(() => {
    void sceneAudioState.playing;
    void sceneAudioState.audioUnlocked;
    audio.syncPlayback();
  });
</script>
