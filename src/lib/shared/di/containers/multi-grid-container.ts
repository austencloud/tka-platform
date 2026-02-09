/**
 * Multi-Grid ITI Container
 *
 * Provides topology building, rendering, position enumeration,
 * prop loading, and beta separation services for N-grid arrangements.
 */

import { createContainer } from "iti";
import { GridGeometry } from "$lib/shared/multi-grid/services/implementations/GridGeometry";
import { TopologyBuilder } from "$lib/shared/multi-grid/services/implementations/TopologyBuilder";
import { TopologyRenderer } from "$lib/shared/multi-grid/services/implementations/TopologyRenderer";
import { TopologyPositionEnumerator } from "$lib/shared/multi-grid/services/implementations/TopologyPositionEnumerator";
import { TopologyPropLoader } from "$lib/shared/multi-grid/services/implementations/TopologyPropLoader";
import { TopologyBetaSeparator } from "$lib/shared/multi-grid/services/implementations/TopologyBetaSeparator";

export const multiGridContainer = createContainer().add({
  gridGeometry: () => new GridGeometry(),
  topologyBuilder: () => new TopologyBuilder(),
  topologyRenderer: () => new TopologyRenderer(),
  topologyPositionEnumerator: () => new TopologyPositionEnumerator(),
  topologyPropLoader: () => new TopologyPropLoader(),
  topologyBetaSeparator: () => new TopologyBetaSeparator(),
});
