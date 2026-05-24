const STORAGE_KEY = "tka-scene-audio-v1";

interface PersistedAudioState {
  masterVolume: number;
  muted: boolean;
  trackPreferences: Record<string, string>;
}

function load(): PersistedAudioState {
  if (typeof localStorage === "undefined") {
    return { masterVolume: 0.7, muted: false, trackPreferences: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { masterVolume: 0.7, muted: false, trackPreferences: {} };
    const parsed = JSON.parse(raw);
    return {
      masterVolume: typeof parsed.masterVolume === "number" ? parsed.masterVolume : 0.7,
      muted: typeof parsed.muted === "boolean" ? parsed.muted : false,
      trackPreferences: typeof parsed.trackPreferences === "object" && parsed.trackPreferences !== null
        ? parsed.trackPreferences
        : {},
    };
  } catch {
    return { masterVolume: 0.7, muted: false, trackPreferences: {} };
  }
}

function save(state: PersistedAudioState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* full / blocked */ }
}

const initial = load();
let masterVolume = $state(initial.masterVolume);
let muted = $state(initial.muted);
let trackPreferences = $state<Record<string, string>>(initial.trackPreferences);
let playing = $state(false);
let audioUnlocked = $state(false);

function persist(): void {
  save({ masterVolume, muted, trackPreferences });
}

export const sceneAudioState = {
  get masterVolume() { return masterVolume; },
  set masterVolume(v: number) { masterVolume = Math.max(0, Math.min(1, v)); persist(); },
  get muted() { return muted; },
  set muted(v: boolean) { muted = v; persist(); },
  get playing() { return playing; },
  set playing(v: boolean) { playing = v; },
  get audioUnlocked() { return audioUnlocked; },
  set audioUnlocked(v: boolean) { audioUnlocked = v; },
  get effectiveVolume(): number { return muted ? 0 : masterVolume; },
  getTrackPreference(variant: string): string | undefined { return trackPreferences[variant]; },
  setTrackPreference(variant: string, trackId: string): void {
    trackPreferences = { ...trackPreferences, [variant]: trackId };
    persist();
  },
  toggleMute(): void { muted = !muted; persist(); },
};
