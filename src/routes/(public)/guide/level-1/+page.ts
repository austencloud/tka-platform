// Auth-gated edit mode requires per-request evaluation, so no prerender.
// SSR is still on for the public read view.
export const prerender = false;
export const ssr = true;
