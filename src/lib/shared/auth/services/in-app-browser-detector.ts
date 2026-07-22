/**
 * Detects in-app browsers — Instagram, Messenger, TikTok, and friends — so the
 * app can say which parts of sign-in work here and which do not.
 *
 * This file used to justify itself with "these webviews partition
 * sessionStorage, breaking Firebase's signInWithRedirect." That justification
 * described code the app does not contain: a repo-wide search for
 * signInWithRedirect finds nothing but that sentence. Sign-in runs through
 * signInWithPopup and signInAnonymously, and the thing that actually fails in a
 * webview is the OAuth popup, which Google rejects server-side with
 * 403 disallowed_useragent. Guest identity, construct/assemble/generate, and
 * email-link sign-in all work in here.
 *
 * So detection feeds a dismissible banner and a click-time interception on the
 * two provider buttons. It must never gate page load again — a real visitor
 * from an Instagram DM was told sign-in was impossible while sitting on a page
 * he could have used as a guest.
 *
 * Design: docs/architecture/in-app-browser-path.md
 */

import { Capacitor } from "@capacitor/core";

interface BrowserPattern {
  pattern: RegExp;
  name: string;
}

const IN_APP_BROWSER_PATTERNS: BrowserPattern[] = [
  // Meta platforms
  { pattern: /FBAN|FBAV/i, name: "Facebook" },
  { pattern: /FB_IAB/i, name: "Facebook" },
  { pattern: /Messenger/i, name: "Messenger" },
  { pattern: /Instagram/i, name: "Instagram" },

  // Other social apps
  { pattern: /Twitter/i, name: "Twitter" },
  { pattern: /Line\//i, name: "Line" },
  { pattern: /KAKAOTALK/i, name: "KakaoTalk" },
  { pattern: /Snapchat/i, name: "Snapchat" },
  { pattern: /TikTok/i, name: "TikTok" },
  { pattern: /BytedanceWebview/i, name: "TikTok" },
  { pattern: /WeChat|MicroMessenger/i, name: "WeChat" },
  { pattern: /Telegram/i, name: "Telegram" },
  { pattern: /Discord/i, name: "Discord" },
  { pattern: /Slack/i, name: "Slack" },

  // Generic webview indicators
  { pattern: /\bwv\b/i, name: "WebView" },
  { pattern: /WebView/i, name: "WebView" },
];

/**
 * Real iOS browsers that omit the vestigial "Safari/" token.
 *
 * The last-resort heuristic in detect() flags any iOS user-agent without that
 * token, and Opera for iOS (OPT/, and OPX/ for Opera GX) is the one mainstream
 * browser that drops it — so a fully capable browser was getting flagged.
 * Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS), Brave, and DuckDuckGo all
 * still carry it. This list is the maintenance point when the next vendor
 * drops it.
 */
const IOS_REAL_BROWSERS = /\bOPT\/|\bOPX\//i;

export type InAppBrowserPlatform = "ios" | "android" | "other";

export class InAppBrowserDetector {
  private cachedResult: { isInApp: boolean; name: string | null } | null = null;

  isInAppBrowser(): boolean {
    return this.detect().isInApp;
  }

  getInAppBrowserName(): string | null {
    return this.detect().name;
  }

  /** Which escape hatch applies. Android gets a scheme; iOS gets instructions. */
  getPlatform(): InAppBrowserPlatform {
    if (this.isAndroid()) return "android";
    if (this.isIOS()) return "ios";
    return "other";
  }

  /**
   * The ?forceIAB test hook, resolved here rather than at each call site.
   *
   * It has to sit BEHIND the same native short-circuit detect() applies, not be
   * OR'd on after it. Android App Links claim https://tkaflowarts.com/sequence/*
   * and /store/* with autoVerify (AndroidManifest.xml), and native-initializer's
   * handleDeepLink forwards `pathname + search + hash` verbatim to goto() for
   * every path except /q/ — so a link carrying ?forceIAB opens the packaged app
   * with the param intact. Read naively, the app then tells its own users that
   * Google sign-in is blocked here and returns before ever calling
   * signInWithGoogle(), which is a dead button rather than merely wrong copy.
   * Four call sites each re-deriving this is four chances to forget the check.
   */
  getForcedValue(searchParams?: URLSearchParams): string | null {
    if (Capacitor.isNativePlatform()) return null;
    return searchParams?.get("forceIAB") ?? null;
  }

  /** Real detection, plus the test hook. The only form call sites should use. */
  isInAppBrowserOrForced(searchParams?: URLSearchParams): boolean {
    return this.isInAppBrowser() || this.getForcedValue(searchParams) !== null;
  }

  getOpenInBrowserUrl(): string {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";

    if (this.isAndroid()) {
      const url = new URL(currentUrl);
      // Two deliberate departures from the obvious form:
      //
      // No package=com.android.chrome. Pinning the package dead-ends on a
      // device where Chrome is absent or disabled; the generic form resolves
      // against whatever browser is installed.
      //
      // S.browser_fallback_url is Chrome's documented escape for when nothing
      // resolves the intent. Without it the tap silently does nothing, which is
      // indistinguishable from a broken button.
      //
      // The page fragment is dropped because the "#Intent;...;end" block IS the
      // URI's fragment — a second "#" truncates it and the whole intent stops
      // parsing. browser_fallback_url below carries the complete address, but
      // only the fallback path uses it: when a browser DOES resolve the intent
      // it navigates to the data URI above, so the hash is gone on the success
      // path too. Known, accepted gap — it costs a hash-addressed deep link its
      // anchor (/glossary#term scrolls to the top of the page instead of the
      // term). Closing it means smuggling the fragment through as a query param
      // and restoring it into location.hash on arrival; not built, because
      // nothing yet says how often anyone escapes from a fragment URL.
      const fallback = encodeURIComponent(currentUrl);
      return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;S.browser_fallback_url=${fallback};end`;
    }

    // iOS has no scheme that reliably hands a URL to Safari from inside a
    // webview (x-safari-https:// is broken in Instagram's specifically), so the
    // caller shows the app's own "Open in Safari" instructions plus a copy
    // button instead of firing something that surfaces a native error dialog.
    return currentUrl;
  }

  canOpenInExternalBrowser(): boolean {
    // Only Android supports intent:// URLs for opening in external browser
    return this.isAndroid();
  }

  private detect(): { isInApp: boolean; name: string | null } {
    if (this.cachedResult) {
      return this.cachedResult;
    }

    if (typeof navigator === "undefined") {
      this.cachedResult = { isInApp: false, name: null };
      return this.cachedResult;
    }

    // The Capacitor native shell IS a WebView (its UA contains "; wv)"), but
    // it's our own app, not a hostile in-app browser: sign-in runs through the
    // native Firebase plugin there, so the "open in Chrome" prompt must never
    // fire.
    if (Capacitor.isNativePlatform()) {
      this.cachedResult = { isInApp: false, name: null };
      return this.cachedResult;
    }

    const ua = navigator.userAgent || "";
    const vendor = (navigator as { vendor?: string }).vendor || "";
    const combined = `${ua} ${vendor}`;

    for (const { pattern, name } of IN_APP_BROWSER_PATTERNS) {
      if (pattern.test(combined)) {
        this.cachedResult = { isInApp: true, name };
        return this.cachedResult;
      }
    }

    // Last resort: an iOS user-agent with no Safari token is usually a webview
    // that declined to name itself. Known-good browsers are cleared first, so
    // an Opera user doesn't get told their browser is somebody's webview.
    if (
      this.isIOS() &&
      !IOS_REAL_BROWSERS.test(combined) &&
      !combined.includes("Safari")
    ) {
      this.cachedResult = { isInApp: true, name: "App" };
      return this.cachedResult;
    }

    this.cachedResult = { isInApp: false, name: null };
    return this.cachedResult;
  }

  private isAndroid(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android/i.test(navigator.userAgent);
  }

  private isIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
}
