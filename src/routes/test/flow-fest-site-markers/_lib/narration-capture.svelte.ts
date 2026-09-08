/**
 * Timestamped dictation for the site-marker page.
 *
 * The point is not voice commands. It is that saying "and here's where it veers
 * up and goes pretty steep" while tracing that road is far faster than typing a
 * note per marker, and the words are only useful if they can be matched to the
 * stroke they describe. So every finalized utterance is stamped against the
 * same clock the markers use, and the two land in one file.
 *
 * `WakeWordDetector` in `shared/voice-control` is the closest existing owner
 * and is deliberately not reused: it matches a wake phrase, switches into a
 * command mode, and emits discrete commands. It has no notion of a continuous
 * transcript with times, which is the entire contract here.
 */

export interface NarrationSegment {
  /** Milliseconds since capture started. */
  atMs: number;
  text: string;
}

/** Chrome ends recognition on silence; restarting keeps one continuous clock. */
const RESTART_DELAY_MS = 250;

function speechRecognitionConstructor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const candidate = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export interface NarrationCapture {
  readonly supported: boolean;
  readonly recording: boolean;
  readonly segments: NarrationSegment[];
  /** The utterance in progress, so the author can see the mic is live. */
  readonly interim: string;
  readonly startedAt: string | null;
  readonly error: string | null;
  /** Milliseconds since start, or null when idle. Read it, do not cache it. */
  elapsedMs(): number | null;
  start(): void;
  stop(): void;
  clear(): void;
  dispose(): void;
}

export function createNarrationCapture(): NarrationCapture {
  const Recognition = speechRecognitionConstructor();
  let recognition: SpeechRecognition | null = null;
  let startedAtEpoch: number | null = null;
  let wantsToRun = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  let recording = $state(false);
  let segments = $state<NarrationSegment[]>([]);
  let interim = $state("");
  let startedAt = $state<string | null>(null);
  let error = $state<string | null>(null);

  function beginSession(): void {
    if (!Recognition) return;
    const session = new Recognition();
    session.continuous = true;
    session.interimResults = true;
    session.lang = "en-US";

    session.onresult = (event: SpeechRecognitionEvent) => {
      let pending = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]!;
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) {
          segments = [
            ...segments,
            { atMs: Math.max(0, Date.now() - (startedAtEpoch ?? Date.now())), text },
          ];
        } else {
          pending = text;
        }
      }
      interim = pending;
    };

    session.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      error =
        event.error === "not-allowed"
          ? "This browser blocked the microphone. Allow it in the address bar, then start again."
          : `Speech recognition stopped: ${event.error}.`;
      wantsToRun = false;
      recording = false;
    };

    session.onend = () => {
      interim = "";
      if (!wantsToRun) {
        recording = false;
        return;
      }
      restartTimer = setTimeout(beginSession, RESTART_DELAY_MS);
    };

    recognition = session;
    session.start();
  }

  return {
    get supported() {
      return Recognition !== null;
    },
    get recording() {
      return recording;
    },
    get segments() {
      return segments;
    },
    get interim() {
      return interim;
    },
    get startedAt() {
      return startedAt;
    },
    get error() {
      return error;
    },
    elapsedMs() {
      return startedAtEpoch === null ? null : Date.now() - startedAtEpoch;
    },
    start() {
      if (recording) return;
      if (!Recognition) {
        error =
          "This browser has no speech recognition. Chrome does; type notes instead.";
        return;
      }
      error = null;
      wantsToRun = true;
      recording = true;
      if (startedAtEpoch === null) {
        startedAtEpoch = Date.now();
        startedAt = new Date(startedAtEpoch).toISOString();
      }
      beginSession();
    },
    stop() {
      wantsToRun = false;
      recording = false;
      interim = "";
      if (restartTimer !== null) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      recognition?.stop();
    },
    clear() {
      segments = [];
      interim = "";
      startedAtEpoch = null;
      startedAt = null;
      error = null;
    },
    dispose() {
      wantsToRun = false;
      recording = false;
      if (restartTimer !== null) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      recognition?.abort();
      recognition = null;
    },
  };
}
