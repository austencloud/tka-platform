<script lang="ts">
  import { onDestroy } from "svelte";
  import type { OceanVariant } from "../../domain/enums/environment-enums";
  import { sceneAudioState } from "../../../state/scene-audio-state.svelte";
  import { OceanAudioEngine } from "../../../audio/ocean-audio-engine";
  import { getTrackById, getDefaultTrackForVariant } from "../../../audio/ocean-audio-tracks";

  interface Props {
    variant: OceanVariant;
  }

  let { variant }: Props = $props();

  const engine = new OceanAudioEngine();

  function resolveTrack(v: OceanVariant) {
    const prefId = sceneAudioState.getTrackPreference(v);
    if (prefId) {
      const track = getTrackById(prefId);
      if (track && track.variant === v) return track;
    }
    return getDefaultTrackForVariant(v);
  }

  function handleInteraction() {
    if (sceneAudioState.audioUnlocked) return;
    sceneAudioState.audioUnlocked = true;
    engine.createContext();
    const track = resolveTrack(variant);
    engine.play(track.params, sceneAudioState.effectiveVolume);
    sceneAudioState.playing = true;
    window.removeEventListener("pointerdown", handleInteraction);
    window.removeEventListener("keydown", handleInteraction);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", handleInteraction, { once: false });
    window.addEventListener("keydown", handleInteraction, { once: false });
  }

  $effect(() => {
    if (!sceneAudioState.audioUnlocked || !sceneAudioState.playing) return;
    const track = resolveTrack(variant);
    engine.play(track.params, sceneAudioState.effectiveVolume);
  });

  $effect(() => {
    const vol = sceneAudioState.effectiveVolume;
    engine.setVolume(vol);
  });

  $effect(() => {
    if (!sceneAudioState.audioUnlocked) return;
    if (sceneAudioState.playing && !engine.hasContext) {
      engine.createContext();
      const track = resolveTrack(variant);
      engine.play(track.params, sceneAudioState.effectiveVolume);
    } else if (!sceneAudioState.playing) {
      engine.stop();
    }
  });

  onDestroy(() => {
    engine.dispose();
    if (typeof window !== "undefined") {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    }
  });
</script>
