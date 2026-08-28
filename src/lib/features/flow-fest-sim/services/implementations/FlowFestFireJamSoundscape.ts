import type { FlowFestSiteAudioMix } from "../../domain/flow-fest-site-audio";
import type {
  FlowFestFireJamSpatialFrame,
  FlowFestFireJamSoundscapeSnapshot,
  IFlowFestFireJamSoundscape,
} from "../contracts/IFlowFestFireJamSoundscape";

interface FlowFestFireJamAudioGraph {
  master: GainNode;
  arrivalGain: GainNode;
  woodlandGain: GainNode;
  campGain: GainNode;
  fireGain: GainNode;
  firePanner: PannerNode;
  ledGain: GainNode;
  ledPanner: PannerNode;
  crowdGain: GainNode;
  crowdPanner: PannerNode;
  sources: AudioScheduledSourceNode[];
}

const SILENT_MIX: FlowFestSiteAudioMix = {
  arrival: 0,
  woodland: 0,
  camp: 0,
  fire: 0,
  led: 0,
  crowd: 0,
  master: 0,
  dominantLayer: "woodland",
};

function createDeterministicNoise(context: AudioContext): AudioBuffer {
  const frameCount = context.sampleRate * 4;
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let state = 0x5f3759df;
  let brown = 0;

  for (let index = 0; index < frameCount; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const white = (state / 0xffffffff) * 2 - 1;
    brown = (brown + white * 0.018) / 1.018;
    samples[index] = Math.max(-1, Math.min(1, brown * 3.2));
  }
  return buffer;
}

