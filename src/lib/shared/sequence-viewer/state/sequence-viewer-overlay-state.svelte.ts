import { pushState, replaceState } from "$app/navigation";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { getErrorHandler } from "$lib/shared/application/get-error-handler";
import { getShortCodeShareMessage } from "$lib/shared/qr/domain/short-code-error";

let _isOpen = $state(false);
let _sequence = $state<SequenceData | null>(null);
let _variations = $state<SequenceData[]>([]);
let _variationIndex = $state(0);
let _returnLabel = $state("Back");
let _initialBpm = $state(60);
let _initialStep = $state(0);
let _dismissPath = $state<string | null>(null);
let _handPathMode = $state(false);
let _playOnOpen = $state(false);
let _openedFromUrl = $state(false);
let _activeShortCode = $state<string | null>(null);
let _openToken = 0;

export function openSequenceOverlay(
  sequence: SequenceData,
  options?: {
    returnLabel?: string;
    initialBpm?: number;
    initialStep?: number;
    skipHistoryPush?: boolean;
    dismissPath?: string;
    variations?: SequenceData[];
    handPathMode?: boolean;
    /** Open on the 2D animation surface and request playback. */
    playOnOpen?: boolean;
    fromUrl?: boolean;
    shortCode?: string;
  }
): void {
  _sequence = sequence;
  _variations = options?.variations ?? [sequence];
  _variationIndex = _variations.findIndex((v) => v.id === sequence.id);
  if (_variationIndex < 0) _variationIndex = 0;
  _returnLabel = options?.returnLabel || "Back";
  _initialBpm = options?.initialBpm || 60;
  _initialStep = options?.initialStep || 0;
  _dismissPath = options?.dismissPath || null;
  _handPathMode = options?.handPathMode ?? false;
  _playOnOpen = options?.playOnOpen ?? false;
  _openedFromUrl = options?.fromUrl ?? false;
  _activeShortCode = options?.shortCode ?? null;
  _isOpen = true;
  const token = ++_openToken;

  if (!options?.skipHistoryPush) {
    pushState("", { sequenceOverlay: true });
  }

  if (!options?.fromUrl && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.searchParams.has("v")) {
      url.searchParams.delete("v");
      replaceState(url.pathname + url.search + url.hash, {
        sequenceOverlay: true,
      });
    }
    void mintAndSyncShortCode(sequence, token);
  } else if (options?.shortCode) {
    _activeShortCode = options.shortCode;
  }
}

async function waitForAuthSettled(timeoutMs = 5000): Promise<void> {
  if (!authState.loading) return;
  const start = Date.now();
  while (authState.loading && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function mintAndSyncShortCode(
  sequence: SequenceData,
  token: number
): Promise<void> {
  const manager = getShortCodeManager();
  if (!manager) return;

  await waitForAuthSettled();
  if (token !== _openToken || !_isOpen) return;

  // Short codes are signed-in only. Guests get no shareable `?v=` code — the
  // dense self-contained "s~..." code that used to fill that gap is gone (it
  // produced unscannable QRs and unwieldy URLs). A guest's URL bar simply
  // stays clean; signing in unlocks sharing.
  if (!authState.isAuthenticated) return;

  let code: string | null = null;
  try {
    const result = await manager.createShortCode(sequence, {
      embedSequenceData: true,
    });
    code = result.code;
  } catch (firebaseError) {
    const shareMessage = getShortCodeShareMessage(firebaseError);
    if (shareMessage && token === _openToken && _isOpen) {
      const failure =
        firebaseError instanceof Error
          ? firebaseError
          : new Error(String(firebaseError));
      getErrorHandler().showUserError({
        message: shareMessage,
        technicalDetails: failure.message,
        error: failure,
        severity: "warning",
        context: {
          module: "sequence-viewer",
          action: "createShareLink",
        },
      });
      return;
    }
    // Firestore write failed (offline / transient) — skip URL sync rather
    // than fall back to a dense inline code. The overlay still works; only
    // the shareable `?v=` param is absent.
    console.warn(
      "[SequenceViewerOverlay] URL sync skipped - short code mint failed.",
      firebaseError
    );
    return;
  }

  if (!code || token !== _openToken || !_isOpen) return;
  _activeShortCode = code;
  const url = new URL(window.location.href);
  url.searchParams.set("v", code);
  replaceState(url.pathname + url.search + url.hash, { sequenceOverlay: true });
}

export function closeSequenceOverlay(): void {
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.searchParams.has("v")) {
      url.searchParams.delete("v");
      const target = url.pathname + (url.search ? url.search : "") + url.hash;
      replaceState(target, {});
    }
  }
  _isOpen = false;
  _sequence = null;
  _variations = [];
  _variationIndex = 0;
  _returnLabel = "Back";
  _initialBpm = 60;
  _initialStep = 0;
  _dismissPath = null;
  _handPathMode = false;
  _playOnOpen = false;
  _openedFromUrl = false;
  _activeShortCode = null;
}

export function switchVariation(index: number): void {
  if (index < 0 || index >= _variations.length) return;
  const variation = _variations[index];
  if (!variation) return;
  _variationIndex = index;
  _sequence = variation;
}

export function isSequenceOverlayOpen(): boolean {
  return _isOpen;
}

export function getSequenceOverlayState() {
  return {
    get isOpen() {
      return _isOpen;
    },
    get sequence() {
      return _sequence;
    },
    get variations() {
      return _variations;
    },
    get variationIndex() {
      return _variationIndex;
    },
    get returnLabel() {
      return _returnLabel;
    },
    get initialBpm() {
      return _initialBpm;
    },
    get initialStep() {
      return _initialStep;
    },
    get dismissPath() {
      return _dismissPath;
    },
    get handPathMode() {
      return _handPathMode;
    },
    get playOnOpen() {
      return _playOnOpen;
    },
    get openedFromUrl() {
      return _openedFromUrl;
    },
    get activeShortCode() {
      return _activeShortCode;
    },
  };
}
