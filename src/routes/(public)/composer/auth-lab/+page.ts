import { guardInternalRoute } from "../../../../config/build-flags";
import type { PageLoad } from "./$types";

// Browser-only design harness for the auth modal. It sits under the public
// /composer namespace for layout reasons only — it is not a public page.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = () => {
  guardInternalRoute();
  return {};
};
