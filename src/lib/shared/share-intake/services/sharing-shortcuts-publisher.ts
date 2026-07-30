import { Capacitor, registerPlugin } from "@capacitor/core";
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

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Fetch an avatar as base64. Done here rather than in Java because avatars sit
 * behind authed storage and the browser context already carries that; a Java
 * fetch would duplicate the auth logic for nothing.
 */
async function fetchIcon(url: string | null): Promise<string> {
  if (!url) return "";
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    return toBase64(new Uint8Array(await response.arrayBuffer()));
  } catch {
    // A missing face is better than a missing person.
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
        iconBase64: await fetchIcon(target.avatarUrl),
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
