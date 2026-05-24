# Ocean Audio System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-variant procedural ambient audio to the ocean scene with a scene-wide mute/volume system and a mini jukebox UI in the top-left of the 3D viewer.

**Architecture:** Scene-wide audio state (localStorage-persisted) drives a procedural Web Audio engine that builds a 5-layer synthesis graph per track preset. A mini jukebox overlay in Viewer3DCanvas provides play/pause, volume, mute, and track switching. The existing OceanAmbientAudio.svelte is replaced by a new engine + Svelte wrapper.

**Tech Stack:** Web Audio API (no new deps), Svelte 5 runes, localStorage, Font Awesome icons.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/shared/3d/state/scene-audio-state.svelte.ts` | Scene-wide volume/mute/track prefs, localStorage-persisted |
| Create | `src/lib/shared/3d/audio/ocean-audio-tracks.ts` | Track manifest + per-track synthesis parameter presets |
| Create | `src/lib/shared/3d/audio/ocean-audio-engine.ts` | Procedural synthesis: 5-layer Web Audio graph, crossfade, detail events |
| Rewrite | `src/lib/shared/3d/environments/scenes/ocean/OceanAmbientAudio.svelte` | Thin Svelte wrapper: reads state, drives engine, handles autoplay unlock |
| Create | `src/lib/shared/3d/components/SceneAudioPlayer.svelte` | Mini jukebox UI overlay (collapsed/expanded) |
| Modify | `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Mount SceneAudioPlayer in overlay area |

---

### Task 1: Scene Audio State

**Files:**
- Create: `src/lib/shared/3d/state/scene-audio-state.svelte.ts`

- [ ] **Step 1: Create scene-audio-state.svelte.ts**

```typescript
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
```

- [ ] **Step 2: Run `npm run check` to verify no type errors**

Run: `npm run check`
Expected: 0 errors (new file, no consumers yet)

- [ ] **Step 3: Commit**

```
git add src/lib/shared/3d/state/scene-audio-state.svelte.ts
git commit -m "feat(ocean-audio): add scene-wide audio state with localStorage persistence"
```

---

### Task 2: Track Manifest + Presets

**Files:**
- Create: `src/lib/shared/3d/audio/ocean-audio-tracks.ts`

- [ ] **Step 1: Create ocean-audio-tracks.ts with types and 8 preset definitions**

