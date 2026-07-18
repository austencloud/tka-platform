import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// /roots was folded into /notation. 301 is the permanent page-merge signal,
// consolidating indexing onto one URL for shared links, bookmarks, and backlinks.
export const prerender = false;
export const load: PageLoad = () => {
  redirect(301, "/notation");
};
