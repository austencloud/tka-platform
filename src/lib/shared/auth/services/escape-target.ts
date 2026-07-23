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
/**
 * Route prefixes the native app claims via https App Links (AndroidManifest +
 * AASA). An app-target intent for anything else can't be resolved by the
 * installed app, so it must be bridged through a claimed path (see below).
 */
const COVERED_APP_PREFIXES = ["/q/", "/sequence/", "/store/"];
const APP_BRIDGE_PATH = "/store/open";

function isCoveredAppRoute(pathname: string): boolean {
  return COVERED_APP_PREFIXES.some((p) => pathname.startsWith(p));
}

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
  /** iOS post-launch: the App Store link shown as a secondary "Get the app". */
  appStoreUrl?: string;
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

/**
 * Absolute https only. Anything else is not escapable: an http:// scheme swap
 * would navigate inside the webview, and a malformed URL would throw. Both must
 * degrade to a guide, never a fired URL.
 */
function parseHttpsUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

const IOS_INSTRUCTIONS: EscapeTarget = {
  method: "ios_instructions",
  label: "Open in Safari",
  url: null,
  isAppTarget: false,
};
const OTHER_INSTRUCTIONS: EscapeTarget = {
  method: "generic_instructions",
  label: "Open in your browser",
  url: null,
  isAppTarget: false,
};

function androidIntent(u: URL, input: EscapeInput): EscapeTarget {
  // host+path+search only. The page hash is dropped here: the first '#' would
  // terminate the intent URI and swallow the '#Intent' block, so a URL like
  // /glossary#term would produce an unparseable intent. The full URL, hash
  // included, is preserved in browser_fallback_url.
  const tail = `${u.host}${u.pathname}${u.search}`;

  if (input.appLaunched) {
    // package= pins the app; browser_fallback_url catches the not-installed case
    // and drops to the Play Store, so one tap covers both states.
    const fallback = encodeURIComponent(
      input.playStoreUrl ??
        `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`
    );
    // The app only App-Links a few route families. A route it doesn't claim
    // (e.g. /create/construct) can't resolve the intent, so an installed app
    // would be skipped and the user bounced to the store. Route those through a
    // claimed bridge path carrying the real destination for the app to restore.
    const appTail = isCoveredAppRoute(u.pathname)
      ? tail
      : `${u.host}${APP_BRIDGE_PATH}?to=${encodeURIComponent(
          u.pathname + u.search + u.hash
        )}`;
    return {
      method: "android_intent",
      label: "Open in the app",
      url: `intent://${appTail}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`,
      isAppTarget: true,
    };
  }

  // Pre-launch: no package, so it resolves against any installed browser — the
  // copy says "browser", not "Chrome", because Firefox/Samsung/etc. are valid.
  return {
    method: "android_intent",
    label: "Open in browser",
    url: `intent://${tail}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(u.href)};end`,
    isAppTarget: false,
  };
}

export function resolveEscapeTarget(input: EscapeInput): EscapeTarget {
  const u = parseHttpsUrl(input.currentUrl);
  // Nothing safe to fire without an https URL — hand back the platform's guide.
  if (!u) return input.platform === "other" ? OTHER_INSTRUCTIONS : IOS_INSTRUCTIONS;

  if (input.platform === "android") return androidIntent(u, input);

  if (input.platform === "ios") {
    // iOS can't be force-opened to the app from a webview any more than to
    // Safari, so post-launch the primary action stays the Safari scheme and the
    // App Store link rides along as a secondary "Get the app".
    const appStoreUrl = input.appLaunched ? input.appStoreUrl : undefined;

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
        url: u.href.replace(/^https:\/\//, "x-safari-https://"),
        isAppTarget: input.appLaunched,
        appStoreUrl,
      };
    }
    return { ...IOS_INSTRUCTIONS, isAppTarget: input.appLaunched, appStoreUrl };
  }

  return OTHER_INSTRUCTIONS;
}
