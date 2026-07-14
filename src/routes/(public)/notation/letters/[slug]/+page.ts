import { error } from "@sveltejs/kit";
import type { EntryGenerator, PageLoad } from "./$types";
import {
  CANONICAL_LETTERS,
  letterToSlug,
  slugToLetter,
  letterSeo,
} from "$lib/shared/seo/notation-letters";
import { LANDING_DOMAIN } from "../../../../../config/domains";

export const prerender = true;

/** Enumerate every letter slug so all 47 pages prerender to static HTML. */
export const entries: EntryGenerator = () =>
  CANONICAL_LETTERS.map((letter) => ({ slug: letterToSlug(letter) }));

export const load: PageLoad = ({ params }) => {
  const letter = slugToLetter(params.slug);
  if (!letter) throw error(404, `Unknown Kinetic Alphabet letter "${params.slug}"`);

  const seo = letterSeo(letter);
  const all = CANONICAL_LETTERS.map((l) => letterToSlug(l));
  const i = all.indexOf(seo.slug);

  return {
    seo,
    domain: LANDING_DOMAIN,
    prevSlug: i > 0 ? all[i - 1] : null,
    nextSlug: i < all.length - 1 ? all[i + 1] : null,
  };
};
