import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// /store was renamed to /shop. 308 preserves the path + method for shared links.
export const prerender = false;
export const load: PageLoad = () => {
  redirect(308, "/shop");
};