```typescript
import type { OceanVariant } from "../environments/domain/enums/environment-enums";

export type NoiseType = "brown" | "pink" | "white";
export type FilterType = "lowpass" | "bandpass";
export type DetailEventType = "metallic-ping" | "bubble-cluster" | "shimmer-tone" | "water-movement" | "none";

export interface TrackParams {
  droneFreq: number;
  droneDetune: number;
  droneGain: number;
  noiseType: NoiseType;
  noiseFilterType: FilterType;
  noiseFilterFreq: number;
  noiseFilterQ: number;
  noiseGain: number;
  lfoRate: number;
  lfoDepth: number;
  subFreq: number;
  subGain: number;
  detailEvent: DetailEventType;
  detailMinInterval: number;
  detailMaxInterval: number;
  detailGain: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  type: "procedural" | "file";
  src?: string;
  variant: OceanVariant;
  params: TrackParams;
}

export const OCEAN_TRACKS: AudioTrack[] = [
  {
    id: "abyss-deep", name: "The Deep", type: "procedural", variant: "abyss",
    params: {
      droneFreq: 55, droneDetune: -10, droneGain: 0.12,
      noiseType: "brown", noiseFilterType: "lowpass", noiseFilterFreq: 150, noiseFilterQ: 2, noiseGain: 0.06,
      lfoRate: 0.08, lfoDepth: 20, subFreq: 30, subGain: 0.08,
      detailEvent: "metallic-ping", detailMinInterval: 8, detailMaxInterval: 20, detailGain: 0.04,
    },
  },
  {
    id: "abyss-bio", name: "Bioluminescence", type: "procedural", variant: "abyss",
    params: {
      droneFreq: 82, droneDetune: 3, droneGain: 0.08,
      noiseType: "pink", noiseFilterType: "bandpass", noiseFilterFreq: 300, noiseFilterQ: 3, noiseGain: 0.04,
      lfoRate: 0.04, lfoDepth: 15, subFreq: 41, subGain: 0.05,
      detailEvent: "shimmer-tone", detailMinInterval: 6, detailMaxInterval: 14, detailGain: 0.03,
    },
  },
  {
    id: "reef-sunlit", name: "Sunlit Shallows", type: "procedural", variant: "reef",
    params: {
      droneFreq: 110, droneDetune: 5, droneGain: 0.06,
      noiseType: "white", noiseFilterType: "lowpass", noiseFilterFreq: 2500, noiseFilterQ: 0.8, noiseGain: 0.1,
      lfoRate: 0.15, lfoDepth: 40, subFreq: 55, subGain: 0.04,
      detailEvent: "bubble-cluster", detailMinInterval: 4, detailMaxInterval: 10, detailGain: 0.05,
    },
  },
  {
    id: "reef-coral", name: "Coral Garden", type: "procedural", variant: "reef",
    params: {
      droneFreq: 95, droneDetune: 0, droneGain: 0.05,
      noiseType: "brown", noiseFilterType: "lowpass", noiseFilterFreq: 1000, noiseFilterQ: 1.2, noiseGain: 0.07,
      lfoRate: 0.1, lfoDepth: 25, subFreq: 48, subGain: 0.03,
      detailEvent: "bubble-cluster", detailMinInterval: 6, detailMaxInterval: 14, detailGain: 0.03,
    },
  },
  {
    id: "mystical-aurora", name: "Aurora Depths", type: "procedural", variant: "mystical",
    params: {
      droneFreq: 82, droneDetune: -5, droneGain: 0.08,
      noiseType: "pink", noiseFilterType: "bandpass", noiseFilterFreq: 400, noiseFilterQ: 4, noiseGain: 0.05,
      lfoRate: 0.05, lfoDepth: 30, subFreq: 41, subGain: 0.06,
      detailEvent: "shimmer-tone", detailMinInterval: 6, detailMaxInterval: 15, detailGain: 0.04,
    },
  },
  {
    id: "mystical-crystal", name: "Crystal Cavern", type: "procedural", variant: "mystical",
    params: {
      droneFreq: 73, droneDetune: 7, droneGain: 0.07,
      noiseType: "pink", noiseFilterType: "bandpass", noiseFilterFreq: 550, noiseFilterQ: 6, noiseGain: 0.03,
      lfoRate: 0.03, lfoDepth: 18, subFreq: 36, subGain: 0.05,
      detailEvent: "shimmer-tone", detailMinInterval: 8, detailMaxInterval: 18, detailGain: 0.05,
    },
  },
  {
    id: "cinematic-blue", name: "Blue Planet", type: "procedural", variant: "cinematic",
    params: {
      droneFreq: 65, droneDetune: 0, droneGain: 0.1,
      noiseType: "brown", noiseFilterType: "lowpass", noiseFilterFreq: 350, noiseFilterQ: 1.2, noiseGain: 0.08,
      lfoRate: 0.1, lfoDepth: 25, subFreq: 35, subGain: 0.07,
      detailEvent: "water-movement", detailMinInterval: 5, detailMaxInterval: 12, detailGain: 0.04,
    },
  },
  {
    id: "cinematic-still", name: "Still Waters", type: "procedural", variant: "cinematic",
    params: {
      droneFreq: 50, droneDetune: -3, droneGain: 0.05,
      noiseType: "brown", noiseFilterType: "lowpass", noiseFilterFreq: 200, noiseFilterQ: 1.5, noiseGain: 0.04,
      lfoRate: 0.06, lfoDepth: 10, subFreq: 28, subGain: 0.04,
      detailEvent: "water-movement", detailMinInterval: 10, detailMaxInterval: 25, detailGain: 0.02,
    },
  },
];

export function getTracksForVariant(variant: OceanVariant): AudioTrack[] {
  return OCEAN_TRACKS.filter((t) => t.variant === variant);
}

export function getTrackById(id: string): AudioTrack | undefined {
  return OCEAN_TRACKS.find((t) => t.id === id);
}

export function getDefaultTrackForVariant(variant: OceanVariant): AudioTrack {
  return OCEAN_TRACKS.find((t) => t.variant === variant)!;
}
```

