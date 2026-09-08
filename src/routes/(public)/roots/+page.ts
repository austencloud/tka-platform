import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// /roots was folded into the archive, which now lives at /history. 301 is the
// permanent page-merge signal, consolidating indexing onto one URL for shared
// links, bookmarks, and backlinks. Point at the final URL, not at /notation,
// so the hop is single rather than a 301 chain.
export const prerender = false;
export const load: PageLoad = () => {
  redirect(301, "/history");
};
