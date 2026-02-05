/**
 * Vendor-Prefixed Browser API Type Declarations
 *
 * These extend the standard DOM types with vendor-prefixed APIs
 * that are still used for cross-browser compatibility.
 */

// ============================================================================
// Fullscreen API - Vendor Prefixes
// ============================================================================

interface Document {
  /** @deprecated Use standard fullscreenEnabled */
  readonly webkitFullscreenEnabled?: boolean;
  /** @deprecated Use standard fullscreenEnabled */
  readonly mozFullScreenEnabled?: boolean;
  /** @deprecated Use standard fullscreenEnabled */
  readonly msFullscreenEnabled?: boolean;

  /** @deprecated Use standard fullscreenElement */
  readonly webkitFullscreenElement?: Element | null;
  /** @deprecated Use standard fullscreenElement */
  readonly mozFullScreenElement?: Element | null;
  /** @deprecated Use standard fullscreenElement */
  readonly msFullscreenElement?: Element | null;

  /** @deprecated Use standard exitFullscreen() */
  webkitExitFullscreen?: () => Promise<void>;
  /** @deprecated Use standard exitFullscreen() */
  mozCancelFullScreen?: () => Promise<void>;
  /** @deprecated Use standard exitFullscreen() */
  msExitFullscreen?: () => Promise<void>;
}

interface HTMLElement {
  /** @deprecated Use standard requestFullscreen() */
  webkitRequestFullscreen?: () => Promise<void>;
  /** @deprecated Use standard requestFullscreen() */
  mozRequestFullScreen?: () => Promise<void>;
  /** @deprecated Use standard requestFullscreen() */
  msRequestFullscreen?: () => Promise<void>;
}

// ============================================================================
// Navigator Extensions
// ============================================================================

interface Navigator {
  /** iOS Safari standalone mode detection */
  readonly standalone?: boolean;
}

// ============================================================================
// Speech Recognition API
// ============================================================================

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;

  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
    | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
    | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;

  abort(): void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

// ============================================================================
// Audio Context - Vendor Prefixes
// ============================================================================

interface Window {
  webkitAudioContext?: typeof AudioContext;
}

// ============================================================================
// Performance Memory API (Chrome-specific)
// ============================================================================

interface PerformanceMemory {
  readonly jsHeapSizeLimit: number;
  readonly totalJSHeapSize: number;
  readonly usedJSHeapSize: number;
}

interface Performance {
  readonly memory?: PerformanceMemory;
}

// ============================================================================
// Canvas Capture (for video recording)
// ============================================================================

interface HTMLCanvasElement {
  captureStream(frameRate?: number): MediaStream;
}

interface CanvasCaptureMediaStreamTrack extends MediaStreamTrack {
  readonly canvas: HTMLCanvasElement;
  requestFrame(): void;
}

// ============================================================================
// Google Identity Services (One Tap) API
// ============================================================================

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback?: (response: { credential: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
  }): void;
  prompt(
    callback?: (notification: {
      isNotDisplayed: () => boolean;
      isSkippedMoment: () => boolean;
      isDismissedMoment: () => boolean;
      getNotDisplayedReason: () => string;
      getSkippedReason: () => string;
      getDismissedReason: () => string;
    }) => void
  ): void;
  disableAutoSelect(): void;
  cancel(): void;
  revoke(hint: string, callback?: () => void): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
      locale?: string;
    }
  ): void;
}

interface GoogleAccounts {
  id: GoogleAccountsId;
}

interface Window {
  google?: {
    accounts: GoogleAccounts;
  };
}

// Note: No export {} - this file provides ambient type declarations for vendor-prefixed APIs