- [ ] **Step 2: Run `npm run check`**

Expected: 0 errors

- [ ] **Step 3: Commit**

```
git add src/lib/shared/3d/audio/ocean-audio-tracks.ts
git commit -m "feat(ocean-audio): add track manifest with 8 procedural presets across 4 variants"
```

---

### Task 3: Procedural Synthesis Engine

**Files:**
- Create: `src/lib/shared/3d/audio/ocean-audio-engine.ts`

This is the core audio engine — pure TypeScript, no Svelte dependency. Builds a 5-layer Web Audio graph from a `TrackParams` preset and exposes volume/mute/crossfade controls.

- [ ] **Step 1: Create ocean-audio-engine.ts**

```typescript
import type { TrackParams, NoiseType, DetailEventType } from "./ocean-audio-tracks";

interface AudioGraph {
  masterGain: GainNode;
  drone: OscillatorNode;
  droneGain: GainNode;
  sub: OscillatorNode;
  subGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  noiseSource: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
  noiseGain: GainNode;
  detailGain: GainNode;
  detailTimer: ReturnType<typeof setTimeout> | null;
}

function createNoiseBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (type === "white") {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    // brown noise
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buf;
}

function scheduleDetailEvent(
  ctx: AudioContext,
  detailGain: GainNode,
  type: DetailEventType,
  params: TrackParams,
  onScheduleNext: () => void,
): void {
  if (type === "none") return;
  const t = ctx.currentTime;

  if (type === "metallic-ping") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 2000 + Math.random() * 2000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(params.detailGain, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(env);
    env.connect(detailGain);
    osc.start(t);
    osc.stop(t + 0.6);
  } else if (type === "bubble-cluster") {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const delay = i * 0.05 + Math.random() * 0.03;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const baseFreq = 150 + Math.random() * 250;
      osc.frequency.setValueAtTime(baseFreq, t + delay);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.8, t + delay + 0.05);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t + delay);
      env.gain.linearRampToValueAtTime(params.detailGain, t + delay + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.06);
      osc.connect(env);
      env.connect(detailGain);
      osc.start(t + delay);
      osc.stop(t + delay + 0.08);
    }
  } else if (type === "shimmer-tone") {
    const fundamental = 300 + Math.random() * 200;
    const harmonics = [1, 1.5, 2, 3];
    for (const h of harmonics) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = fundamental * h;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(params.detailGain / harmonics.length, t + 2);
      env.gain.setValueAtTime(params.detailGain / harmonics.length, t + 5);
      env.gain.linearRampToValueAtTime(0, t + 7);
      osc.connect(env);
      env.connect(detailGain);
      osc.start(t);
      osc.stop(t + 7.1);
    }
  } else if (type === "water-movement") {
    const noiseBuf = createNoiseBuffer(ctx, "brown");
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 200 + Math.random() * 400;
    bp.Q.value = 1.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(params.detailGain, t + 0.1);
    env.gain.linearRampToValueAtTime(0, t + 0.6);
    src.connect(bp);
    bp.connect(env);
    env.connect(detailGain);
    src.start(t);
    src.stop(t + 0.7);
  }

  onScheduleNext();
}

export class OceanAudioEngine {
  private ctx: AudioContext | null = null;
  private graph: AudioGraph | null = null;
  private currentParams: TrackParams | null = null;
  private _volume = 0.7;
  private _disposed = false;

  createContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  get hasContext(): boolean {
    return this.ctx !== null;
  }

  play(params: TrackParams, volume: number): void {
    if (this._disposed) return;
    this._volume = volume;
    if (!this.ctx) this.createContext();
    if (this.graph) this.crossfadeTo(params);
    else this.buildGraph(params);
  }

  stop(): void {
    if (!this.graph || !this.ctx) return;
    const g = this.graph;
    g.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    if (g.detailTimer) clearTimeout(g.detailTimer);
    setTimeout(() => this.teardown(g), 600);
    this.graph = null;
    this.currentParams = null;
  }

  setVolume(v: number): void {
    this._volume = v;
    if (this.graph && this.ctx) {
      this.graph.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
    }
  }

  crossfadeTo(params: TrackParams): void {
    if (!this.ctx) return;
    const oldGraph = this.graph;
    if (oldGraph) {
      oldGraph.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      if (oldGraph.detailTimer) clearTimeout(oldGraph.detailTimer);
      setTimeout(() => this.teardown(oldGraph), 2000);
    }
    this.graph = null;
    this.buildGraph(params);
  }

  dispose(): void {
    this._disposed = true;
    if (this.graph) {
      if (this.graph.detailTimer) clearTimeout(this.graph.detailTimer);
      this.teardown(this.graph);
      this.graph = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  private buildGraph(params: TrackParams): void {
    const ctx = this.ctx!;
    this.currentParams = params;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = params.droneFreq;
    drone.detune.value = params.droneDetune;
    const droneGain = ctx.createGain();
    droneGain.gain.value = params.droneGain;
    drone.connect(droneGain);
    droneGain.connect(masterGain);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = params.subFreq;
    const subGain = ctx.createGain();
    subGain.gain.value = params.subGain;
    sub.connect(subGain);
    subGain.connect(masterGain);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = params.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = params.lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(drone.frequency);

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = createNoiseBuffer(ctx, params.noiseType);
    noiseSource.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = params.noiseFilterType;
    noiseFilter.frequency.value = params.noiseFilterFreq;
    noiseFilter.Q.value = params.noiseFilterQ;
    const noiseGainNode = ctx.createGain();
    noiseGainNode.gain.value = params.noiseGain;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGainNode);
    noiseGainNode.connect(masterGain);

    const detailGainNode = ctx.createGain();
    detailGainNode.gain.value = 1.0;
    detailGainNode.connect(masterGain);

    drone.start();
    sub.start();
    lfo.start();
    noiseSource.start();

    this.graph = {
      masterGain, drone, droneGain, sub, subGain,
      lfo, lfoGain, noiseSource, noiseFilter,
      noiseGain: noiseGainNode, detailGain: detailGainNode,
      detailTimer: null,
    };

    // Fade in
    masterGain.gain.setTargetAtTime(this._volume, ctx.currentTime, 0.8);

    // Start detail event loop
    this.scheduleNextDetail();
  }

  private scheduleNextDetail(): void {
    if (!this.graph || !this.ctx || !this.currentParams) return;
    const p = this.currentParams;
    if (p.detailEvent === "none") return;
    const delay = (p.detailMinInterval + Math.random() * (p.detailMaxInterval - p.detailMinInterval)) * 1000;
    const g = this.graph;
    g.detailTimer = setTimeout(() => {
      if (!this.ctx || !this.graph || this.graph !== g) return;
      scheduleDetailEvent(this.ctx, g.detailGain, p.detailEvent, p, () => {
        this.scheduleNextDetail();
      });
    }, delay);
  }

  private teardown(g: AudioGraph): void {
    try {
      g.drone.stop(); g.drone.disconnect();
      g.sub.stop(); g.sub.disconnect();
      g.lfo.stop(); g.lfo.disconnect();
      g.noiseSource.stop(); g.noiseSource.disconnect();
      g.noiseFilter.disconnect();
      g.droneGain.disconnect();
      g.subGain.disconnect();
      g.noiseGain.disconnect();
      g.lfoGain.disconnect();
      g.detailGain.disconnect();
      g.masterGain.disconnect();
    } catch { /* already stopped */ }
  }
}
```

