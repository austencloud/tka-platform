import type {
  ConnectedMicrophone,
  IPronunciationRecorder,
  MicrophoneOption,
} from "../contracts/IPronunciationRecorder";

const CAPTURE_SAMPLE_RATE = 48_000;

export class PronunciationRecorder implements IPronunciationRecorder {
  private stream: MediaStream | null = null;

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

  async dispose(): Promise<void> {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
