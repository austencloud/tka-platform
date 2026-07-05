export type PendingActionType = 'save' | 'favorite' | 'publish' | 'remix' | 'sendTo' | 'download';

export interface PendingAction {
  type: PendingActionType;
  sequenceId: string;
  ts: number;
}

export const PENDING_URL_PARAM = 'pending';
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

const VALID_TYPES: ReadonlySet<PendingActionType> = new Set([
  "save",
  "favorite",
  "publish",
  "remix",
  "sendTo",
  "download",
]);

function isValidType(value: string): value is PendingActionType {
  return VALID_TYPES.has(value as PendingActionType);
}

export class PendingActionQueue {
  private pending: PendingAction | null = null;

  enqueue(action: Omit<PendingAction, "ts">): void {
    this.pending = { ...action, ts: Date.now() };
  }

  peek(): PendingAction | null {
    return this.readFresh();
  }

  drain(): PendingAction | null {
    const fresh = this.readFresh();
    this.pending = null;
    return fresh;
  }

  clear(): void {
    this.pending = null;
  }

  bootstrapFromUrl(url: URL): void {
    const raw = url.searchParams.get(PENDING_URL_PARAM);
    if (!raw || !isValidType(raw)) return;

    const sequenceId = this.deriveSequenceIdFromUrl(url);
    if (!sequenceId) return;

    this.enqueue({ type: raw, sequenceId });
  }

  serializeToUrlParam(): PendingActionType | null {
    return this.readFresh()?.type ?? null;
  }

  private readFresh(): PendingAction | null {
    if (!this.pending) return null;
    if (Date.now() - this.pending.ts > PENDING_ACTION_TTL_MS) {
      this.pending = null;
      return null;
    }
    return this.pending;
  }

  // The short-code route (/q/[code]) and the deep-link route (/sequence/[id])
  // both carry the sequence reference in the last path segment. This lets us
  // recover the reference after a webview handoff, where only the URL survives.
  private deriveSequenceIdFromUrl(url: URL): string | null {
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last && last.length > 0 ? decodeURIComponent(last) : null;
  }
}
