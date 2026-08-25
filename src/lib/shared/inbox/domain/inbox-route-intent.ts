import type { InboxTab } from "../state/inbox-state.svelte";

export interface InboxRouteIntent {
  tab: InboxTab;
  conversationId: string | null;
}

export function parseInboxRouteIntent(search: string): InboxRouteIntent {
  const params = new URLSearchParams(search);
  const conversationId = params.get("conversation")?.trim() || null;

  return {
    tab:
      params.get("inboxTab") === "notifications" ? "notifications" : "messages",
    conversationId,
  };
}
