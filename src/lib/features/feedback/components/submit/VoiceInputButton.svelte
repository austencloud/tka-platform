<!-- VoiceInputButton - Web Speech API voice-to-text for feedback -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  // Web Speech API type declarations
  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    [index: number]: { transcript: string; confidence: number };
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEventInit extends EventInit {
    resultIndex?: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionEventCustom extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEventCustom extends Event {
    readonly error: string;
    readonly message: string;
  }

  interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEventCustom) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventCustom) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
  }

  // Constants
  const MAX_RECORDING_DURATION_MS = 30 * 1000; // 30 seconds of silence

  // Props
  const {
    onTranscript,
    onInterimTranscript,
    onRecordingEnd,
    onTimeout,
    disabled = false,
  } = $props<{
    onTranscript: (text: string, isFinal: boolean) => void;
    onInterimTranscript?: (text: string) => void;
    onRecordingEnd?: () => void;
    onTimeout?: () => void;
    disabled?: boolean;
  }>();

  // State
  let isRecording = $state(false);
  let isSupported = $state(false);
  let recognition: SpeechRecognitionInstance | null = $state(null);
  let baseTranscriptLength = 0; // Track where we started this recording session
  let intentionalStop = false; // Track if user clicked stop vs silence timeout
  let maxDurationTimeout: ReturnType<typeof setTimeout> | null = null;

  // Stop recording when tab becomes hidden (user switches away)
  function handleVisibilityChange() {
    if (document.hidden && isRecording) {
      stopRecording();
    }
  }

  // Check browser support
  onMount(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    isSupported = !!SpeechRecognitionCtor;

    if (isSupported) {
      recognition = new SpeechRecognitionCtor() as SpeechRecognitionInstance;
      recognition.continuous = true;
      recognition.interimResults = true; // Enable live streaming
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEventCustom) => {
        // Reset timeout on any speech activity
        resetMaxDurationTimeout();

        let interimTranscript = "";
        let finalTranscript = "";

        // Process all results from the last finalized index
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result) continue;
          const firstAlternative = result[0];
          if (!firstAlternative) continue;
          const transcript = firstAlternative.transcript;
          if (result.isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        // Stream interim results for live preview
        if (interimTranscript && onInterimTranscript) {
          onInterimTranscript(interimTranscript);
        }

        // Commit final results
        if (finalTranscript) {
          onTranscript(finalTranscript.trim(), true);
        }
      };
      recognition.onerror = (event: SpeechRecognitionErrorEventCustom) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          isRecording = false;
        }
      };

      recognition.onend = () => {
        // Auto-restart if stopped due to silence (not user clicking stop)
        if (!intentionalStop && isRecording) {
          try {
            recognition?.start();
            return; // Don't clear state, keep recording
          } catch {
            // Failed to restart, fall through to cleanup
          }
        }

        isRecording = false;
        // Clear any lingering interim text
        if (onInterimTranscript) {
          onInterimTranscript("");
        }
        // Notify parent that recording session ended
        if (onRecordingEnd) {
          onRecordingEnd();
        }
      };
    }
  });

  // Cleanup on unmount
  onDestroy(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    clearMaxDurationTimeout();
    if (recognition && isRecording) {
      recognition.abort();
    }
  });

  function clearMaxDurationTimeout() {
    if (maxDurationTimeout) {
      clearTimeout(maxDurationTimeout);
      maxDurationTimeout = null;
    }
  }

  function resetMaxDurationTimeout() {
    clearMaxDurationTimeout();
    maxDurationTimeout = setTimeout(() => {
      stopRecording(true);
    }, MAX_RECORDING_DURATION_MS);
  }

  function stopRecording(isTimeout = false) {
    if (!recognition) return;
    clearMaxDurationTimeout();
    intentionalStop = true;
    recognition.stop();
    isRecording = false;
    if (isTimeout && onTimeout) {
      onTimeout();
    }
  }

  function toggleRecording() {
    if (!recognition || disabled) return;

    if (isRecording) {
      stopRecording();
    } else {
      intentionalStop = false; // Starting fresh session
      recognition.start();
      isRecording = true;
      // Start max duration timer (resets on speech activity)
      resetMaxDurationTimeout();
    }
  }
</script>

{#if isSupported}
  <button
    type="button"
    class="voice-btn"
    class:recording={isRecording}
    onclick={toggleRecording}
    {disabled}
    aria-label={isRecording ? "Stop recording" : "Start voice input"}
    aria-pressed={isRecording}
    title={isRecording ? "Stop recording" : "Speak to dictate feedback"}
  >
    {#if isRecording}
      <span class="pulse-ring"></span>
      <i class="fas fa-stop" aria-hidden="true"></i>
    {:else}
      <i class="fas fa-microphone" aria-hidden="true"></i>
    {/if}
  </button>
{/if}

<style>
  .voice-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent)) 15%,
      transparent
    );
    border: 1.5px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent)) 30%,
        transparent
      );
    border-radius: 50%;
    color: var(--theme-accent-strong);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .voice-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent-strong) 25%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent)) 50%,
      transparent
    );
    transform: scale(1.05);
  }

  .voice-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .voice-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .voice-btn i {
    font-size: 1rem;
    position: relative;
    z-index: 2;
  }

  /* Recording state */
  .voice-btn.recording {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 20%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 40%,
      transparent
    );
    color: var(--semantic-error, var(--semantic-error));
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0
        color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 40%,
          transparent
        );
    }
    50% {
      box-shadow: 0 0 0 8px transparent;
    }
  }

  /* Pulse ring animation */
  .pulse-ring {
    position: absolute;
    inset: -4px;
    border: 2px solid
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 60%,
        transparent
      );
    border-radius: 50%;
    animation: ringPulse 1.5s ease-out infinite;
  }

  @keyframes ringPulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(1.3);
      opacity: 0;
    }
  }

  .voice-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .voice-btn.recording {
      animation: none;
    }
    .pulse-ring {
      animation: none;
      display: none;
    }
  }
</style>
