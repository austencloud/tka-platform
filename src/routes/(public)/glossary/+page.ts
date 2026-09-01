import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const prerender = false;

export const load: PageLoad = ({ url }) => {
  // Old bookmarks and shared letter links keep their complete state while the
  // public destination now uses the name people see throughout the product.
  redirect(308, `/atlas${url.search}${url.hash}`);
};
