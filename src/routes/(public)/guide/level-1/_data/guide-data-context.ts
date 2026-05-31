import { getContext, setContext } from "svelte";
import type { GuideChapterData } from "./guide-types";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const GUIDE_DATA_KEY = Symbol("guide-data");
const ACTIVE_SECTION_KEY = Symbol("active-section");

export function setGuideData(data: GuideChapterData): void {
  setContext(GUIDE_DATA_KEY, data);
}

export function getGuideData(): GuideChapterData {
  return getContext<GuideChapterData>(GUIDE_DATA_KEY);
}

export function lookupPictograph(
  data: GuideChapterData,
  id: string
): PictographData | null {
  return data.pictographs[id] ?? null;
}

export function lookupSequence(
  data: GuideChapterData,
  id: string
): PictographData[] | null {
  return data.sequences[id] ?? null;
}

export function setActiveSectionContext(setter: (id: string) => void): void {
  setContext(ACTIVE_SECTION_KEY, setter);
}

export function getActiveSectionSetter(): ((id: string) => void) | null {
  return getContext<((id: string) => void) | null>(ACTIVE_SECTION_KEY) ?? null;
}
