/**
 * Museum 2D ITI Container
 *
 * Provides the 2D-to-3D pipeline services: grid analysis and persistence.
 */

import { createContainer } from "iti";
import { TileGridAnalyzer } from "../services/implementations/TileGridAnalyzer";
import { MuseumGridPersister } from "../services/implementations/MuseumGridPersister";
import { MuseumModelLoader } from "../services/implementations/MuseumModelLoader";

export const museum2DContainer = createContainer()
	.add({ tileGridAnalyzer: () => new TileGridAnalyzer() })
	.add({ museumGridPersister: () => new MuseumGridPersister() })
	.add({ museumModelLoader: () => new MuseumModelLoader() });

export type Museum2DContainer = typeof museum2DContainer;
