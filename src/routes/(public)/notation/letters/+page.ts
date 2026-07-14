import type { PageLoad } from "./$types";
import { allLetterSeo } from "$lib/shared/seo/notation-letters";
import { LANDING_DOMAIN } from "../../../../config/domains";

export const prerender = true;

export const load: PageLoad = () => ({
  letters: allLetterSeo(),
  domain: LANDING_DOMAIN,
});