- [ ] **Step 2: Run `npm run check`**

Expected: 0 errors

- [ ] **Step 3: Commit**

```
git add src/lib/shared/3d/audio/ocean-audio-engine.ts
git commit -m "feat(ocean-audio): add 5-layer procedural synthesis engine with detail events"
```

---

### Task 4: Rewrite OceanAmbientAudio.svelte

**Files:**
- Rewrite: `src/lib/shared/3d/environments/scenes/ocean/OceanAmbientAudio.svelte`

Replace the inline Web Audio code with the new engine + state. The component becomes a thin reactive wrapper.

- [ ] **Step 1: Rewrite OceanAmbientAudio.svelte**

```svelte
<script lang="ts">
  import { onDestroy } from "svelte";
  import type { OceanVariant } from "../../domain/enums/environment-enums";
  import { sceneAudioState } from "../../../state/scene-audio-state.svelte";
  import { OceanAudioEngine } from "../../../audio/ocean-audio-engine";
  import { getTracksForVariant, getTrackById, getDefaultTrackForVariant } from "../../../audio/ocean-audio-tracks";

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

  // React to variant changes
  $effect(() => {
    if (!sceneAudioState.audioUnlocked || !sceneAudioState.playing) return;
    const track = resolveTrack(variant);
    engine.play(track.params, sceneAudioState.effectiveVolume);
  });

  // React to volume/mute changes
  $effect(() => {
    const vol = sceneAudioState.effectiveVolume;
    engine.setVolume(vol);
  });

  // React to play/pause
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
```

