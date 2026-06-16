// CSR-only: this specimen pulls in the animation/pictograph engine, which is
// client-only in this app (same pattern as the other test routes). It also
// must NOT import $lib/shared/auth/firebase — that boots the auth listener,
// which pulls in module-state and rewrites /test/* URLs. Public sequences are
// read over plain REST instead.
export const ssr = false;
