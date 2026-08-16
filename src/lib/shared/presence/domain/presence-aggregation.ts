import type {
  MultiConnectionPresence,
  StoredPresence,
  UserPresence,
  UserPresenceWithId,
} from "./models/presence-models";
import { computeActivityStatus } from "./models/presence-models";

function timestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function activityTime(presence: UserPresence): number {
  return timestamp(presence.lastActivity ?? presence.lastSeen);
}

function isMultiConnectionPresence(
  presence: StoredPresence
): presence is MultiConnectionPresence {
  return (
    ("schemaVersion" in presence && presence.schemaVersion === 2) ||
    ("connections" in presence && presence.connections != null)
  );
}

function offlinePresence(userId: string, lastSeen: number): UserPresenceWithId {
  return {
    userId,
    online: false,
    activityStatus: "offline",
    lastActivity: lastSeen,
    lastSeen,
    currentModule: "",
    currentTab: null,
    sessionId: "",
    device: "desktop",
  };
}

/**
 * Collapse every live browser connection into the one user card the admin sees.
 * The freshest connection supplies descriptive fields, while any recently
 * active connection is enough to keep the user active.
 */
export function aggregateStoredPresence(
  userId: string,
  stored: StoredPresence
): UserPresenceWithId {
  if (!isMultiConnectionPresence(stored)) {
    const lastActivity = activityTime(stored);

    // Flat records came from clients that shared one online flag across every
    // tab. A surviving tab writes a fresh active status after another tab has
    // incorrectly flipped that flag off. A genuine disconnect writes the
    // stored status back to offline, so this compatibility signal distinguishes
    // the two production states during rollout.
    const hasLiveLegacySignal =
      stored.online || stored.activityStatus === "active";

    return {
      userId,
      ...stored,
      online: hasLiveLegacySignal,
      activityStatus: computeActivityStatus(lastActivity, hasLiveLegacySignal),
    };
  }

  const connections = Object.values(stored.connections ?? {});
  const userLastSeen = timestamp(stored.lastSeen);
  if (connections.length === 0) {
    return offlinePresence(userId, userLastSeen);
  }

  const ordered = [...connections].sort(
    (left, right) => activityTime(right) - activityTime(left)
  );
  const freshest = ordered[0]!;
  const lastActivity = Math.max(...connections.map(activityTime), 0);
  const lastSeen = Math.max(
    userLastSeen,
    ...connections.map((presence) => timestamp(presence.lastSeen)),
    lastActivity
  );
  const active = connections.some(
    (presence) =>
      computeActivityStatus(activityTime(presence), true) === "active"
  );

  return {
    userId,
    ...freshest,
    online: true,
    activityStatus: active ? "active" : "offline",
    lastActivity,
    lastSeen,
  };
}

export function aggregatePresenceTree(
  data: Record<string, StoredPresence> | null
): UserPresenceWithId[] {
  if (!data) return [];

  return Object.entries(data)
    .map(([userId, presence]) => aggregateStoredPresence(userId, presence))
    .sort((left, right) => {
      if (left.activityStatus !== right.activityStatus) {
        return left.activityStatus === "active" ? -1 : 1;
      }
      return activityTime(right) - activityTime(left);
    });
}
