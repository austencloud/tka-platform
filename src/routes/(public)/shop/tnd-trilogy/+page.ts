// Client-only: the trilogy page renders real printed card fronts via the
// browser-only print pipeline (canvas + workers + firebase). No SSR.
export const ssr = false;
export const prerender = false;
