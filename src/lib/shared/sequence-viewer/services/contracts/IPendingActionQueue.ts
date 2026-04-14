export type PendingActionType = 'save' | 'favorite' | 'publish' | 'remix' | 'sendTo';

export interface PendingAction {
  type: PendingActionType;
  sequenceId: string;
  ts: number;
}

export interface IPendingActionQueue {
  enqueue(action: Omit<PendingAction, 'ts'>): void;
  peek(): PendingAction | null;
  drain(): PendingAction | null;
  clear(): void;
  bootstrapFromUrl(url: URL): void;
  serializeToUrlParam(): PendingActionType | null;
}

export const PENDING_URL_PARAM = 'pending';
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;
