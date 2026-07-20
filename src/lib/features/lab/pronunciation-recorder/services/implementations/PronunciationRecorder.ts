import {
  AudioBufferSource,
  BufferTarget,
  MediaStreamAudioTrackSource,
  Output,
  WavOutputFormat,
} from "mediabunny";

import type {
  ConnectedMicrophone,
  DeliveryRange,
  IPronunciationRecorder,
  MicrophoneOption,
  RawPronunciationTake,
} from "../contracts/IPronunciationRecorder";

const CAPTURE_SAMPLE_RATE = 48_000;
const EDGE_FADE_SECONDS = 0.008;

export class PronunciationRecorder implements IPronunciationRecorder {
  private stream: MediaStream | null = null;
  private output: Output<WavOutputFormat, BufferTarget> | null = null;
  private target: BufferTarget | null = null;

  isSupported(): boolean {
    return Boolean(
      typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia
    );
  }

  async listMicrophones(): Promise<MicrophoneOption[]> {
    if (!this.isSupported()) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    let unnamed = 0;
    return devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => {
        unnamed += device.label ? 0 : 1;
        return {
          deviceId: device.deviceId,
          label: device.label || `Microphone ${unnamed}`,
        };
      });
  }

  async connect(deviceId?: string): Promise<ConnectedMicrophone> {
    await this.dispose();
    if (!this.isSupported()) {
      throw new Error("This browser cannot capture microphone audio.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        sampleRate: { ideal: CAPTURE_SAMPLE_RATE },
        sampleSize: { ideal: 24 },
        channelCount: { ideal: 1 },
        echoCancellation: { ideal: false },
        noiseSuppression: { ideal: false },
        autoGainControl: { ideal: false },
      },
    });

    const track = stream.getAudioTracks()[0];
    if (!track) {
      stream.getTracks().forEach((candidate) => candidate.stop());
      throw new Error(
        "The selected microphone did not provide an audio track."
      );
    }

    // Music asks Chromium to preserve fidelity instead of optimizing the track
    // for a call. The requested processing flags are still verified below.
    track.contentHint = "music";
    this.stream = stream;

    const settings = track.getSettings();
    return {
      stream,
      devices: await this.listMicrophones(),
      settings: {
        label: track.label || "Connected microphone",
        sampleRate: settings.sampleRate,
        sampleSize: settings.sampleSize,
        channelCount: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl,
      },
    };
  }

  async startTake(): Promise<void> {
    if (this.output) {
      throw new Error("A pronunciation take is already recording.");
    }

    const track = this.stream?.getAudioTracks()[0];
    if (track?.readyState !== "live") {
      throw new Error("Connect a live microphone before recording.");
    }

    const target = new BufferTarget();
    const output = new Output({
      format: new WavOutputFormat(),
      target,
    });
    const source = new MediaStreamAudioTrackSource(
      track as MediaStreamAudioTrack,
      {
        codec: "pcm-s24",
        transform: {
          numberOfChannels: 1,
          sampleRate: CAPTURE_SAMPLE_RATE,
        },
      },
      { timestampBase: "zero" }
    );
    output.addAudioTrack(source, { name: "TKA pronunciation carrier" });

    this.target = target;
    this.output = output;
    try {
      await output.start();
    } catch (error) {
      this.output = null;
      this.target = null;
      await output.cancel().catch(() => undefined);
      throw error;
    }
  }

  async finishTake(): Promise<RawPronunciationTake> {
    const output = this.output;
    const target = this.target;
    if (!output || !target) {
      throw new Error("No pronunciation take is recording.");
    }

    this.output = null;
    this.target = null;
    await output.finalize();
    if (!target.buffer) {
      throw new Error("The microphone capture ended without audio data.");
    }

    const blob = new Blob([target.buffer], { type: "audio/wav" });
    const audioContext = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE });
    try {
      const audioBuffer = await audioContext.decodeAudioData(
        await blob.arrayBuffer()
      );
      return {
        blob,
        audioBuffer,
        durationSeconds: audioBuffer.duration,
      };
    } finally {
      await audioContext.close().catch(() => undefined);
    }
  }

  async discardTake(): Promise<void> {
    const output = this.output;
    this.output = null;
    this.target = null;
    if (output) await output.cancel().catch(() => undefined);
  }

  async renderDelivery(
    audioBuffer: AudioBuffer,
    range: DeliveryRange
  ): Promise<Blob> {
    const start = Math.max(
      0,
      Math.min(audioBuffer.duration, range.startSeconds)
    );
    const end = Math.max(
      start,
      Math.min(audioBuffer.duration, range.endSeconds)
    );
    if (end - start < 0.05) {
      throw new Error("The selected pronunciation crop is too short.");
    }

    const startFrame = Math.floor(start * audioBuffer.sampleRate);
    const endFrame = Math.ceil(end * audioBuffer.sampleRate);
    const frameCount = Math.max(1, endFrame - startFrame);
    const cropped = new AudioBuffer({
      length: frameCount,
      numberOfChannels: 1,
      sampleRate: audioBuffer.sampleRate,
    });
    const destination = cropped.getChannelData(0);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const source = audioBuffer.getChannelData(channel);
      for (let frame = 0; frame < frameCount; frame++) {
        destination[frame] =
          (destination[frame] ?? 0) +
          (source[startFrame + frame] ?? 0) / audioBuffer.numberOfChannels;
      }
    }

    const fadeFrames = Math.min(
      Math.round(audioBuffer.sampleRate * EDGE_FADE_SECONDS),
      Math.floor(frameCount / 4)
    );
    for (let frame = 0; frame < fadeFrames; frame++) {
      const progress = (frame + 1) / Math.max(1, fadeFrames);
      const gain = Math.sin((progress * Math.PI) / 2);
      destination[frame] = (destination[frame] ?? 0) * gain;
      const tail = frameCount - 1 - frame;
      destination[tail] = (destination[tail] ?? 0) * gain;
    }

    const target = new BufferTarget();
    const output = new Output({
      format: new WavOutputFormat(),
      target,
    });
    const source = new AudioBufferSource({
      codec: "pcm-s16",
      transform: {
        numberOfChannels: 1,
        sampleRate: CAPTURE_SAMPLE_RATE,
      },
    });
    output.addAudioTrack(source, { name: "TKA pronunciation" });
    await output.start();
    await source.add(cropped);
    await output.finalize();

    if (!target.buffer) {
      throw new Error("The delivery WAV could not be created.");
    }
    return new Blob([target.buffer], { type: "audio/wav" });
  }

  async dispose(): Promise<void> {
    await this.discardTake();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