Note: remove the `volume` prop from OceanScene.svelte usage — volume now comes from `sceneAudioState`. The `<OceanAmbientAudio {variant} />` call in OceanScene.svelte stays the same (already only passes `variant`).

- [ ] **Step 2: Run `npm run check`**

Expected: 0 errors

- [ ] **Step 3: Commit**

```
git add src/lib/shared/3d/environments/scenes/ocean/OceanAmbientAudio.svelte
git commit -m "feat(ocean-audio): rewire OceanAmbientAudio to use engine + scene audio state"
```

---

### Task 5: SceneAudioPlayer UI Component

**Files:**
- Create: `src/lib/shared/3d/components/SceneAudioPlayer.svelte`

Mini jukebox overlay: collapsed music-note icon, expandable to frosted card with track info, volume, mute, and track selection.

- [ ] **Step 1: Create SceneAudioPlayer.svelte**

```svelte
<script lang="ts">
  import { sceneAudioState } from "../state/scene-audio-state.svelte";
  import { getTracksForVariant, getTrackById, getDefaultTrackForVariant, type AudioTrack } from "../audio/ocean-audio-tracks";
  import type { OceanVariant } from "../environments/domain/enums/environment-enums";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";

  const isOcean = $derived.by(() => {
    try {
      return (settingsService as any)?.settings?.backgroundType === BackgroundType.OCEAN;
    } catch {
      return false;
    }
  });

  // Read ocean variant from settings
  const oceanVariant = $derived.by((): OceanVariant => {
    try {
      return ((settingsService as any)?.settings?.oceanVariant as OceanVariant) ?? "abyss";
    } catch {
      return "abyss";
    }
  });

  let expanded = $state(false);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idle = $state(false);

  const variantTracks = $derived(getTracksForVariant(oceanVariant));

  const activeTrack = $derived.by((): AudioTrack => {
    const prefId = sceneAudioState.getTrackPreference(oceanVariant);
    if (prefId) {
      const t = getTrackById(prefId);
      if (t && t.variant === oceanVariant) return t;
    }
    return getDefaultTrackForVariant(oceanVariant);
  });

  const variantLabel = $derived(oceanVariant.charAt(0).toUpperCase() + oceanVariant.slice(1));

  function resetIdle() {
    idle = false;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { idle = true; }, expanded ? 8000 : 5000);
  }

  function toggle() {
    expanded = !expanded;
    resetIdle();
  }

  function selectTrack(track: AudioTrack) {
    sceneAudioState.setTrackPreference(oceanVariant, track.id);
    resetIdle();
  }

  function cycleTrack(dir: 1 | -1) {
    const idx = variantTracks.findIndex((t) => t.id === activeTrack.id);
    const next = (idx + dir + variantTracks.length) % variantTracks.length;
    sceneAudioState.setTrackPreference(oceanVariant, variantTracks[next].id);
    resetIdle();
  }

  function togglePlay() {
    sceneAudioState.playing = !sceneAudioState.playing;
    resetIdle();
  }

  function onVolumeInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    sceneAudioState.masterVolume = val;
    resetIdle();
  }

  $effect(() => {
    if (isOcean) resetIdle();
    return () => { if (idleTimer) clearTimeout(idleTimer); };
  });

  // Auto-expand on first audio unlock
  $effect(() => {
    if (sceneAudioState.audioUnlocked && sceneAudioState.playing && !expanded) {
      expanded = true;
      resetIdle();
    }
  });
</script>

{#if isOcean}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="scene-audio-player"
    class:expanded
    class:idle={idle && !expanded}
    onpointerenter={resetIdle}
    onpointermove={resetIdle}
  >
    {#if !expanded}
      <button
        type="button"
        class="collapsed-btn"
        class:playing={sceneAudioState.playing && sceneAudioState.audioUnlocked}
        onclick={toggle}
        aria-label="Open audio player"
      >
        <i class="fa-solid fa-music"></i>
      </button>
    {:else}
      <div class="expanded-card">
        <div class="header">
          <span class="track-label" title="{variantLabel}: {activeTrack.name}">
            <i class="fa-solid fa-music"></i>
            {variantLabel}: {activeTrack.name}
          </span>
          <button type="button" class="close-btn" onclick={toggle} aria-label="Collapse player">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="controls">
          <button type="button" class="ctrl-btn" onclick={() => cycleTrack(-1)} aria-label="Previous track">
            <i class="fa-solid fa-backward-step"></i>
          </button>
          <button type="button" class="ctrl-btn play-btn" onclick={togglePlay} aria-label={sceneAudioState.playing ? "Pause" : "Play"}>
            <i class="fa-solid {sceneAudioState.playing ? 'fa-pause' : 'fa-play'}"></i>
          </button>
          <button type="button" class="ctrl-btn" onclick={() => cycleTrack(1)} aria-label="Next track">
            <i class="fa-solid fa-forward-step"></i>
          </button>
          <input
            type="range"
            class="volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={sceneAudioState.masterVolume}
            oninput={onVolumeInput}
            aria-label="Volume"
          />
          <button
            type="button"
            class="ctrl-btn mute-btn"
            onclick={() => sceneAudioState.toggleMute()}
            aria-label={sceneAudioState.muted ? "Unmute" : "Mute"}
          >
            <i class="fa-solid {sceneAudioState.muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>
          </button>
        </div>

        <div class="track-list">
          {#each variantTracks as track}
            <button
              type="button"
              class="track-item"
              class:active={track.id === activeTrack.id}
              onclick={() => selectTrack(track)}
            >
              {#if track.id === activeTrack.id}
                <i class="fa-solid fa-caret-right"></i>
              {/if}
              {track.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .scene-audio-player {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 50;
    transition: opacity 0.3s ease;
  }

  .scene-audio-player.idle {
    opacity: 0.5;
  }

  .scene-audio-player:hover {
    opacity: 1;
  }

  .collapsed-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(100, 180, 255, 0.2);
    background: rgba(10, 20, 40, 0.7);
    backdrop-filter: blur(8px);
    color: rgba(180, 210, 255, 0.8);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .collapsed-btn:hover {
    background: rgba(20, 40, 70, 0.85);
    color: rgba(200, 230, 255, 1);
    border-color: rgba(100, 180, 255, 0.4);
  }

  .collapsed-btn.playing {
    animation: pulse-glow 3s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(100, 180, 255, 0.1); }
    50% { box-shadow: 0 0 12px rgba(100, 180, 255, 0.3); }
  }

  .expanded-card {
    width: 200px;
    background: rgba(10, 20, 40, 0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(100, 180, 255, 0.15);
    border-radius: 12px;
    overflow: hidden;
    animation: card-in 0.2s ease;
  }

  @keyframes card-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(100, 180, 255, 0.1);
  }

  .track-label {
    font-size: 11px;
    color: rgba(180, 210, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .track-label i {
    margin-right: 6px;
    font-size: 10px;
    opacity: 0.6;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(180, 210, 255, 0.5);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 12px;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .close-btn:hover {
    color: rgba(200, 230, 255, 0.9);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-bottom: 1px solid rgba(100, 180, 255, 0.1);
  }

  .ctrl-btn {
    background: none;
    border: none;
    color: rgba(180, 210, 255, 0.7);
    cursor: pointer;
    padding: 4px;
    font-size: 12px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .ctrl-btn:hover {
    color: rgba(200, 230, 255, 1);
    background: rgba(100, 180, 255, 0.1);
  }

  .play-btn {
    font-size: 14px;
  }

  .volume-slider {
    flex: 1;
    min-width: 0;
    height: 4px;
    appearance: none;
    background: rgba(100, 180, 255, 0.2);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(180, 210, 255, 0.8);
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(180, 210, 255, 0.8);
    border: none;
    cursor: pointer;
  }

  .mute-btn {
    font-size: 11px;
  }

  .track-list {
    padding: 4px 6px 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .track-item {
    background: none;
    border: none;
    color: rgba(180, 210, 255, 0.6);
    font-size: 11px;
    text-align: left;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .track-item:hover {
    background: rgba(100, 180, 255, 0.1);
    color: rgba(200, 230, 255, 0.9);
  }

  .track-item.active {
    color: rgba(200, 230, 255, 1);
    background: rgba(100, 180, 255, 0.15);
    font-weight: 500;
  }

  .track-item i {
    margin-right: 4px;
    font-size: 10px;
  }
</style>
```

