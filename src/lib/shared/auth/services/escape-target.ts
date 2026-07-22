/**
 * The single source of truth for how a visitor escapes an in-app webview.
 *
 * Every escape surface (the compact sign-in-intent note today, the /q card flow
 * later) asks this one pure function what button to show, what it says, and what
 * URL it fires. That is what makes the store launch a one-line change: flip
 * `appLaunched` and the resolver starts routing to the app instead of the
 * browser, and no component has to be touched.
 *
 * Design: docs/superpowers/specs/2026-07-22-kill-the-bar-app-forward-design.md
 */

/** Android/iOS package identity. One place to change if it ever moves. */
const ANDROID_PACKAGE = "com.tkaflowarts.composer";
/** x-safari-https:// is reliable on iOS 17+; older iOS raises an error dialog. */
const IOS_MIN_SCHEME_VERSION = 17;

export type EscapeMethod =
  | "android_intent"
  | "ios_scheme"
  | "ios_instructions"
  | "generic_instructions";

export interface EscapeTarget {
  method: EscapeMethod;
  /** Button text. Comes entirely from here so no component hardcodes it. */
  label: string;
  /** Scheme/intent URL to fire, or null for a guide-only method. */
  url: string | null;
  /** Routing to the native app vs the browser. */
  isAppTarget: boolean;
}

export interface EscapeInput {
  platform: "ios" | "android" | "other";
  iosMajorVersion: number | null;
  appLaunched: boolean;
  currentUrl: string;
  /** Store URLs, injected so the resolver stays pure and testable. */
  playStoreUrl?: string;
  appStoreUrl?: string;
}

function androidIntent(input: EscapeInput): EscapeTarget {
  const u = new URL(input.currentUrl);
  const tail = `${u.host}${u.pathname}${u.search}${u.hash}`;

  if (input.appLaunched) {
    // package= pins the app; browser_fallback_url catches the not-installed case
    // and drops to the Play Store, so one tap covers both states.
    const fallback = encodeURIComponent(
      input.playStoreUrl ??
        `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`
    );
    return {
      method: "android_intent",
      label: "Open in the app",
      url: `intent://${tail}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`,
      isAppTarget: true,
    };
  }

  // Pre-launch: no package, so it resolves against any installed browser.
  return {
    method: "android_intent",
    label: "Open in Chrome",
    url: `intent://${tail}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(input.currentUrl)};end`,
    isAppTarget: false,
  };
}

export function resolveEscapeTarget(input: EscapeInput): EscapeTarget {
  if (input.platform === "android") return androidIntent(input);

  if (input.platform === "ios") {
    // Fire the scheme only where it is reliable. On older or unknown iOS an
    // unsupported scheme raises a native "invalid page" dialog that reads as an
    // app crash, so those get the guide instead of a fired URL.
    if (
      input.iosMajorVersion !== null &&
      input.iosMajorVersion >= IOS_MIN_SCHEME_VERSION
    ) {
      return {
        method: "ios_scheme",
        label: "Open in Safari",
        // x-safari-https:// takes the URL with its https scheme swapped in.
        url: input.currentUrl.replace(/^https:\/\//, "x-safari-https://"),
        isAppTarget: false,
      };
    }
    return {
      method: "ios_instructions",
      label: "Open in Safari",
      url: null,
      isAppTarget: false,
    };
  }

  return {
    method: "generic_instructions",
    label: "Open in your browser",
    url: null,
    isAppTarget: false,
  };
}
