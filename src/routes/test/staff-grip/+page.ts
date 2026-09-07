/**
 * This route renders its own shell via `+layout@.svelte`, which resets the
 * layout chain to the root. That reset also drops `test/+layout.ts`, so the
 * root's `ssr = true` applies again and the lab would render on the server —
 * where the browse engine behind the sequence picker throws, and where a
 * `<Canvas>` has nothing to draw to. Every other `/test/*` harness runs
 * client-only for the same reason; this restates it for the one route that
 * opted out of the group layout.
 */
export const ssr = false;
export const prerender = false;
