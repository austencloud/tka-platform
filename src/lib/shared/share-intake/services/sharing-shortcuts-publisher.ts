import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import type { ShareTarget } from "../domain/share-target-selection";

/**
 * Must be byte-identical to CATEGORY in TkaSharingShortcutsPlugin.java and the
 * <category> in res/xml/shortcuts.xml. Not read at runtime on this side - it is
 * here so the contract test can pin all three from one place, because a
 * mismatch makes targets silently never appear.
 */
export const SHARE_TARGET_CATEGORY =
  "com.tkaflowarts.composer.category.SHARE_TARGET";

interface PublishedTarget {
  id: string;
  name: string;
  /** Empty string means "no icon"; the sheet falls back to the app icon. */
  iconBase64: string;
}

interface TkaSharingShortcutsPlugin {
  publish(options: { targets: PublishedTarget[] }): Promise<{ published: number }>;
  clear(): Promise<void>;
  consumeLaunchShortcutId(): Promise<{ shortcutId: string | null }>;
}

const plugin = registerPlugin<TkaSharingShortcutsPlugin>("TkaSharingShortcuts");

/**
 * Fingerprint of the last published set. The inbox conversation subscription
 * fires on every message; re-pushing an identical set would burn the system's
 * shortcut rate limit for no visible change.
 */
let lastPublished: string | null = null;

/** Test seam. Module state would otherwise leak between cases. */
export function __resetPublisherForTests(): void {
  lastPublished = null;
}

function fingerprint(targets: ShareTarget[]): string {
  // Order is included deliberately: order IS the ranking.
  return JSON.stringify(targets.map((t) => [t.id, t.name, t.avatarUrl]));
}

/**
 * Fetch an avatar as base64, over NATIVE http.
 *
 * Not `fetch()`. The WebView's origin is https://localhost and avatars are
 * Google CDN urls (lh3.googleusercontent.com/...); that CDN does not grant CORS
 * to this origin, so fetch() rejects and every target silently fell back to
 * initials. RobustAvatar gets away with the same urls because an <img> tag
 * renders cross-origin images without CORS - fetch cannot.
 *
 * CapacitorHttp goes through the platform's HTTP stack, where CORS does not
 * apply at all, and returns base64 directly for responseType "blob". Verified
 * against real data 2026-07-30: participantInfo DOES carry avatar urls, so the
 * empty icons were never missing data.
 */
async function fetchIcon(url: string | null): Promise<string> {
  if (!url) return "";
  try {
    const response = await CapacitorHttp.get({ url, responseType: "blob" });
    if (response.status < 200 || response.status >= 300) return "";
    const data: unknown = response.data;
    if (typeof data !== "string" || data.length === 0) return "";
    // Native returns bare base64; be tolerant of a data: url just in case.
    return data.startsWith("data:") ? data.slice(data.indexOf(",") + 1) : data;
  } catch {
    // A missing face is better than a missing person.
    return "";
  }
}

/** Deterministic hue per person, so the same face keeps the same colour. */
function hueFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

/**
 * Draw an initials avatar as PNG bytes.
 *
 * Verified on device 2026-07-30: participantInfo in Firestore carries no avatar
 * for these conversations, so every published target had icon=null and the sheet
 * would show four identical app icons. The inbox already falls back to initials
 * for exactly the same missing data (ConversationItem -> RobustAvatar), so this
 * matches what the user sees in-app rather than inventing a second convention.
 *
 * Also a ranking signal: the Sharesheet's prediction service decides whether a
 * target is shown at all, and an iconless target is a weaker candidate.
 */
function initialsIcon(target: ShareTarget): string {
  try {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const hue = hueFor(target.id);
    ctx.fillStyle = `hsl(${hue}, 55%, 42%)`;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#ffffff";
    // 0.28, not 0.42. createWithAdaptiveBitmap treats this as an ADAPTIVE icon,
    // where only the centre 66/108 (~61%) of the bitmap is guaranteed visible -
    // the launcher masks the rest away. At 0.42 two capitals overflowed that
    // safe circle and the letters were clipped on both sides on device.
    ctx.font = `600 ${size * 0.28}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialsOf(target.name), size / 2, size / 2 + size * 0.01);

    // Square, not a circle: IconCompat.createWithAdaptiveBitmap masks it round.
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  } catch {
    return "";
  }
}

/**
 * Publish the Direct Share targets, unless nothing changed.
 *
 * Never throws. This is called from a Svelte $effect over the inbox
 * subscription, and a rejection here would take that subscription down.
 */
export async function publishShareTargets(targets: ShareTarget[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const next = fingerprint(targets);
  if (next === lastPublished) return;

  try {
    const published = await Promise.all(
      targets.map(async (target) => ({
        id: target.id,
        name: target.name,
        // Real avatar when there is one, generated initials otherwise. Never
        // empty if a canvas is available: four identical app icons in the sheet
        // are indistinguishable, which defeats the point of showing people.
        iconBase64: (await fetchIcon(target.avatarUrl)) || initialsIcon(target),
      }))
    );

    await plugin.publish({ targets: published });
    lastPublished = next;
  } catch (caught) {
    // Rate limiting while backgrounded is normal and lands here. Leaving
    // lastPublished unset means the next change retries.
    console.warn("[SharingShortcuts] publish skipped:", caught);
  }
}

/** Remove every target. Called on sign-out - names must not outlive the session. */
export async function clearShareTargets(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await plugin.clear();
  } catch (caught) {
    console.warn("[SharingShortcuts] clear failed:", caught);
  } finally {
    // Forget regardless, so signing back in republishes rather than deduping.
    lastPublished = null;
  }
}

/**
 * Which target the user tapped, or null for an ordinary share.
 *
 * Consume-once on the native side: BridgeActivity keeps the launch intent for
 * the activity's lifetime, so without clearing it a later share would re-read a
 * stale id and send someone's photo to the wrong person.
 */
export async function consumeLaunchShortcutId(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const { shortcutId } = await plugin.consumeLaunchShortcutId();
    return shortcutId ?? null;
  } catch {
    return null;
  }
}
