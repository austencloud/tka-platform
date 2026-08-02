// The coven hub mounts a Threlte WebGL scene and creates viewer-3d state on
// init, which is browser-only. Disable SSR so the page renders client-side,
// matching every other 3D/canvas route (endless-spinner, sequence, card-back).
import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const ssr = false;

export const load: PageLoad = () => {
  if (typeof __FEATURE_COVEN__ === "undefined" || !__FEATURE_COVEN__) {
    redirect(307, "/browse/gallery");
  }

  return {};
};