export class FlowFestFireJamSoundscape implements IFlowFestFireJamSoundscape {
  private context: AudioContext | null = null;
  private graph: FlowFestFireJamAudioGraph | null = null;
  private mix: FlowFestSiteAudioMix = SILENT_MIX;
  private graphBuildCount = 0;
  private sourceStartCount = 0;
  private spatialFrameCount = 0;
  private spatialFrame: FlowFestFireJamSpatialFrame | null = null;

  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    const AudioContextOwner =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextOwner) return;
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContextOwner();
      this.graph = this.buildGraph(this.context);
    }
    if (this.context.state === "suspended") await this.context.resume();
    this.applyMix();
    this.applySpatialFrame();
  }

  setMix(mix: FlowFestSiteAudioMix): void {
    this.mix = { ...mix };
    this.applyMix();
  }

  setSpatialFrame(frame: FlowFestFireJamSpatialFrame): void {
    this.spatialFrame = {
      listener: { ...frame.listener },
      fire: { ...frame.fire },
      led: { ...frame.led },
      crowd: { ...frame.crowd },
    };
    this.spatialFrameCount += 1;
    this.applySpatialFrame();
  }

  triggerJoinCue(): void {
    const context = this.context;
    const graph = this.graph;
    if (!context || !graph || context.state !== "running") return;
    const now = context.currentTime;
    for (const [index, frequency] of [196, 293.66, 392, 587.33].entries()) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = index % 2 === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now);
      envelope.gain.setValueAtTime(0.0001, now + index * 0.055);
      envelope.gain.exponentialRampToValueAtTime(
        0.055,
        now + index * 0.055 + 0.025
      );
      envelope.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 1.15 + index * 0.07
      );
      oscillator.connect(envelope);
      envelope.connect(graph.master);
      oscillator.start(now + index * 0.055);
      oscillator.stop(now + 1.25 + index * 0.07);
    }
  }

  snapshot(): FlowFestFireJamSoundscapeSnapshot {
    return {
      supported:
        typeof window !== "undefined" &&
        Boolean(
          window.AudioContext ??
          (
            window as unknown as {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext
        ),
      unlocked: this.context?.state === "running",
      playing: Boolean(this.graph && this.context?.state === "running"),
      graphBuildCount: this.graphBuildCount,
      sourceStartCount: this.sourceStartCount,
      spatialFrameCount: this.spatialFrameCount,
      spatializedSources: this.graph ? 3 : 0,
      mix: { ...this.mix },
    };
  }

  dispose(): void {
    const context = this.context;
    const graph = this.graph;
    this.graph = null;
    this.context = null;
    if (graph) {
      for (const source of graph.sources) {
        try {
          source.stop();
        } catch {
          // A source that has already stopped is already in the state we need.
        }
      }
    }
    if (context && context.state !== "closed") void context.close();
  }

  private buildGraph(context: AudioContext): FlowFestFireJamAudioGraph {
    this.graphBuildCount += 1;
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const noise = context.createBufferSource();
    noise.buffer = createDeterministicNoise(context);
    noise.loop = true;

    const arrivalFilter = context.createBiquadFilter();
    arrivalFilter.type = "lowpass";
    arrivalFilter.frequency.value = 240;
    const arrivalGain = context.createGain();
    arrivalGain.gain.value = 0;
    noise.connect(arrivalFilter);
    arrivalFilter.connect(arrivalGain);
    arrivalGain.connect(master);

    const woodlandFilter = context.createBiquadFilter();
    woodlandFilter.type = "highpass";
    woodlandFilter.frequency.value = 2100;
    const woodlandGain = context.createGain();
    woodlandGain.gain.value = 0;
    noise.connect(woodlandFilter);
    woodlandFilter.connect(woodlandGain);
    woodlandGain.connect(master);

    const campFilter = context.createBiquadFilter();
    campFilter.type = "bandpass";
    campFilter.frequency.value = 380;
    campFilter.Q.value = 0.34;
    const campGain = context.createGain();
    campGain.gain.value = 0;
    noise.connect(campFilter);
    campFilter.connect(campGain);
    campGain.connect(master);

    const fireFilter = context.createBiquadFilter();
    fireFilter.type = "bandpass";
    fireFilter.frequency.value = 940;
    fireFilter.Q.value = 0.56;
    const fireGain = context.createGain();
    fireGain.gain.value = 0;
    noise.connect(fireFilter);
    fireFilter.connect(fireGain);
    const firePanner = this.createPanner(context);
    fireGain.connect(firePanner);
    firePanner.connect(master);

    const crowdFilter = context.createBiquadFilter();
    crowdFilter.type = "lowpass";
    crowdFilter.frequency.value = 520;
    const crowdGain = context.createGain();
    crowdGain.gain.value = 0;
    noise.connect(crowdFilter);
    crowdFilter.connect(crowdGain);
    const crowdPanner = this.createPanner(context);
    crowdGain.connect(crowdPanner);
    crowdPanner.connect(master);

    const ledFundamental = context.createOscillator();
    ledFundamental.type = "sine";
    ledFundamental.frequency.value = 55;
    const ledOvertone = context.createOscillator();
    ledOvertone.type = "triangle";
    ledOvertone.frequency.value = 110;
    const ledGain = context.createGain();
    ledGain.gain.value = 0;
    ledFundamental.connect(ledGain);
    ledOvertone.connect(ledGain);
    const ledPanner = this.createPanner(context);
    ledGain.connect(ledPanner);
    ledPanner.connect(master);

    noise.start();
    ledFundamental.start();
    ledOvertone.start();
    this.sourceStartCount += 3;

    return {
      master,
      arrivalGain,
      woodlandGain,
      campGain,
      fireGain,
      firePanner,
      ledGain,
      ledPanner,
      crowdGain,
      crowdPanner,
      sources: [noise, ledFundamental, ledOvertone],
    };
  }

  private createPanner(context: AudioContext): PannerNode {
    const panner = context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1;
    panner.maxDistance = 200;
    // The domain mix already owns distance attenuation. The panner contributes
    // direction only, so approaching the circle never gets attenuated twice.
    panner.rolloffFactor = 0;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    return panner;
  }

  private applySpatialFrame(): void {
    const context = this.context;
    const graph = this.graph;
    const frame = this.spatialFrame;
    if (!context || !graph || !frame) return;
    const now = context.currentTime;
    const setPosition = (
      owner: PannerNode,
      point: { x: number; y: number; z: number }
    ): void => {
      owner.positionX.setValueAtTime(point.x, now);
      owner.positionY.setValueAtTime(point.y, now);
      owner.positionZ.setValueAtTime(point.z, now);
    };
    setPosition(graph.firePanner, frame.fire);
    setPosition(graph.ledPanner, frame.led);
    setPosition(graph.crowdPanner, frame.crowd);

    const listener = context.listener;
    listener.positionX.setValueAtTime(frame.listener.x, now);
    listener.positionY.setValueAtTime(frame.listener.y, now);
    listener.positionZ.setValueAtTime(frame.listener.z, now);
    listener.forwardX.setValueAtTime(Math.sin(frame.listener.yawRadians), now);
    listener.forwardY.setValueAtTime(0, now);
    listener.forwardZ.setValueAtTime(Math.cos(frame.listener.yawRadians), now);
    listener.upX.setValueAtTime(0, now);
    listener.upY.setValueAtTime(1, now);
    listener.upZ.setValueAtTime(0, now);
  }

  private applyMix(): void {
    const context = this.context;
    const graph = this.graph;
    if (!context || !graph) return;
    const now = context.currentTime;
    graph.master.gain.setTargetAtTime(this.mix.master * 0.22, now, 0.18);
    graph.arrivalGain.gain.setTargetAtTime(this.mix.arrival * 0.09, now, 0.8);
    graph.woodlandGain.gain.setTargetAtTime(
      this.mix.woodland * 0.055,
      now,
      1.1
    );
    graph.campGain.gain.setTargetAtTime(this.mix.camp * 0.075, now, 0.75);
    graph.fireGain.gain.setTargetAtTime(this.mix.fire * 0.28, now, 0.24);
    graph.ledGain.gain.setTargetAtTime(this.mix.led * 0.035, now, 0.32);
    graph.crowdGain.gain.setTargetAtTime(this.mix.crowd * 0.12, now, 0.4);
  }
}
