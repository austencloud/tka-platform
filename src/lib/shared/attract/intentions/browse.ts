/**
 * browse — using the library the way a visitor would.
 *
 * The ghost could already open other people's sequences; what it could not do
 * was USE the library — narrow it down, jump around it, work out what is in it.
 * Nothing in `shared/browse/` carried an annotation except the thumbnails.
 *
 * Austen (2026-08-06): "we don't need browse to be favored, we're just trying
 * to have natural behaviors, but we do want all of browse to be included in the
 * capability — to look through your library and to see other people's sequences
 * and filter and navigate the drill down."
 *
 * So these are capability, not preference. Their appeal is ordinary; they exist
 * so that when the ghost IS in the library it behaves like someone who knows
 * what a filter is, rather than someone who can only click pictures.
 */

import { safe } from "../domain/annotations";
import type { Intention } from "../domain/intention";
import { has, labelOf, oneOf, pickOf, pressKind } from "./helpers";

export const BROWSE_INTENTIONS: Intention[] = [
  {
    id: "filter-the-library",
    category: "explore",
    target: (ctx) => pickOf(ctx, "browse-filter"),
    // Names the filter it is about to open. "Only the level 3 ones" over a
    // press on the length chip is the narrate-one-thing-do-another failure the
    // target seam exists to prevent.
    thought: (ctx, target) => {
      const label = target ? labelOf(target) : "";
      if (!label) return "Let's narrow this down.";
      return oneOf(ctx, [
        `Let's narrow this down by ${label}.`,
        `Only some of these. ${label}.`,
        `Filter by ${label}, see what's left.`,
      ]);
    },
    can: (ctx) => has(ctx, "browse-filter") && has(ctx, "gallery-item"),
    appeal: () => 0.45,
    perform: async (g, ctx, target) => {
      if (!target || g.halted()) return false;
      await g.moveAndPress(target);

      /*
       * The round trip. Most of these chips open a popover, and an open popover
       * the ghost walks away from is the worst state in the system — the
       * backdrop makes every other control fail the hit-test. Choosing an
       * option calls handleSelect, which applies the filter AND closes the
       * popover, so following through is part of the intention rather than a
       * hoped-for follow-up.
       *
       * The favourites chip is a plain toggle with no popover, so finding no
       * options is a legitimate outcome and not a failure: it already did the
       * thing it came to do.
       */
      const options = await g.waitFor(safe("filter-option"), 1200);
      if (!options.length || g.halted()) return true;
      await g.sleep(g.jitter(700, 500));
      await g.moveAndPress(ctx.rng.pick(options)!);
      // Watch the grid re-flow to whatever survived.
      await g.dwell(g.jitter(2200, 1300));
      return true;
    },
  },

  {
    id: "jump-to-section",
    category: "explore",
    target: (ctx) => pickOf(ctx, "browse-section"),
    thought: (ctx, target) => {
      const label = target ? labelOf(target) : "";
      if (!label) return "What else is further down?";
      return oneOf(ctx, [
        `What's under ${label}?`,
        `Skip ahead to ${label}.`,
      ]);
    },
    // A library long enough to have sections is a library worth showing off the
    // size of — jumping is how you make that legible without scrolling forever.
    can: (ctx) => has(ctx, "browse-section") && has(ctx, "gallery-item"),
    appeal: () => 0.3,
    perform: async (g, _ctx, target) => {
      if (!target || g.halted()) return false;
      await g.moveAndPress(target);
      await g.dwell(g.jitter(2000, 1200));
      return true;
    },
  },

  {
    id: "clear-the-filters",
    category: "explore",
    thought: (ctx) =>
      oneOf(ctx, [
        "Right, show me everything again.",
        "That's too narrow. All of it.",
      ]),
    /*
     * The way back out. A filtered library that never un-filters ends the jam
     * showing three sequences, and the ghost would have no way to notice: an
     * empty grid still satisfies every other browse precondition, because
     * `gallery-item` counts what is on screen and a filter simply makes that a
     * smaller number.
     *
     * Only ever after it has actually filtered something.
     */
    can: (ctx) =>
      has(ctx, "browse-filter") &&
      (ctx.performed.get("filter-the-library") ?? 0) > 0 &&
      ctx.available["gallery-item"] < 6,
    appeal: () => 0.6,
    mood: "unsure",
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "browse-filter", 1500))) return false;
      const options = await g.waitFor(safe("filter-option"), 1200);
      if (!options.length || g.halted()) return true;
      // The first option in these popovers is the "All" reset.
      await g.moveAndPress(options[0]!);
      await g.dwell(g.jitter(1600, 1000));
      return true;
    },
  },
];
