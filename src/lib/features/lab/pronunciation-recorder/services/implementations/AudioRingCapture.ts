import { SampleRing } from "../../domain/sample-ring";
import type { CapturedSpan, IAudioRingCapture } from "../contracts/IAudioRingCapture";

const RING_SECONDS = 30;
const CAPTURE_SAMPLE_RATE = 48_000;

export class AudioRingCapture implements IAudioRingCapture {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private ring: SampleRing | null = null;
  private peak = 0;

  get sampleRate(): number {
    return this.context?.sampleRate ?? CAPTURE_SAMPLE_RATE;
  }

  get clock(): number {
    return this.ring?.writtenSamples ?? 0;
  }

  get levelDb(): number {
    return this.peak > 0 ? 20 * Math.log10(this.peak) : -100;
  }

  async start(stream: MediaStream): Promise<void> {
    const context = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE });
    await context.audioWorklet.addModule("/worklets/pronunciation-capture-processor.js");

    this.ring = new SampleRing(Math.round(context.sampleRate * RING_SECONDS));
    this.source = context.createMediaStreamSource(stream);
    this.node = new AudioWorkletNode(context, "pronunciation-capture", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
    });

    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const frame = event.data;
      this.ring?.write(frame);

      // Decayed peak: a meter that only rises reads as clipping forever after
      // one loud syllable, and a meter that only shows the current frame is
      // unreadable at 48 kHz.
      let framePeak = 0;
      for (let index = 0; index < frame.length; index++) {
        const magnitude = Math.abs(frame[index] ?? 0);
        if (magnitude > framePeak) framePeak = magnitude;
      }
      this.peak = Math.max(framePeak, this.peak * 0.92);
    };

    this.source.connect(this.node);
    this.context = context;
  }

  readSeconds(fromSeconds: number, toSeconds: number): CapturedSpan | null {
    if (!this.ring) return null;
    const rate = this.sampleRate;
    const samples = this.ring.read(
      Math.max(0, Math.round(fromSeconds * rate)),
      Math.round(toSeconds * rate)
    );
    return samples ? { samples, sampleRate: rate } : null;
  }

  async stop(): Promise<void> {
    this.node?.port.close();
    this.source?.disconnect();
    this.node?.disconnect();
    await this.context?.close();
    this.context = null;
    this.source = null;
    this.node = null;
    this.ring = null;
    this.peak = 0;
  }
}
