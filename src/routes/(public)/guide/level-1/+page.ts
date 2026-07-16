import { redirect } from "@sveltejs/kit";

// The static /guide/level-1 landing is retired - the guide lives in the app
// reader at /learn/guide (deep links: /learn/guide/<slug>). Prerender emits a
// meta-refresh redirect page; the runtime router 308s.
export const prerender = true;

export function load(): never {
  redirect(308, "/learn/guide");
}
