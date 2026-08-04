import { guardInternalRoute } from "../../config/build-flags";
import type { LayoutLoad } from "./$types";

// Retro-era experiment with a catch-all child ([...app]), so the guard lives on
// the layout to cover every path beneath /1995.
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = () => {
  guardInternalRoute();
  return {};
};
