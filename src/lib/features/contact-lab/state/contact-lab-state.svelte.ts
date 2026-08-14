import {
  sampleTwoBallPalmspin,
  type ContactPalmspinProfile,
} from "../domain/contact-motion-profile";

export type ContactCameraPreset = "teaching" | "top" | "low";

export function createContactLabState(profile: ContactPalmspinProfile) {
  let playing = $state(true);
  let phase = $state(0);
  let cameraPreset = $state<ContactCameraPreset>("teaching");
  const bpm = 30;

  const frame = $derived(sampleTwoBallPalmspin(profile, phase));
  const loopDurationSeconds = (profile.totalDuration * 60) / bpm;

  function advance(deltaSeconds: number): void {
    if (!playing) return;
    phase = (phase + deltaSeconds / loopDurationSeconds) % 1;
  }

  function togglePlayback(): void {
    playing = !playing;
  }

  function setPhase(nextPhase: number): void {
    phase = Math.max(0, Math.min(1, nextPhase));
  }

  function reset(): void {
    phase = 0;
    playing = false;
  }

  function setCameraPreset(preset: ContactCameraPreset): void {
    cameraPreset = preset;
  }

  return {
    get playing() {
      return playing;
    },
    get phase() {
      return phase;
    },
    get frame() {
      return frame;
    },
    get profile() {
      return profile;
    },
    get bpm() {
      return bpm;
    },
    get cameraPreset() {
      return cameraPreset;
    },
    advance,
    togglePlayback,
    setPhase,
    reset,
    setCameraPreset,
  };
}

export type ContactLabState = ReturnType<typeof createContactLabState>;
