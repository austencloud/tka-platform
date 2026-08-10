import type {
  TrackParams,
  NoiseType,
  DetailEventType,
} from "./ocean-audio-tracks";

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
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
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
  onScheduleNext: () => void
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
      env.gain.linearRampToValueAtTime(
        params.detailGain / harmonics.length,
        t + 2
      );
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

  get isPlaying(): boolean {
    return this.graph !== null;
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
      masterGain,
      drone,
      droneGain,
      sub,
      subGain,
      lfo,
      lfoGain,
      noiseSource,
      noiseFilter,
      noiseGain: noiseGainNode,
      detailGain: detailGainNode,
      detailTimer: null,
    };

    masterGain.gain.setTargetAtTime(this._volume, ctx.currentTime, 0.8);

    this.scheduleNextDetail();
  }

  private scheduleNextDetail(): void {
    if (!this.graph || !this.ctx || !this.currentParams) return;
    const p = this.currentParams;
    if (p.detailEvent === "none") return;
    const delay =
      (p.detailMinInterval +
        Math.random() * (p.detailMaxInterval - p.detailMinInterval)) *
      1000;
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
      g.drone.stop();
      g.drone.disconnect();
      g.sub.stop();
      g.sub.disconnect();
      g.lfo.stop();
      g.lfo.disconnect();
      g.noiseSource.stop();
      g.noiseSource.disconnect();
      g.noiseFilter.disconnect();
      g.droneGain.disconnect();
      g.subGain.disconnect();
      g.noiseGain.disconnect();
      g.lfoGain.disconnect();
      g.detailGain.disconnect();
      g.masterGain.disconnect();
    } catch {
      /* already stopped */
    }
  }
}
