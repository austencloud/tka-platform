/**
 * Lightweight JSON-based i18n System
 *
 * Replaces Paraglide's 1,114 barrel-exported files with a single JSON loader.
 * Loads ONE file per locale instead of 1,114 files per page load.
 *
 * Features:
 * - Reactive locale switching without page reload
 * - Lazy loading of non-default locales
 * - Parameter interpolation support
 * - TypeScript type safety
 * - ~50 lines instead of ~3MB of generated code
 */

import enMessages from "../../../../messages/en.json";

// Available locales - must match messages/*.json files
export const locales = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "zh",
  "ja",
  "ko",
  "ar",
  "ru",
  "it",
] as const;

export type Locale = (typeof locales)[number];
export const baseLocale: Locale = "en";

type Messages = Record<string, string>;

// Cookie configuration for persistence
const LOCALE_COOKIE_NAME = "PARAGLIDE_LOCALE";
const LOCALE_COOKIE_MAX_AGE = 34560000; // ~400 days

// Reactive state
let currentLocale = $state<Locale>(getInitialLocale());
let messages = $state<Messages>(enMessages as Messages);

// Cache for loaded locales
const localeCache = new Map<Locale, Messages>();
localeCache.set("en", enMessages as Messages);

/**
 * Get initial locale from cookie or browser preference
 */
function getInitialLocale(): Locale {
  if (typeof document !== "undefined") {
    // Try cookie first
    const match = document.cookie.match(
      new RegExp(`(^| )${LOCALE_COOKIE_NAME}=([^;]+)`)
    );
    const cookieLocale = match?.[2];
    if (cookieLocale && isLocale(cookieLocale)) {
      return cookieLocale;
    }
  }

  if (typeof navigator !== "undefined" && navigator.languages) {
    // Try browser language preference
    for (const lang of navigator.languages) {
      const baseTag = lang.split("-")[0]?.toLowerCase();
      if (baseTag && isLocale(baseTag)) {
        return baseTag;
      }
    }
  }

  return baseLocale;
}

/**
 * Check if a string is a valid locale
 */
export function isLocale(value: string): value is Locale {
  return locales.includes(value.toLowerCase() as Locale);
}

/**
 * Get the current locale (reactive)
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Set the locale and load messages
 * Does NOT reload the page - UI updates reactively
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) {
    console.warn(`Invalid locale: ${locale}, falling back to ${baseLocale}`);
    locale = baseLocale;
  }

  // Persist to cookie
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}`;
  }

  // Load messages if not cached
  if (!localeCache.has(locale)) {
    try {
      const loadedMessages = await loadLocaleMessages(locale);
      localeCache.set(locale, loadedMessages);
    } catch (error) {
      console.error(`Failed to load locale ${locale}:`, error);
      // Fall back to English
      locale = baseLocale;
    }
  }

  // Update reactive state
  currentLocale = locale;
  messages = localeCache.get(locale) || (enMessages as Messages);
}

/**
 * Dynamically import locale messages
 */
async function loadLocaleMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case "en":
      return enMessages as Messages;
    case "es":
      return (await import("../../../../messages/es.json")).default as Messages;
    case "fr":
      return (await import("../../../../messages/fr.json")).default as Messages;
    case "de":
      return (await import("../../../../messages/de.json")).default as Messages;
    case "pt":
      return (await import("../../../../messages/pt.json")).default as Messages;
    case "zh":
      return (await import("../../../../messages/zh.json")).default as Messages;
    case "ja":
      return (await import("../../../../messages/ja.json")).default as Messages;
    case "ko":
      return (await import("../../../../messages/ko.json")).default as Messages;
    case "ar":
      return (await import("../../../../messages/ar.json")).default as Messages;
    case "ru":
      return (await import("../../../../messages/ru.json")).default as Messages;
    case "it":
      return (await import("../../../../messages/it.json")).default as Messages;
    default:
      return enMessages as Messages;
  }
}

/**
 * Translate a message key with optional parameter interpolation
 *
 * @example
 * t("app_name") // "TKA Scribe"
 * t("dashboard_viewing_as", { name: "John" }) // "Viewing as John"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let text = messages[key];

  if (!text) {
    // Development warning for missing keys
    if (import.meta.env.DEV) {
      console.warn(`Missing translation key: ${key}`);
    }
    return key;
  }

  // Handle parameter interpolation: {paramName}
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
    }
  }

  return text;
}

/**
 * Initialize the i18n system
 * Call this once in your root layout
 */
export async function initI18n(): Promise<void> {
  const initialLocale = getInitialLocale();
  if (initialLocale !== "en") {
    await setLocale(initialLocale);
  }
}

// For backwards compatibility - use getLocale() for reactive access
// Direct $state export removed due to Svelte 5 constraint on reassignable state exports
