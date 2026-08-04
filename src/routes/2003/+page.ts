import { guardInternalRoute } from "../../config/build-flags";
import type { PageLoad } from "./$types";

// Retro-era experiment. Belongs to the `retro` dev feature; its components are
// emptied in production, so this guard keeps the URL from rendering blank.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = () => {
  guardInternalRoute();
  return {};
};
