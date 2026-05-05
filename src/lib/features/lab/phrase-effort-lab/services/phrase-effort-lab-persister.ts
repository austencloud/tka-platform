import type { EffortTimeline } from "../domain/effort-timeline-types";

const SESSION_KEY = "phrase-effort-lab-sequence-id";
const SESSION_TIMELINE_KEY = "phrase-effort-lab-timeline";

export function persistSequenceId(id: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch { /* ignore */ }
}

export function getPersistedSequenceId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function persistTimeline(timeline: EffortTimeline): void {
  try {
    sessionStorage.setItem(SESSION_TIMELINE_KEY, JSON.stringify(timeline));
  } catch { /* quota exceeded or private mode */ }
}

export function restoreTimeline(): EffortTimeline | null {
  try {
    const saved = sessionStorage.getItem(SESSION_TIMELINE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as EffortTimeline;
    return parsed?.phrases ? parsed : null;
  } catch {
    return null;
  }
}
