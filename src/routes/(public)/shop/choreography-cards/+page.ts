import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// The standalone Choreo Cards explainer retired into the shop itself: the card
// anatomy diagram and the live-QR explanation now sit in each product page's
// "how it works" section, and the brand story is the /shop hero. 308 preserves
// the path + method for shared links, matching the /store shim.
export const prerender = false;
export const load: PageLoad = () => {
  redirect(308, "/shop");
};
