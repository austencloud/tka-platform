import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// The archive moved to /history on 2026-09-03: it documents movement
// languages, teaching archives, and current research alongside notation, so
// /notation named a quarter of it. 301 is the permanent page-move signal,
// carrying indexing, bookmarks, and backlinks onto the new URL. The per-prop
// and per-system pages under /notation/* are unaffected.
export const prerender = false;
export const load: PageLoad = () => {
  redirect(301, "/history");
};
