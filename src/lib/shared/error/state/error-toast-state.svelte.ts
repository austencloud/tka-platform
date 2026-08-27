/**
 * Error Toast State
 *
 * Manages a queue of error toasts that appear in the UI. Separate from the
 * simple toast system - error toasts support progress bars, pause-on-hover,
 * stacking compression, and auto-report integration that generic toasts don't.
 *
 * Usage:
 *   showErrorToast({ message: "Save failed", severity: "warning", duration: 5000 })
 *   dismissErrorToast(id)
 *   pauseErrorToast(id)   // called on mouse-enter
 *   resumeErrorToast(id)  // called on mouse-leave
 */

import type { ShowErrorOptions } from "../domain/error-models";

export interface ErrorToastItem {
  id: string;
  message: string;
  severity: "warning" | "info";
  duration: number;
  startedAt: number;
  remainingMs: number;
  paused: boolean;
  context: ShowErrorOptions["context"];
}

const MAX_VISIBLE = 3;

const DEFAULT_DURATION: Record<"warning" | "info", number> = {
  warning: 7000,
  info: 5000,
};


let toasts = $state<ErrorToastItem[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();


function getErrorToasts(): ErrorToastItem[] {
  return toasts;
}

function getVisibleErrorToasts(): ErrorToastItem[] {
  return toasts.slice(0, MAX_VISIBLE);
}

function getOverflowCount(): number {
  return Math.max(0, toasts.length - MAX_VISIBLE);
}


function generateId(): string {
  return `et-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeSeverity(
  raw: ShowErrorOptions["severity"]
): "warning" | "info" {
  // error and critical map to warning (they warrant the modal, not a toast)
  if (raw === "warning") return "warning";
  return "info";
}

function scheduleDismiss(id: string, delayMs: number): void {
  clearTimer(id);
  if (delayMs <= 0) return;
  timers.set(
    id,
    setTimeout(() => {
      dismissErrorToast(id);
    }, delayMs)
  );
}

function clearTimer(id: string): void {
  const existing = timers.get(id);
  if (existing !== undefined) {
    clearTimeout(existing);
    timers.delete(id);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Enqueue an error toast. Returns the assigned id.
 */
function showErrorToast(options: ShowErrorOptions): string {
  const id = generateId();
  const severity = normalizeSeverity(options.severity);
  const duration =
    options.duration !== undefined
      ? options.duration
      : DEFAULT_DURATION[severity];

  const item: ErrorToastItem = {
    id,
    message: options.message,
    severity,
    duration,
    startedAt: Date.now(),
    remainingMs: duration,
    paused: false,
    context: options.context,
  };

  toasts = [...toasts, item];

  scheduleDismiss(id, duration);

  return id;
}

/**
 * Remove a toast immediately.
 */
function dismissErrorToast(id: string): void {
  clearTimer(id);
  toasts = toasts.filter((t) => t.id !== id);
}

/**
 * Pause auto-dismiss for a toast (e.g. user hovers over it).
 * Records how much time remains so resume can continue from here.
 */
function pauseErrorToast(id: string): void {
  clearTimer(id);

  toasts = toasts.map((t) => {
    if (t.id !== id) return t;
    const elapsed = Date.now() - t.startedAt;
    const remaining = Math.max(0, t.duration - elapsed);
    return { ...t, paused: true, remainingMs: remaining };
  });
}

/**
 * Resume auto-dismiss after a pause. Uses remainingMs so progress is preserved.
 */
function resumeErrorToast(id: string): void {
  const toast = toasts.find((t) => t.id === id);
  if (!toast?.paused) return;

  toasts = toasts.map((t) => {
    if (t.id !== id) return t;
    return { ...t, paused: false, startedAt: Date.now() };
  });

  scheduleDismiss(id, toast.remainingMs);
}

export {
  getErrorToasts,
  getVisibleErrorToasts,
  getOverflowCount,
  showErrorToast,
  dismissErrorToast,
  pauseErrorToast,
  resumeErrorToast,
  MAX_VISIBLE,
};
