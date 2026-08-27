/**
 * Locale-Aware Formatters
 *
 * Thin wrappers around native Intl APIs that automatically use the current locale.
 * Zero dependencies - uses only browser-native formatting.
 *
 * @example
 * formatDate(new Date())           // "1/8/2026" (en) | "08/01/2026" (fr)
 * formatNumber(1234567)            // "1,234,567" (en) | "1 234 567" (fr)
 * formatCurrency(29.99, "USD")     // "$29.99" (en) | "29,99 $US" (fr)
 * formatTimeAgo(pastDate)          // "5 minutes ago" | "il y a 5 minutes"
 */

import { getLocale } from "./i18n.svelte.js";

// FORMATTER CACHES (avoid recreating Intl objects on every call)

type FormatterCache<T> = Map<string, T>;

const dateFormatters: FormatterCache<Intl.DateTimeFormat> = new Map();
const numberFormatters: FormatterCache<Intl.NumberFormat> = new Map();
const relativeFormatters: FormatterCache<Intl.RelativeTimeFormat> = new Map();

function getCacheKey(locale: string, options: object): string {
  return `${locale}:${JSON.stringify(options)}`;
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

export type DateStyle = "full" | "long" | "medium" | "short";

export interface FormatDateOptions {
  /** Shorthand for dateStyle */
  style?: DateStyle;
  /** Date portion style */
  dateStyle?: DateStyle;
  /** Time portion style */
  timeStyle?: DateStyle;
}

/**
 * Format a date using the current locale
 *
 * @example
 * formatDate(new Date())                    // "1/8/2026"
 * formatDate(date, { style: "long" })       // "January 8, 2026"
 * formatDate(date, { style: "full" })       // "Wednesday, January 8, 2026"
 * formatDate(date, { dateStyle: "short", timeStyle: "short" }) // "1/8/26, 3:30 PM"
 */
export function formatDate(
  date: Date | number | string,
  options: FormatDateOptions = {}
): string {
  const locale = getLocale();
  const dateObj = date instanceof Date ? date : new Date(date);

  const opts: Intl.DateTimeFormatOptions = options.style
    ? { dateStyle: options.style }
    : { dateStyle: options.dateStyle, timeStyle: options.timeStyle };

  const key = getCacheKey(locale, opts);
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, opts);
    dateFormatters.set(key, formatter);
  }

  return formatter.format(dateObj);
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

export interface FormatNumberOptions {
  /** Number style */
  style?: "decimal" | "percent" | "currency";
  /** Currency code (required if style is "currency") */
  currency?: string;
  /** Minimum fraction digits */
  minimumFractionDigits?: number;
  /** Maximum fraction digits */
  maximumFractionDigits?: number;
  /** Compact notation for large numbers */
  notation?: "standard" | "compact";
}

/**
 * Format a number using the current locale
 *
 * @example
 * formatNumber(1234567)                       // "1,234,567" (en) | "1 234 567" (fr)
 * formatNumber(0.75, { style: "percent" })    // "75%"
 * formatNumber(1234567, { notation: "compact" }) // "1.2M"
 * formatNumber(1234.5678, { maximumFractionDigits: 2 }) // "1,234.57"
 */
export function formatNumber(
  value: number,
  options: FormatNumberOptions = {}
): string {
  const locale = getLocale();
  const key = getCacheKey(locale, options);

  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, formatter);
  }

  return formatter.format(value);
}

/**
 * Format currency using the current locale
 *
 * @example
 * formatCurrency(29.99)              // "$29.99" (en-US)
 * formatCurrency(29.99, "EUR")       // "€29.99" (en) | "29,99 €" (fr)
 * formatCurrency(29.99, "JPY")       // "¥30"
 */
export function formatCurrency(value: number, currency: string = "USD"): string {
  return formatNumber(value, { style: "currency", currency });
}

/**
 * Format a percentage
 *
 * @example
 * formatPercent(0.75)    // "75%"
 * formatPercent(0.333)   // "33%"
 * formatPercent(1.5)     // "150%"
 */
export function formatPercent(value: number): string {
  return formatNumber(value, { style: "percent", maximumFractionDigits: 0 });
}

/**
 * Format a number in compact notation
 *
 * @example
 * formatCompact(1234)        // "1.2K"
 * formatCompact(1234567)     // "1.2M"
 * formatCompact(1234567890)  // "1.2B"
 */
export function formatCompact(value: number): string {
  return formatNumber(value, { notation: "compact" });
}

// ============================================================================
// RELATIVE TIME FORMATTING
// ============================================================================

type RelativeTimeUnit =
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year";

/**
 * Format relative time using the current locale
 *
 * @example
 * formatRelativeTime(-1, "day")    // "yesterday" (en) | "hier" (fr)
 * formatRelativeTime(2, "hour")    // "in 2 hours"
 * formatRelativeTime(-5, "minute") // "5 minutes ago"
 */
export function formatRelativeTime(
  value: number,
  unit: RelativeTimeUnit
): string {
  const locale = getLocale();
  const opts = { numeric: "auto" as const };
  const key = getCacheKey(locale, opts);

  let formatter = relativeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, opts);
    relativeFormatters.set(key, formatter);
  }

  return formatter.format(value, unit);
}

/**
 * Smart relative time from a date - automatically picks appropriate unit
 *
 * @example
 * formatTimeAgo(new Date(Date.now() - 30000))     // "30 seconds ago"
 * formatTimeAgo(new Date(Date.now() - 3600000))   // "1 hour ago"
 * formatTimeAgo(new Date(Date.now() - 86400000))  // "yesterday"
 */
export function formatTimeAgo(date: Date | number): string {
  const now = Date.now();
  const then = typeof date === "number" ? date : date.getTime();
  const diffSeconds = Math.round((then - now) / 1000);

  const units: [RelativeTimeUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      const value = Math.round(diffSeconds / seconds);
      return formatRelativeTime(value, unit);
    }
  }

  return formatRelativeTime(0, "second"); // "now"
}

// ============================================================================
// LIST FORMATTING
// ============================================================================

export type ListStyle = "long" | "short" | "narrow";
export type ListType = "conjunction" | "disjunction" | "unit";

/**
 * Format a list of items using the current locale
 *
 * @example
 * formatList(["A", "B", "C"])                    // "A, B, and C" (en) | "A, B et C" (fr)
 * formatList(["A", "B"], { type: "disjunction" }) // "A or B"
 */
export function formatList(
  items: string[],
  options: { style?: ListStyle; type?: ListType } = {}
): string {
  const locale = getLocale();
  const formatter = new Intl.ListFormat(locale, {
    style: options.style || "long",
    type: options.type || "conjunction",
  });
  return formatter.format(items);
}
