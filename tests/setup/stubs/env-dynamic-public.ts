/**
 * Stub for SvelteKit's `$env/dynamic/public` in component tests.
 *
 * Component tests render a single component in the browser without the
 * SvelteKit server, so the real module has nothing to read. Anything that
 * reaches for a public env var (analytics, maps) gets an empty bag and falls
 * back to its disabled path, which is what a component test wants anyway.
 */
export const env: Record<string, string | undefined> = {};
