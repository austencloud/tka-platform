/**
 * TopologyPresets - Named topology configurations
 *
 * Each preset builds a GridTopology via the TopologyBuilder.
 * These are the arrangements users can select from the Multi-Grid Lab controls.
 */

import type { GridTopology } from "../models/grid-topology";
import { TopologyBuilder } from "../../services/topology-builder";

export interface TopologyPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly build: () => GridTopology;
}

export const TOPOLOGY_PRESETS: readonly TopologyPreset[] = [
  {
    id: "2-row-diamond",
    label: "2 Diamond",
    description: "Two diamond grids side by side",
    icon: "fa-link",
    build: () =>
      new TopologyBuilder()
        .create()
        .addGrid("a", { mode: "diamond" })
        .conjoin("a", "e", "b", "c")
        .build(),
  },
  {
    id: "3-row-diamond",
    label: "3 Diamond Row",
    description: "Three diamond grids in a row",
    icon: "fa-grip-lines",
    build: () =>
      new TopologyBuilder()
        .create()
        .chain(3, "diamond", "e")
        .build(),
  },
  {
    id: "6-row-diamond",
    label: "6 Diamond Row",
    description: "Six diamond grids in a row",
    icon: "fa-ellipsis",
    build: () =>
      new TopologyBuilder()
        .create()
        .chain(6, "diamond", "e")
        .build(),
  },
  {
    id: "2x2-diamond",
    label: "2x2 Diamond",
    description: "Four diamond grids in a square",
    icon: "fa-th-large",
    build: () =>
      new TopologyBuilder()
        .create()
        .addGrid("a", { mode: "diamond" })
        .conjoin("a", "e", "b", "c")
        .conjoin("a", "s", "c", "c")
        .conjoin("b", "s", "d", "c")
        .build(),
  },
  {
    id: "2-box",
    label: "2 Box",
    description: "Two box grids, A's outer SE corner = B's center",
    icon: "fa-square",
    build: () =>
      new TopologyBuilder()
        .create()
        .addGrid("a", { mode: "box" })
        .conjoin("a", "se", "b")
        .build(),
  },
  {
    id: "diagonal-box",
    label: "Diagonal Box",
    description: "Two box grids diagonal, A's outer SE corner = B's center",
    icon: "fa-diamond",
    build: () =>
      new TopologyBuilder()
        .create()
        .addGrid("a", { mode: "box" })
        .conjoin("a", "se", "b")
        .build(),
  },
  {
    id: "mixed-diamond-box",
    label: "Diamond + Box",
    description: "One diamond grid joined to one box grid",
    icon: "fa-shapes",
    build: () =>
      new TopologyBuilder()
        .create()
        .addGrid("a", { mode: "diamond" })
        .addGrid("b", { mode: "box" })
        .conjoin("a", "e", "b", "c")
        .build(),
  },
  {
    id: "3-row-box",
    label: "3 Box Row",
    description: "Three box grids in a diagonal chain",
    icon: "fa-grip-lines",
    build: () =>
      new TopologyBuilder()
        .create()
        .chain(3, "box", "se")
        .build(),
  },
  {
    id: "vertical-2",
    label: "2 Vertical",
    description: "Two diamond grids stacked vertically",
    icon: "fa-grip-lines-vertical",
    build: () =>
      new TopologyBuilder()
        .create()
        .addGrid("a", { mode: "diamond" })
        .conjoin("a", "s", "b", "c")
        .build(),
  },
  {
    id: "2-skewed",
    label: "2 Skewed",
    description: "Two skewed grids side by side (all 8 hand points per grid)",
    icon: "fa-shuffle",
    build: () =>
      new TopologyBuilder()
        .create()
        .addGrid("a", { mode: "skewed" })
        .conjoin("a", "e", "b", "c")
        .build(),
  },
  {
    id: "mixed-skewed-diamond",
    label: "Skewed + Diamond",
    description: "One skewed grid joined to one diamond grid",
    icon: "fa-code-branch",
    build: () =>
      new TopologyBuilder()
        .create()
        .addGrid("a", { mode: "skewed" })
        .addGrid("b", { mode: "diamond" })
        .conjoin("a", "e", "b", "c")
        .build(),
  },
  {
    id: "3-skewed-row",
    label: "3 Skewed Row",
    description: "Three skewed grids in a row",
    icon: "fa-grip-lines",
    build: () =>
      new TopologyBuilder()
        .create()
        .chain(3, "skewed", "e")
        .build(),
  },
];
