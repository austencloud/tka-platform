/**
 * Scan analytics — the one joinable property set every /q event carries.
 *
 * One scanner's visit to one card is a "scan visit". PostHog's own identity for
 * that visit is not dependable: reset() mints a fresh distinct_id AND a fresh
 * session_id mid-load (a real scan on 2026-07-20 came back as two PostHog users
 * with an identical $device_id, 11s apart — one human, one card, two sessions),
 * and a failed resolve auto-reloads the page, which ends the page-load-scoped
 * view of things regardless. `scan_session_id` is our own anchor: minted once
 * per short code, kept in sessionStorage, so every event from the visit — across
 * a reload, across an identity churn — still joins on one id.
 *
 * Every scan event goes through `captureScanEvent` so the property set is
 * identical at every call site instead of being retyped (and drifting) per
 * event. The scan page and the shared viewer shell both call it, and the
 * per-control instrumentation phase builds on it.
 */

import { browser } from "$app/environment";
import { getDeviceId } from "$lib/shared/foundation/services/device-id";
import { captureEvent, getPostHogInstance } from "./services/posthog";

const SCAN_SESSION_PREFIX = "tka:scan-session:";

/**
 * What a scan visit knows about itself. `isAuthenticated` is a getter, not a
 * value: a guest can sign in mid-visit, so it has to be read at event time. It
 * is also why this module never imports auth state — that would drag Firebase
 * into the analytics graph, which is exactly what the worker-safety note atop
 * services/posthog.ts exists to prevent.
 */
export interface ScanVisitContext {
  shortCode: string;
  sequenceWord: string | null;
  deckId: string | null;
  deckName: string | null;
  isAuthenticated: () => boolean;
}

/** The base property set. Every scan event carries all of it. */
export interface ScanBaseProperties {
  short_code: string;
  sequence_word: string | null;
  deck_id: string | null;
  deck_name: string | null;
  is_authenticated: boolean;
  device_id: string | null;
  scan_session_id: string;
}

let visit: ScanVisitContext | null = null;
let visitScanSessionId: string | null = null;
let superPropertiesRegistered = false;

// Storage-blocked fallback (private mode, hardened settings). Still stable for
// the life of the page load, just not across the auto-reload.
const memorySessionIds = new Map<string, string>();

/**
 * The stable id for this scanner's visit to this card. Survives the
 * failed-resolve auto-reload because sessionStorage outlives a same-tab reload,
 * which is precisely the case that lost the SJJ6 scan.
 */
export function getScanSessionId(shortCode: string): string {
  const key = `${SCAN_SESSION_PREFIX}${shortCode}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    const cached = memorySessionIds.get(key);
    if (cached) return cached;
    const fresh = crypto.randomUUID();
    memorySessionIds.set(key, fresh);
    return fresh;
  }
}

/**
 * Open a scan visit. Call as early as the short code is known — before the
 * resolve, not after — so anything that fires during load (an $exception, a
 * failed resolve) already carries the join keys. Word and deck arrive later via
 * updateScanAttribution.
 */
export function beginScanVisit(
  shortCode: string,
  options: { isAuthenticated?: () => boolean } = {}
): void {
  if (!browser || !shortCode) return;
  visitScanSessionId = getScanSessionId(shortCode);
  visit = {
    shortCode,
    sequenceWord: null,
    deckId: null,
    deckName: null,
    isAuthenticated: options.isAuthenticated ?? (() => false),
  };
  superPropertiesRegistered = false;
  registerSuperProperties();
}

/**
 * Fill in the attribution that only exists after the short code resolves.
 * Partial by design — deck attribution and the word land at different moments.
 */
export function updateScanAttribution(
  attribution: Partial<
    Pick<ScanVisitContext, "sequenceWord" | "deckId" | "deckName">
  >
): void {
  if (!visit) return;
  visit = { ...visit, ...attribution };
}

/** Is this page load a scan visit? False everywhere except /q. */
export function isScanVisit(): boolean {
  return browser && visit !== null;
}

/**
 * The full base set, or null when this isn't a scan visit.
 *
 * Exported so a caller that builds its own payload (a batched event, a
 * non-PostHog sink) gets the identical property names rather than re-deriving
 * them.
 */
export function scanBaseProperties(): ScanBaseProperties | null {
  if (!browser || !visit || !visitScanSessionId) return null;

  let deviceId: string | null = null;
  try {
    deviceId = getDeviceId();
  } catch {
    // Storage blocked — the scan_session_id still carries the visit.
  }

  registerSuperProperties();

  return {
    short_code: visit.shortCode,
    sequence_word: visit.sequenceWord,
    deck_id: visit.deckId,
    deck_name: visit.deckName,
    is_authenticated: visit.isAuthenticated(),
    device_id: deviceId,
    scan_session_id: visitScanSessionId,
  };
}

/**
 * Capture a scan event with the base set merged in. No-ops off /q — the shared
 * viewer shell renders in the app drawer too, and an app-drawer click is not a
 * scan. Callers that want telemetry on both surfaces branch on isScanVisit()
 * explicitly rather than getting a half-attributed event by accident.
 */
export function captureScanEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  const base = scanBaseProperties();
  if (!base) return;
  captureEvent(eventName, { ...base, ...properties });
}

/**
 * Pin the two join keys as PostHog session super properties so they ride along
 * on the events we do NOT author: $pageview, $pageleave, autocapture clicks,
 * $exception, $web_vitals. That is what makes a replay-less session
 * reconstructable — every event in it points back at the card.
 *
 * Session-scoped (register_for_session), not persistent: scan attribution must
 * not follow this browser onto every future page forever. Runs lazily because
 * beginScanVisit is deliberately called before PostHog finishes initializing.
 */
function registerSuperProperties(): void {
  if (superPropertiesRegistered || !visit || !visitScanSessionId) return;
  const instance = getPostHogInstance();
  if (!instance) return;
  instance.register_for_session({
    scan_session_id: visitScanSessionId,
    short_code: visit.shortCode,
  });
  superPropertiesRegistered = true;
}

/** Test-only reset of the module-level visit. */
export function _resetScanAnalytics(): void {
  visit = null;
  visitScanSessionId = null;
  superPropertiesRegistered = false;
  memorySessionIds.clear();
}
