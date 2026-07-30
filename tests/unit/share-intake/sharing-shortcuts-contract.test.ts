import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const PLUGIN =
  "android/app/src/main/java/com/tkaflowarts/composer/TkaSharingShortcutsPlugin.java";
const SHORTCUTS_XML = "android/app/src/main/res/xml/shortcuts.xml";
const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const PUBLISHER =
  "src/lib/shared/share-intake/services/sharing-shortcuts-publisher.ts";

const CATEGORY = "com.tkaflowarts.composer.category.SHARE_TARGET";

/** Every android:mimeType in a <share-target> block. */
function shareTargetMimes(xml: string): string[] {
  const block = xml.slice(xml.indexOf("<share-target"), xml.indexOf("</share-target>"));
  return [...block.matchAll(/android:mimeType="([^"]+)"/g)].map((m) => m[1] ?? "").sort();
}

/** Every android:mimeType inside the ACTION_SEND (not SEND_MULTIPLE) filter. */
function sendFilterMimes(manifest: string): string[] {
  const start = manifest.indexOf('android.intent.action.SEND"');
  const block = manifest.slice(start, manifest.indexOf("</intent-filter>", start));
  return [...block.matchAll(/android:mimeType="([^"]+)"/g)]
    .map((m) => m[1] ?? "")
    .filter((mime) => mime.startsWith("image/"))
    .sort();
}

describe("sharing shortcuts contract", () => {
  it("uses the same category string in all three places", () => {
    // A mismatch in ANY of these means Direct Share targets never appear and
    // nothing logs an error. This test is the only thing that can catch it.
    expect(read(PLUGIN)).toContain(`"${CATEGORY}"`);
    expect(read(SHORTCUTS_XML)).toContain(`android:name="${CATEGORY}"`);
    expect(read(PUBLISHER)).toContain(CATEGORY);
  });

  it("declares the same image types the manifest advertises for ACTION_SEND", () => {
    // The manifest advertising a type the share-target omits means the app
    // appears as a plain row but never with a face for that type.
    expect(shareTargetMimes(read(SHORTCUTS_XML))).toEqual(sendFilterMimes(read(MANIFEST)));
  });

  it("points the manifest at the shortcuts resource", () => {
    expect(read(MANIFEST)).toContain('android:name="android.app.shortcuts"');
    expect(read(MANIFEST)).toContain('android:resource="@xml/shortcuts"');
  });

  it("registers the plugin before super.onCreate", () => {
    // Capacitor registers plugins during super.onCreate; registering after is a
    // silent no-op and every plugin call rejects as unimplemented.
    const main = read(
      "android/app/src/main/java/com/tkaflowarts/composer/MainActivity.java"
    );
    const register = main.indexOf("registerPlugin(TkaSharingShortcutsPlugin.class)");
    // Match the call, not the substring "super.onCreate" - the file's own
    // comment ("Must precede super.onCreate:") contains that text earlier in
    // the file than the real call, which would false-negative this test.
    const superCall = main.indexOf("super.onCreate(");
    expect(register).toBeGreaterThan(-1);
    expect(register).toBeLessThan(superCall);
  });

  it("mounts the publisher host inside the app shell", () => {
    // Same structural reason ShareIntakeHost lives here: the host must not run
    // on the marketing landing, and mounting it beside the drawers makes that a
    // fact rather than a timing hope.
    expect(
      read("src/lib/shared/application/components/MainApplication.svelte")
    ).toContain("share-intake/components/SharingShortcutsHost.svelte");
  });

  it("the host republishes on conversation change and clears on sign-out", () => {
    const host = read(
      "src/lib/shared/share-intake/components/SharingShortcutsHost.svelte"
    );
    expect(host).toContain("inboxState.conversations");
    expect(host).toContain("clearShareTargets");
  });
});
