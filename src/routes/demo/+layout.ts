import { guardInternalRoute } from "../../config/build-flags";
import type { LayoutLoad } from "./$types";

// /demo/* are component test harnesses (promo-generator, video-record).
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = () => {
  guardInternalRoute();
  return {};
};
