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
import { resolveEscapeTarget, type EscapeTarget } from "./escape-target";
import {
  isAppLaunched,
  playStoreUrl,
  appStoreUrl,
} from "../config/app-availability";

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

  // Google's own iOS app embeds a webview that Google's OAuth policy blocks the
  // same way; without this it reads as a normal browser and a provider tap dies
  // at disallowed_useragent with no escape offered.
  { pattern: /GSA\//i, name: "Google App" },

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

  /**
   * The platform to resolve escapes against, honoring ?forceIAB=ios|android so
   * the test matrix actually exercises those paths on a desktop. A forced value
   * that isn't a platform (true/false) falls back to real detection.
   */
  getEffectivePlatform(searchParams?: URLSearchParams): InAppBrowserPlatform {
    const forced = this.getForcedValue(searchParams);
    if (forced === "ios" || forced === "android") return forced;
    return this.getPlatform();
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

    // Named apps only. There used to be a last-resort "iOS UA with no Safari
    // token" heuristic here, but that flagged real browsers that drop the
    // vestigial token (Opera for iOS ships OPT/ with no Safari/), and the whole
    // point of detection is to never lie to a capable browser. A named match
    // cannot false-positive; an unnamed webview simply isn't handled, which is
    // the safe direction — the visitor gets the full app, no escape chrome.
    for (const { pattern, name } of IN_APP_BROWSER_PATTERNS) {
      if (pattern.test(combined)) {
        this.cachedResult = { isInApp: true, name };
        return this.cachedResult;
      }
    }

    this.cachedResult = { isInApp: false, name: null };
    return this.cachedResult;
  }

  /** iOS major version parsed from the UA, or null when not iOS / unparseable. */
  getIosMajorVersion(): number | null {
    if (typeof navigator === "undefined") return null;
    // "CPU iPhone OS 18_7 like Mac OS X", or "CPU OS 26_5" on iPad.
    const match = navigator.userAgent.match(/OS (\d+)[_.]/);
    return this.isIOS() && match ? Number(match[1]) : null;
  }

  /**
   * The escape action for this environment, composed from the detector's own
   * signals plus the launch flag. One call so every escape surface stays in
   * lockstep and nothing hardcodes a browser-vs-app decision.
   */
  getEscapeTarget(searchParams?: URLSearchParams): EscapeTarget {
    return resolveEscapeTarget({
      platform: this.getEffectivePlatform(searchParams),
      iosMajorVersion: this.getIosMajorVersion(),
      appLaunched: isAppLaunched(searchParams),
      currentUrl: typeof window !== "undefined" ? window.location.href : "",
      playStoreUrl: playStoreUrl(),
      appStoreUrl: appStoreUrl(),
    });
  }

  private isAndroid(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android/i.test(navigator.userAgent);
  }

  private isIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
    // iPadOS 13+ desktop mode sends a Mac UA; touch points disambiguate it from
    // a real Mac, which reports maxTouchPoints 0. Such an iPad has no iOS
    // version in its UA, so getIosMajorVersion stays null and the resolver hands
    // back the safe iOS guide rather than firing a scheme it can't vouch for.
    const nav = navigator as Navigator & { maxTouchPoints?: number };
    return /Macintosh/i.test(navigator.userAgent) && (nav.maxTouchPoints ?? 0) > 1;
  }
}
