// The catalog is public and indexable: the server renders the product list
// (+page.server.ts) so crawlers and the first paint both get real HTML. The
// print pipeline that draws card art is browser-only and loads after mount, so
// nothing in the SSR module graph touches Firebase on the client.
export const prerender = false;
export const ssr = true;
