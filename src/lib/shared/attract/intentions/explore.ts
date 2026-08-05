/**
 * explore — the breadth half of the design. Nothing here enumerates the app:
 * `go-to-module` is one generic navigator that scores highest for modules
 * missing from `visitedModules`, so covering 26 modules is a consequence of
 * novelty rather than a separate mechanism (and a new module is covered the
 * day it appears in the nav, with no authoring).
 */

import {
  NAV_MODULE_ID_ATTR,
  NAV_MODULE_SEL,
  NAV_TAB_SEL,
  isDeniedModule,
  safe,
} from "../domain/annotations";
import type { Intention } from "../domain/intention";
import { visibleAll } from "../services/sensors";
import {
  browseKind,
  has,
  labelOf,
  pressKind,
  restlessness,
  settled,
  watchKind,
} from "./helpers";

/** Firestore reads cost money at a jam that runs for hours. */
const GALLERY_OPENS_PER_SESSION = 8;
let galleryOpens = 0;

/** Buttons this session has already asked about, so it asks about new ones. */
const askedAbout = new Set<string>();

/**
 * The way out of a room with no visible exit, injected by the host so the bag
 * stays free of feature imports. It must perform a REAL module switch (the
 * same one the nav performs), never a URL-only navigation.
 */
let escapeHatch: (() => Promise<void> | void) | null = null;

export function setEscapeHatch(fn: (() => Promise<void> | void) | null): void {
  escapeHatch = fn;
}

/** Nav buttons for modules the ghost has not been to yet, denylist applied. */
function unvisitedNavButtons(visited: ReadonlySet<string>): HTMLElement[] {
  return visibleAll(NAV_MODULE_SEL).filter((el) => {
    const id = el.getAttribute(NAV_MODULE_ID_ATTR);
    return !!id && !isDeniedModule(id) && !visited.has(id);
  });
}

