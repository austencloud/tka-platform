// Client-only test route. No SSR — renders real browse components against live
// public-sequence data fetched over plain REST in the browser (same as
// /test/profile-redesign). Mirrors the parent test layout's ssr=false.
export const ssr = false;
export const prerender = false;
