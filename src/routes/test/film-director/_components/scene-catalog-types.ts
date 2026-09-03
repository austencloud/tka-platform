import type { DirectorSceneCategory } from "../_lib/film-director-schema";

/**
 * One row in the scene catalog.
 *
 * Its own module rather than an export from SceneCatalog.svelte, because both
 * hosts build these before they render anything: the marquee maps a resolved
 * spec into them with no film running, and the modal index maps the director's
 * live film. A type imported from a component would drag the component into
 * that path for nothing.
 *
 * `index` is the position in the film and is what the in-film host solos by.
 * `id` is the stable address, and is what the card leads with and what the
 * marquee opens by, because positions move when a scene is added or removed.
 */
export type CatalogScene = {
  index: number;
  id: string;
  title: string;
  intent: string | null;
  seconds: number;
  category?: DirectorSceneCategory;
};
