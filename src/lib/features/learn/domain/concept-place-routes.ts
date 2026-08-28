import { getConceptById } from "@tka/domain";
import { CONCEPT_LIST_PATH } from "./concept-routes";

export const CONCEPT_PLACE_PARAM = "place";

export function readConceptPlaceId(
  searchParams: URLSearchParams
): string | null {
  const id = searchParams.get(CONCEPT_PLACE_PARAM);
  return id && getConceptById(id) ? id : null;
}

export function writeConceptPlaceId(url: URL, id: string | null): void {
  if (id && getConceptById(id)) {
    url.searchParams.set(CONCEPT_PLACE_PARAM, id);
  } else {
    url.searchParams.delete(CONCEPT_PLACE_PARAM);
  }
}

export function buildConceptPlaceHref(id: string): string {
  const url = new URL(CONCEPT_LIST_PATH, "https://tkaflowarts.com");
  writeConceptPlaceId(url, id);
  return `${url.pathname}${url.search}`;
}

export function shouldResumeSavedConcept(
  routeConceptId: string | null,
  routePlaceId: string | null,
  allowResume: boolean
): boolean {
  return allowResume && routeConceptId === null && routePlaceId === null;
}
