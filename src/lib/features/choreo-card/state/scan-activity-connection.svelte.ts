import { untrack } from "svelte";
import type { ScanActivityState } from "./scan-activity-state.svelte";

export interface ScanActivityAuthSnapshot {
  loading: boolean;
  userId: string | null;
  isAdmin: boolean;
}

type ScanActivityConnection = Pick<ScanActivityState, "connect" | "disconnect">;

export function watchScanActivityConnection(
  activity: ScanActivityConnection,
  getAuth: () => ScanActivityAuthSnapshot
): void {
  $effect(() => {
    const { loading, userId, isAdmin } = getAuth();
    if (loading) return;

    // Auth is the dependency surface. connect() reads and writes its own rune
    // state before the first await, so tracking that work creates a feedback
    // loop between this effect and the connection status it changes.
    untrack(() => {
      void activity.connect(userId, isAdmin);
    });

    return () => {
      untrack(() => activity.disconnect());
    };
  });
}
