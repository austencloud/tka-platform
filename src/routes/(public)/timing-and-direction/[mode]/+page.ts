import { error } from "@sveltejs/kit";
import type { EntryGenerator, PageLoad } from "./$types";
import {
  getTimingDirectionArticle,
  TIMING_DIRECTION_ARTICLE_SLUGS,
} from "../_data/timing-direction-articles";

export const entries: EntryGenerator = () =>
  TIMING_DIRECTION_ARTICLE_SLUGS.map((mode) => ({ mode }));

export const load: PageLoad = ({ params }) => {
  const article = getTimingDirectionArticle(params.mode);
  if (!article) error(404, "Timing and direction mode not found");
  return { mode: article.slug };
};
