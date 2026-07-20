import type { AudioAnalyzer } from "$lib/features/feedback/services/audio-analyzer";
import type { ErrorHandler } from "$lib/shared/application/services/error-handler";
import {
  buildPronunciationRecordingJobs,
  groupPronunciationRecordingJobs,
} from "../domain/recording-jobs";
import {
  suggestPronunciationTrim,
  type TrimSuggestion,
} from "../domain/voice-activity-trimmer";
import type {
  IPronunciationRecorder,
  MicrophoneOption,
  MicrophoneSettings,
  RawPronunciationTake,
} from "../services/contracts/IPronunciationRecorder";
import type { IPronunciationTakeStore } from "../services/contracts/IPronunciationTakeStore";

type RecorderPhase = "ready" | "recording" | "review" | "saving";
type BusyAction = "microphone" | "folder" | "export" | null;

interface PronunciationRecorderDependencies {
  recorder: IPronunciationRecorder;
  takeStore: IPronunciationTakeStore;
  audioAnalyzer: AudioAnalyzer;
  errorHandler: ErrorHandler;
}

export type PronunciationRecorderState = ReturnType<
  typeof createPronunciationRecorderState
>;

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function createPronunciationRecorderState(
  dependencies: PronunciationRecorderDependencies
) {
  const { recorder, takeStore, audioAnalyzer, errorHandler } = dependencies;
  const jobs = buildPronunciationRecordingJobs();
  const rows = groupPronunciationRecordingJobs(jobs);

  let currentIndex = $state(0);
  let phase = $state<RecorderPhase>("ready");
  let busyAction = $state<BusyAction>(null);
  let accepted = $state<Record<string, true>>({});
  let sessionTakes = $state<Map<string, Blob>>(new Map());
  let microphones = $state<MicrophoneOption[]>([]);
  let selectedDeviceId = $state("");
  let microphoneSettings = $state<MicrophoneSettings | null>(null);
  let micConnected = $state(false);
  let micLevel = $state(0);
  let folderName = $state<string | null>(null);
  let reviewTake = $state<RawPronunciationTake | null>(null);
  let trimSuggestion = $state<TrimSuggestion | null>(null);
  let trimStartSeconds = $state(0);
  let trimEndSeconds = $state(0);
  let recordingDurationSeconds = $state(0);
  let statusMessage = $state(
    "Choose the v1 folder for instant saves, then connect your microphone."
  );

  let recordingTimer: ReturnType<typeof setInterval> | null = null;
  let recordingStartedAt = 0;
  let meterFrame: number | null = null;

  function reportFailure(
    error: unknown,
    message: string,
    action: string,
    additionalData?: Record<string, unknown>
  ): void {
    const normalized = asError(error);
    errorHandler.showUserError({
      message,
      technicalDetails: normalized.message,
      error: normalized,
      severity: "error",
      context: {
        module: "lab",
        tab: "pronunciation-recorder",
        action,
        additionalData,
      },
    });
  }

  function startMeter(stream: MediaStream): void {
    stopMeter();
    audioAnalyzer.startWithStream(stream);

    const update = () => {
      const bins = audioAnalyzer.getFrequencyData();
      let peak = 0;
      for (const value of bins) peak = Math.max(peak, value);
      const next = peak / 255;
      micLevel = Math.max(next, micLevel * 0.76);
      meterFrame = requestAnimationFrame(update);
    };
    meterFrame = requestAnimationFrame(update);
  }

  function stopMeter(): void {
    if (meterFrame !== null) cancelAnimationFrame(meterFrame);
    meterFrame = null;
    audioAnalyzer.stop();
    micLevel = 0;
  }

  function startRecordingClock(): void {
    stopRecordingClock();
    recordingStartedAt = performance.now();
    recordingDurationSeconds = 0;
    recordingTimer = setInterval(() => {
      recordingDurationSeconds =
        (performance.now() - recordingStartedAt) / 1000;
    }, 50);
  }

  function stopRecordingClock(): void {
    if (recordingTimer) clearInterval(recordingTimer);
    recordingTimer = null;
  }

  async function initialize(): Promise<void> {
    if (!recorder.isSupported()) {
      statusMessage =
        "Microphone recording is unavailable in this browser. Chrome or Edge can run this studio.";
      return;
    }

    try {
      microphones = await recorder.listMicrophones();
    } catch {
      // Device labels commonly remain unavailable until microphone permission
      // is granted. The explicit Connect action handles that permission path.
    }
  }

  async function connectMicrophone(deviceId = selectedDeviceId): Promise<void> {
    if (phase !== "ready" || busyAction) return;
    busyAction = "microphone";
    try {
      const connected = await recorder.connect(deviceId || undefined);
      microphones = connected.devices;
      microphoneSettings = connected.settings;
      selectedDeviceId =
        connected.stream.getAudioTracks()[0]?.getSettings().deviceId ??
        deviceId;
      micConnected = true;
      startMeter(connected.stream);
      statusMessage = `Listening through ${connected.settings.label}.`;
    } catch (error) {
      micConnected = false;
      microphoneSettings = null;
      stopMeter();
      reportFailure(
        error,
        "The microphone could not be connected. Check browser permission and whether another app has the device open.",
        "connect-microphone",
        { deviceId: deviceId || "default" }
      );
    } finally {
      busyAction = null;
    }
  }

  async function connectFolder(): Promise<void> {
    if (phase !== "ready" || busyAction) return;
    busyAction = "folder";
    try {
      const connected = await takeStore.connectFolder(jobs);
      folderName = connected.name;
      const nextAccepted = { ...accepted };
      for (const jobId of connected.existingJobIds) nextAccepted[jobId] = true;

      // A session can begin in memory and gain a folder later. Flush every
      // approved take before calling the folder connected.
      for (const [jobId, wav] of sessionTakes) {
        const job = jobs.find((candidate) => candidate.id === jobId);
        if (!job) continue;
        await takeStore.saveTake(job, wav, jobs);
        nextAccepted[jobId] = true;
      }
      accepted = nextAccepted;
      statusMessage = `Saving approved takes directly to ${connected.name}.`;
      moveToNextIncomplete(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      reportFailure(
        error,
        "The recording folder could not be opened. Choose static/audio/pronunciations/v1 and allow read-write access.",
        "connect-recording-folder"
      );
    } finally {
      busyAction = null;
    }
  }

  async function startTake(): Promise<void> {
    if (phase !== "ready" || busyAction) return;
    if (!micConnected) {
      await connectMicrophone();
      if (!micConnected) return;
    }

    try {
      await recorder.startTake();
      phase = "recording";
      statusMessage = "Recording the full carrier phrase.";
      startRecordingClock();
    } catch (error) {
      reportFailure(
        error,
        "The take could not start. Reconnect the microphone and try again.",
        "start-pronunciation-take",
        { jobId: jobs[currentIndex]?.id }
      );
    }
  }

  async function finishTake(): Promise<void> {
    if (phase !== "recording") return;
    stopRecordingClock();
    try {
      const take = await recorder.finishTake();
      const job = jobs[currentIndex]!;
      const suggestion = suggestPronunciationTrim(
        take.audioBuffer.getChannelData(0),
        take.audioBuffer.sampleRate,
        job.targetSegment
      );
      reviewTake = take;
      trimSuggestion = suggestion;
      trimStartSeconds = suggestion.startSeconds;
      trimEndSeconds = suggestion.endSeconds;
      phase = "review";
      statusMessage =
        suggestion.confidence === "strong"
          ? "The target was found. Listen once, then approve or adjust the handles."
          : "The crop needs a look. Drag the handles around the target name, then listen.";
    } catch (error) {
      phase = "ready";
      reportFailure(
        error,
        "The take could not be finished. The previous approved file is untouched.",
        "finish-pronunciation-take",
        { jobId: jobs[currentIndex]?.id }
      );
    }
  }

  async function cancelRecording(): Promise<void> {
    if (phase !== "recording") return;
    stopRecordingClock();
    await recorder.discardTake();
    phase = "ready";
    recordingDurationSeconds = 0;
    statusMessage = "Take discarded. The approved file, if any, is unchanged.";
  }

  function discardReview(): void {
    if (phase !== "review") return;
    reviewTake = null;
    trimSuggestion = null;
    trimStartSeconds = 0;
    trimEndSeconds = 0;
    phase = "ready";
    statusMessage =
      "Take discarded. Record the carrier phrase again when ready.";
  }

  function setTrimRange(startSeconds: number, endSeconds: number): void {
    if (!reviewTake) return;
    trimStartSeconds = Math.max(
      0,
      Math.min(reviewTake.durationSeconds, startSeconds)
    );
    trimEndSeconds = Math.max(
      trimStartSeconds,
      Math.min(reviewTake.durationSeconds, endSeconds)
    );
  }

  async function acceptTake(): Promise<void> {
    if (phase !== "review" || !reviewTake) return;
    phase = "saving";
    const job = jobs[currentIndex]!;
    try {
      const delivery = await recorder.renderDelivery(reviewTake.audioBuffer, {
        startSeconds: trimStartSeconds,
        endSeconds: trimEndSeconds,
      });
      if (folderName) await takeStore.saveTake(job, delivery, jobs);

      sessionTakes = new Map(sessionTakes).set(job.id, delivery);
      accepted = { ...accepted, [job.id]: true };
      reviewTake = null;
      trimSuggestion = null;
      phase = "ready";
      statusMessage = folderName
        ? `Saved ${job.outputPath}.`
        : `Approved ${job.outputPath} in browser memory. Export a ZIP before closing this tab.`;
      moveToNextIncomplete(true);
    } catch (error) {
      phase = "review";
      reportFailure(
        error,
        "The approved take could not be saved. It is still open in the editor, and the previous file is untouched.",
        "save-pronunciation-take",
        { jobId: job.id, directSave: Boolean(folderName) }
      );
    }
  }

  async function exportSessionZip(): Promise<void> {
    if (sessionTakes.size === 0 || busyAction) return;
    busyAction = "export";
    try {
      const count = await takeStore.exportSessionZip(sessionTakes, jobs);
      statusMessage = `Exported ${count} approved session takes.`;
    } catch (error) {
      reportFailure(
        error,
        "The pronunciation ZIP could not be exported.",
        "export-pronunciation-zip",
        { takeCount: sessionTakes.size }
      );
    } finally {
      busyAction = null;
    }
  }

  function selectJob(jobId: string): void {
    if (phase !== "ready" || busyAction) return;
    const index = jobs.findIndex((job) => job.id === jobId);
    if (index >= 0) currentIndex = index;
  }

  function move(delta: number): void {
    if (phase !== "ready" || busyAction) return;
    currentIndex = (currentIndex + delta + jobs.length) % jobs.length;
  }

  function moveToNextIncomplete(startAfterCurrent: boolean): void {
    const offsetStart = startAfterCurrent ? 1 : 0;
    for (
      let offset = offsetStart;
      offset < jobs.length + offsetStart;
      offset++
    ) {
      const index = (currentIndex + offset) % jobs.length;
      const candidate = jobs[index];
      if (candidate && !accepted[candidate.id]) {
        currentIndex = index;
        return;
      }
    }
  }

  function isAccepted(jobId: string): boolean {
    return Boolean(accepted[jobId]);
  }

  function dispose(): void {
    stopRecordingClock();
    stopMeter();
    void recorder.dispose();
    takeStore.disconnect();
  }

  return {
    get jobs() {
      return jobs;
    },
    get rows() {
      return rows;
    },
    get currentJob() {
      return jobs[currentIndex]!;
    },
    get currentIndex() {
      return currentIndex;
    },
    get phase() {
      return phase;
    },
    get busyAction() {
      return busyAction;
    },
    get acceptedCount() {
      return Object.keys(accepted).length;
    },
    get progressPercent() {
      return (Object.keys(accepted).length / jobs.length) * 100;
    },
    get sessionTakeCount() {
      return sessionTakes.size;
    },
    get microphones() {
      return microphones;
    },
    get selectedDeviceId() {
      return selectedDeviceId;
    },
    get microphoneSettings() {
      return microphoneSettings;
    },
    get micConnected() {
      return micConnected;
    },
    get micLevel() {
      return micLevel;
    },
    get folderName() {
      return folderName;
    },
    get directSaveSupported() {
      return takeStore.supportsDirectSave();
    },
    get reviewTake() {
      return reviewTake;
    },
    get trimSuggestion() {
      return trimSuggestion;
    },
    get trimStartSeconds() {
      return trimStartSeconds;
    },
    get trimEndSeconds() {
      return trimEndSeconds;
    },
    get recordingDurationSeconds() {
      return recordingDurationSeconds;
    },
    get statusMessage() {
      return statusMessage;
    },
    get navigationLocked() {
      return phase !== "ready" || Boolean(busyAction);
    },
    initialize,
    connectMicrophone,
    connectFolder,
    startTake,
    finishTake,
    cancelRecording,
    discardReview,
    setTrimRange,
    acceptTake,
    exportSessionZip,
    selectJob,
    move,
    isAccepted,
    dispose,
  };
}
