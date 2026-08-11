// The signup surface (SocialAuthCompact) reads page.url.searchParams for
// in-app-browser detection, which throws during prerendering. The page is
// auth-live anyway, so it renders on demand like the app routes.
export const prerender = false;
