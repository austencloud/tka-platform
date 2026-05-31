// Client-only: the reused LOOPExpandedOverlay pulls in the sequence-engine loop module,
// which isn't SSR-safe. This is a prototype/test harness, so render it on the client.
export const ssr = false;
