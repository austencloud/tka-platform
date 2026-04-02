/**
 * Museum ITI Container
 *
 * Provides museum services: grid analysis, persistence, and model loading.
 */

import { createContainer } from "iti";
import { TileGridAnalyzer } from "../services/implementations/TileGridAnalyzer";
import { MuseumGridPersister } from "../services/implementations/MuseumGridPersister";
import { MuseumModelLoader } from "../services/implementations/MuseumModelLoader";

export const museumContainer = createContainer()
	.add({ tileGridAnalyzer: () => new TileGridAnalyzer() })
	.add({ museumGridPersister: () => new MuseumGridPersister() })
	.add({ museumModelLoader: () => new MuseumModelLoader() });

export type MuseumContainer = typeof museumContainer;
