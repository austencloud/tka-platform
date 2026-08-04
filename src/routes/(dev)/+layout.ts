import { guardInternalRoute } from "../../config/build-flags";
import type { LayoutLoad } from "./$types";

// The (dev) group holds throwaway harnesses (video-collab-demo). Client-only,
// never public.
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = () => {
  guardInternalRoute();
  return {};
};