- [ ] **Step 2: Run `npm run check`**

Expected: 0 errors (or warnings only about a11y on the volume input — acceptable)

- [ ] **Step 3: Commit**

```
git add src/lib/shared/3d/components/SceneAudioPlayer.svelte
git commit -m "feat(ocean-audio): add mini jukebox UI with track selection, volume, mute"
```

---

### Task 6: Mount SceneAudioPlayer in Viewer3DCanvas

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`

Add the player inside the `{#if !hideOverlays}` block.

- [ ] **Step 1: Add import at top of script**

After the existing import of `UnifiedTimeline`, add:

```typescript
import SceneAudioPlayer from "./SceneAudioPlayer.svelte";
```

- [ ] **Step 2: Add component in the template**

Inside the `{#if !hideOverlays}` block (line 188), add `<SceneAudioPlayer />` before the timeline anchor:

```svelte
    {#if !hideOverlays}
      <SceneAudioPlayer />
      <div class="timeline-anchor">
```

- [ ] **Step 3: Run `npm run check`**

Expected: 0 errors

- [ ] **Step 4: Commit**

```
git add src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "feat(ocean-audio): mount SceneAudioPlayer in viewer overlay"
```

---

### Task 7: Verify + Handle oceanVariant in Settings

The `SceneAudioPlayer` reads `oceanVariant` from settings. Check that this setting exists and is accessible.

- [ ] **Step 1: Grep for `oceanVariant` in settings service**

```bash
grep -rn "oceanVariant" src/lib/shared/settings/
```

If `oceanVariant` is not in the settings service, it may only be available in the 3D viewer state. In that case, update `SceneAudioPlayer` to read from `viewer3DState` instead (the `getViewer3DContext()` pattern used elsewhere). Either way, verify the variant is accessible and typed as `OceanVariant`.

- [ ] **Step 2: Fix the import path if needed**

If `oceanVariant` lives in viewer-3d-state instead of settings, update `SceneAudioPlayer.svelte`:

```typescript
import { getViewer3DContext } from "../context/viewer-3d-context";
const viewer3DState = getViewer3DContext();
const oceanVariant = $derived(viewer3DState.oceanVariant ?? "abyss");
```

- [ ] **Step 3: Run `npm run check`**

Expected: 0 errors

- [ ] **Step 4: Commit if any changes were needed**

```
git add -u
git commit -m "fix(ocean-audio): wire oceanVariant from correct state source"
```

---

### Task 8: Build Verification + Spec Update

- [ ] **Step 1: Run full build**

```bash
npm run check
npm run build
```

Both must pass with 0 errors.

- [ ] **Step 2: Update the spec**

Update `docs/superpowers/specs/backlog/2026-05-24-ocean-audio-system-design.md`:
- Set `plan_path: "docs/superpowers/plans/2026-05-24-ocean-audio-system.md"`
- Set `status: active`

- [ ] **Step 3: Commit everything**

```
git add docs/superpowers/specs/backlog/2026-05-24-ocean-audio-system-design.md
git commit -m "chore(ocean-audio): link plan to spec, mark active"
```

- [ ] **Step 4: Manual verification prompt**

Cannot verify audio visually. Ask user to check:
1. Open ocean scene in 3D viewer
2. Click anywhere to unlock audio — procedural drone + noise should fade in
3. Mini jukebox should appear top-left, auto-expand on first play
4. Try switching tracks — crossfade between presets
5. Test volume slider and mute button
6. Switch ocean variants — audio should crossfade to new variant's track
7. Collapse/expand jukebox, verify idle fade behavior
