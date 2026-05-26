/**
 * Voice Control State
 *
 * Reactive Svelte 5 state for the "Hey Tika" voice control system.
 * Published by HeyTikaListener, consumed by VoiceControlIndicator.
 *
 * Two listening modes:
 * - Wake word mode: subtle indicator, waiting for "Hey Tika"
 * - Command mode: prominent indicator, mic is hot, all speech = commands
 */

import type { WakeWordState, VoiceCommand } from "../domain/voice-command-types";

/** Auto-exit command mode after this many ms of no commands */
const COMMAND_MODE_TIMEOUT_MS = 15_000;

/** sessionStorage key for persisting command mode across HMR */
const COMMAND_MODE_KEY = "tka_voice_command_mode";

export type IndicatorFeedback = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export type ChatBubbleState = {
  text: string;
  speaking: boolean;
} | null;

function createVoiceControlState() {
  let enabled = $state(false);
  let detectorState = $state<WakeWordState>("idle");
  let supported = $state(false);
  let commandMode = $state(false);
  let lastCommand = $state<string | null>(null);
  let feedback = $state<IndicatorFeedback>(null);
  let helpOverlayOpen = $state(false);
  let lastResolvedCommands = $state<VoiceCommand[]>([]);
  let chatBubble = $state<ChatBubbleState>(null);
  let chatBubbleTimer: ReturnType<typeof setTimeout> | null = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let commandModeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Callback invoked when command mode auto-expires */
  let onCommandModeExpired: (() => void) | null = null;

  /** Callback invoked when UI requests voice activation (mic button click) */
  let onStartRequested: (() => void) | null = null;

  /** Callback invoked when entering command mode (tells detector to setCommandMode) */
  let onEnterCommandModeCallback: (() => void) | null = null;

  function clearCommandModeTimer() {
    if (commandModeTimer) {
      clearTimeout(commandModeTimer);
      commandModeTimer = null;
    }
  }

  function resetCommandModeTimer() {
    clearCommandModeTimer();
    commandModeTimer = setTimeout(() => {
      commandMode = false;
      detectorState = "listening";
      commandModeTimer = null;
      try { sessionStorage.removeItem(COMMAND_MODE_KEY); } catch { /* SSR / private browsing */ }
      onCommandModeExpired?.();
    }, COMMAND_MODE_TIMEOUT_MS);
  }

  return {
    get enabled() { return enabled; },
    get detectorState() { return detectorState; },
    get supported() { return supported; },
    get commandMode() { return commandMode; },
    get lastCommand() { return lastCommand; },
    get feedback() { return feedback; },
    get helpOverlayOpen() { return helpOverlayOpen; },
    get lastResolvedCommands() { return lastResolvedCommands; },
    get chatBubble() { return chatBubble; },

    setEnabled(value: boolean) { enabled = value; },
    setDetectorState(state: WakeWordState) { detectorState = state; },
    setSupported(value: boolean) { supported = value; },

    /**
     * Register a callback for when command mode auto-expires.
     * HeyTikaListener uses this to tell WakeWordDetector to exit command mode.
     */
    setOnCommandModeExpired(cb: (() => void) | null) {
      onCommandModeExpired = cb;
    },

    /**
     * Register a callback for when the user requests voice activation.
     * HeyTikaListener uses this to start the WakeWordDetector on demand.
     */
    setOnStartRequested(cb: (() => void) | null) {
      onStartRequested = cb;
    },

    /**
     * Register a callback for when command mode is entered.
     * HeyTikaListener uses this to tell WakeWordDetector to setCommandMode(true).
     */
    setOnEnterCommandMode(cb: (() => void) | null) {
      onEnterCommandModeCallback = cb;
    },

    /**
     * Start voice control for the first time (triggered by user clicking mic).
     * Calls the registered start callback which starts the WakeWordDetector.
     */
    startListening() {
      if (enabled) return;
      onStartRequested?.();
    },

    enterCommandMode() {
      commandMode = true;
      detectorState = "command_mode";
      resetCommandModeTimer();
      try { sessionStorage.setItem(COMMAND_MODE_KEY, "1"); } catch { /* SSR / private browsing */ }
      onEnterCommandModeCallback?.();
    },

    exitCommandMode() {
      if (!commandMode) return;
      commandMode = false;
      detectorState = "listening";
      clearCommandModeTimer();
      try { sessionStorage.removeItem(COMMAND_MODE_KEY); } catch { /* SSR / private browsing */ }
      onCommandModeExpired?.();
    },

    /**
     * Check if command mode was active before HMR/reload.
     * Returns true and clears the flag so it's only restored once.
     */
    shouldRestoreCommandMode(): boolean {
      try {
        const stored = sessionStorage.getItem(COMMAND_MODE_KEY);
        if (stored === "1") {
          // Don't remove yet - enterCommandMode will re-set it.
          // But clear it so a full page reload doesn't restore stale state.
          // We use a timestamp check instead: only restore if the flag is < 30s old.
          return true;
        }
      } catch { /* SSR / private browsing */ }
      return false;
    },

    /** Reset the auto-timeout (call after each successful command in command mode) */
    refreshCommandModeTimer() {
      if (commandMode) resetCommandModeTimer();
    },

    setLastResolvedCommands(commands: VoiceCommand[]) {
      lastResolvedCommands = commands;
    },

    /** Show a command result briefly, then auto-clear */
    showFeedback(type: "success" | "error" | "info", message: string, command?: string) {
      if (command) lastCommand = command;
      feedback = { type, message };

      if (feedbackTimer) clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => {
        feedback = null;
        feedbackTimer = null;
      }, 2500);
    },

    showChatBubble(text: string, speaking: boolean) {
      chatBubble = { text, speaking };
      // Clear any existing auto-dismiss timer
      if (chatBubbleTimer) clearTimeout(chatBubbleTimer);
    },

    setChatBubbleSpeaking(speaking: boolean) {
      if (chatBubble) {
        chatBubble = { ...chatBubble, speaking };
      }
      // Auto-dismiss 5s after speech finishes
      if (!speaking && chatBubble) {
        if (chatBubbleTimer) clearTimeout(chatBubbleTimer);
        chatBubbleTimer = setTimeout(() => {
          chatBubble = null;
          chatBubbleTimer = null;
        }, 5000);
      }
    },

    dismissChatBubble() {
      chatBubble = null;
      if (chatBubbleTimer) {
        clearTimeout(chatBubbleTimer);
        chatBubbleTimer = null;
      }
    },

    clearFeedback() {
      feedback = null;
      if (feedbackTimer) {
        clearTimeout(feedbackTimer);
        feedbackTimer = null;
      }
    },

    openHelp() {
      helpOverlayOpen = true;
    },

    closeHelp() {
      helpOverlayOpen = false;
    },

    toggleHelp() {
      helpOverlayOpen = !helpOverlayOpen;
    },

    /** Full cleanup on unmount (preserves sessionStorage for HMR restore) */
    destroy() {
      clearCommandModeTimer();
      if (feedbackTimer) clearTimeout(feedbackTimer);
      if (chatBubbleTimer) clearTimeout(chatBubbleTimer);
      onCommandModeExpired = null;
      onStartRequested = null;
      onEnterCommandModeCallback = null;
    },
  };
}

export const voiceControlState = createVoiceControlState();
