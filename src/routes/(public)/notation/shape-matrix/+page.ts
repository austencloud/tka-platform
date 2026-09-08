import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// Shape Engine outgrew its nested home under /notation and now lives at
// /shape-engine. 301 is the permanent page-move signal, carrying indexing,
// bookmarks, and backlinks onto the new URL. The query string travels with
// it so shared matrix and theory links (level, turns, pair, ratios) keep
// restoring the exact state they were copied from.
export const prerender = false;
export const load: PageLoad = ({ url }) => {
  redirect(301, `/shape-engine${url.search}`);
};
