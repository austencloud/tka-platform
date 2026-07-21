/**
 * Stub for SvelteKit's `$env/static/public` in component tests.
 *
 * Static public env vars are inlined at build time by SvelteKit; component
 * tests build through plain Vite, so consumers get undefined and take their
 * disabled path. Named exports are added here only when a component under test
 * actually needs one.
 */
export const PUBLIC_POSTHOG_HOST = "";
export const PUBLIC_POSTHOG_KEY = "";
export const PUBLIC_POSTHOG_PROJECT_ID = "";