export const EXPLORE_INTENTIONS: Intention[] = [
  {
    id: "what-is-this-button",
    category: "explore",
    thought: (ctx) => {
      const fresh = visibleAll(safe("curio")).find(
        (el) => !askedAbout.has(labelOf(el)),
      );
      void ctx;
      const name = fresh ? labelOf(fresh) : "";
      return name ? `What does ${name} do?` : "What does this one do?";
    },
    can: (ctx) => has(ctx, "curio"),
    appeal: () => 0.5,
    perform: async (g, ctx) => {
      const fresh = (await g.waitFor(safe("curio"), 1500)).filter(
        (el) => !askedAbout.has(labelOf(el)),
      );
      const target = fresh.length ? ctx.rng.pick(fresh)! : null;
      if (!target || g.halted()) return false;
      askedAbout.add(labelOf(target));
      await g.moveAndPress(target);
      await g.dwell(g.jitter(1600, 1200));
      return true;
    },
  },

  {
    id: "open-viewer",
    category: "explore",
    thought: "What's this 3D thing?",
    can: (ctx) => has(ctx, "viewer") && !ctx.viewerOpen && ctx.hasSequence,
    appeal: () => 0.6,
    mood: "delighted",
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "viewer", 3000))) return false;
      // WebGL is the expensive thing at a park on battery: look, then leave.
      await watchKind(g, "stage", g.jitter(4000, 2500), 6000);
      return true;
    },
  },

  {
    id: "overwhelmed",
    category: "explore",
    // Pure personality. It presses nothing, so it is always safe and always
    // possible — the ghost is allowed to just be a little lost.
    thought: "…that's a lot of buttons.",
    can: () => true,
    appeal: (ctx) => 0.12 + restlessness(ctx) * 0.15,
    mood: "unsure",
    perform: async (g, ctx) => {
      g.setHover(null);
      const drifts = 2 + ctx.rng.int(3);
      for (let i = 0; i < drifts && !g.halted(); i++) {
        await g.glideTo(
          window.innerWidth * (0.25 + ctx.rng.next() * 0.5),
          window.innerHeight * (0.25 + ctx.rng.next() * 0.5),
        );
        await g.dwell(g.jitter(700, 800));
      }
      return true;
    },
  },

  {
    id: "go-to-module",
    category: "explore",
    thought: (ctx) => {
      const next = unvisitedNavButtons(ctx.visitedModules)[0];
      const name = next ? labelOf(next) : "";
      return name ? `I haven't looked at ${name} yet.` : "Let's see what else is here.";
    },
    can: (ctx) => ctx.available["nav-module"] > 0 && ctx.reachableModules.length > 0,
    // Restlessness is what stops the ghost admiring one screen for the whole
    // jam; an unvisited module is worth more than a re-visit.
    appeal: (ctx) =>
      ((unvisitedNavButtons(ctx.visitedModules).length ? 0.55 : 0.25) +
        restlessness(ctx) * 0.45) *
      settled(ctx),
    perform: async (g, ctx) => {
      const buttons = await g.waitFor(NAV_MODULE_SEL, 2000);
      if (!buttons.length || g.halted()) return false;
      const allowed = buttons.filter((el) => {
        const id = el.getAttribute(NAV_MODULE_ID_ATTR);
        return !!id && !isDeniedModule(id);
      });
      if (!allowed.length) return false;
      const unvisited = allowed.filter(
        (el) => !ctx.visitedModules.has(el.getAttribute(NAV_MODULE_ID_ATTR)!),
      );
      const pool = unvisited.length ? unvisited : allowed;
      await g.moveAndPress(ctx.rng.pick(pool)!);
      // Give the module its mount before the next tick senses an empty screen.
      await g.sleep(g.jitter(1800, 1200));
      return true;
    },
  },

  {
    id: "change-tab",
    category: "explore",
    thought: "There's more in here.",
    can: (ctx) => has(ctx, "nav-tab"),
    appeal: (ctx) => (0.3 + restlessness(ctx) * 0.2) * settled(ctx),
    perform: async (g, ctx) => {
      // Sidebar tabs come from @austencloud/sidebar, so they are matched by the
      // package's own class rather than an annotation TKA cannot add.
      const tabs = await g.waitFor(NAV_TAB_SEL, 1500);
      if (!tabs.length || g.halted()) return false;
      await g.moveAndPress(ctx.rng.pick(tabs)!);
      await g.sleep(g.jitter(1400, 1000));
      return true;
    },
  },

  {
    id: "escape-room",
    category: "reset",
    thought: "Let's go back.",
    // The trap this exists for: an immersive module (the museum, a fullscreen
    // scene) that hides the sidebar. With no nav button on screen the ghost
    // physically cannot press its way out, and every tick after that is it
    // standing there being confused in front of strangers. Gated hard on
    // genuinely stuck — nothing to touch, no way out, and long enough that it
    // is not a mid-load flicker.
    can: (ctx) =>
      // Nothing to press ANYWHERE, not merely no nav: an open viewer covers
      // the sidebar without trapping anything, and backing out of that would
      // be the ghost undoing its own work.
      Object.values(ctx.available).every((count) => count === 0) &&
      ctx.lingerCount === 0 &&
      ctx.moduleDwellMs > 45_000,
    appeal: () => 1,
    mood: "bored",
    perform: async (g) => {
      // Escaping goes through the app's OWN module switch, not history.back()
      // or a goto(). Both of those move the URL without the module system
      // observing it, which leaves the shell rendering nothing until a human
      // clicks a module — a blank app is a worse failure than a stuck ghost.
      // The host injects the seam; nothing in the bag imports feature code.
      if (!escapeHatch) return false;
      await escapeHatch();
      await g.sleep(g.jitter(2000, 1200));
      return true;
    },
  },

  {
    id: "browse-gallery",
    category: "explore",
    thought: "I wonder who else has made stuff.",
    can: (ctx) => has(ctx, "gallery-item") && galleryOpens < GALLERY_OPENS_PER_SESSION,
    appeal: () => 0.4,
    perform: async (g, ctx) => {
      const items = await g.waitFor(safe("gallery-item"), 3000);
      if (!items.length || g.halted()) return false;
      // Looking, not opening — hover a few and move on.
      for (let i = 0; i < 2 + ctx.rng.int(2) && !g.halted(); i++) {
        await g.hoverOn(ctx.rng.pick(items)!, g.jitter(900, 800));
      }
      return true;
    },
  },

  {
    id: "open-someone-elses",
    category: "explore",
    thought: "Let's look at this one properly.",
    can: (ctx) => has(ctx, "gallery-item") && galleryOpens < GALLERY_OPENS_PER_SESSION,
    appeal: () => 0.45,
    mood: "delighted",
    perform: async (g) => {
      if (!(await browseKind(g, "gallery-item", 3000))) return false;
      galleryOpens++;
      await g.sleep(g.jitter(1600, 1000));
      await watchKind(g, "stage", g.jitter(3200, 2000), 4000);
      return true;
    },
  },
];

/** Test seam: the per-session caps are module state by design. */
export function __resetExploreSessionState(): void {
  galleryOpens = 0;
  askedAbout.clear();
  escapeHatch = null;
}
