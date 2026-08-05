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
import type { AttractGhost } from "../services/attract-ghost.svelte";
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

/**
 * The way out of a room with no visible exit, injected by the host so the bag
 * stays free of feature imports. It must perform a REAL module switch (the
 * same one the nav performs), never a URL-only navigation.
 */
let escapeHatch: (() => Promise<void> | void) | null = null;

export function setEscapeHatch(fn: (() => Promise<void> | void) | null): void {
  escapeHatch = fn;
}

/**
 * The last resort when the room has no visible door — an immersive module that
 * hides the sidebar. Goes through the app's OWN module switch, never
 * history.back() or goto(): both move the URL while the module system carries on
 * believing it is elsewhere, and the shell then renders an empty screen until a
 * human clicks a module. A blank app is a worse failure than a stuck ghost.
 * The host injects the seam; nothing in the bag imports feature code.
 */
async function escapeProgrammatically(g: AttractGhost): Promise<boolean> {
  if (!escapeHatch) return false;
  await escapeHatch();
  await g.sleep(g.jitter(2000, 1200));
  return true;
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
    // One control, chosen once: the thought names the button the press lands on.
    target: (ctx) =>
      ctx.rng.pick(
        visibleAll(safe("curio")).filter(
          (el) => !ctx.askedAbout.has(labelOf(el)),
        ),
      ) ?? null,
    thought: (_ctx, target) => {
      const name = target ? labelOf(target) : "";
      return name ? `What does ${name} do?` : "What does this one do?";
    },
    // Only if there is one it has not already asked about — otherwise the
    // thought lies ("What does X do?" about a button it pressed four times).
    can: (ctx) =>
      has(ctx, "curio") &&
      visibleAll(safe("curio")).some((el) => !ctx.askedAbout.has(labelOf(el))),
    appeal: () => 0.5,
    perform: async (g, ctx, target) => {
      if (!target || g.halted()) return false;
      ctx.askedAbout.add(labelOf(target));
      await g.moveAndPress(target);
      // Stay where the hand landed and watch what changed. Gliding away to a
      // corner after every press was the "moves out of the way" tell.
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
    // Pure personality. It presses nothing, so it is always safe — but it is
    // NOT always possible: "that's a lot of buttons" in a room with no buttons
    // is a lie, and an always-true `can` also means the mind can never report
    // "nothing here is satisfiable", which is the signal a trap looks like.
    thought: "…that's a lot of buttons.",
    can: (ctx) => Object.values(ctx.available).some((count) => count > 0),
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
    // The module it names is the module it walks to. It used to name the FIRST
    // unvisited one and then press a random one from the pool.
    target: (ctx) => {
      const unvisited = unvisitedNavButtons(ctx.visitedModules);
      if (unvisited.length) return ctx.rng.pick(unvisited) ?? null;
      const allowed = visibleAll(NAV_MODULE_SEL).filter((el) => {
        const id = el.getAttribute(NAV_MODULE_ID_ATTR);
        return !!id && !isDeniedModule(id);
      });
      return ctx.rng.pick(allowed) ?? null;
    },
    thought: (ctx, target) => {
      const name = target ? labelOf(target) : "";
      if (!name) return "Let's see what else is here.";
      const id = target?.getAttribute(NAV_MODULE_ID_ATTR);
      return id && !ctx.visitedModules.has(id)
        ? `I haven't looked at ${name} yet.`
        : `Back to ${name} for a second.`;
    },
    can: (ctx) => ctx.available["nav-module"] > 0 && ctx.reachableModules.length > 0,
    // Restlessness is what stops the ghost admiring one screen for the whole
    // jam; an unvisited module is worth more than a re-visit.
    appeal: (ctx) =>
      ((unvisitedNavButtons(ctx.visitedModules).length ? 0.55 : 0.25) +
        restlessness(ctx) * 0.45) *
      settled(ctx),
    perform: async (g, _ctx, target) => {
      if (!target || g.halted()) return false;
      await g.moveAndPress(target);
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
    id: "dismiss-blocker",
    category: "reset",
    thought: "Not right now, thanks.",
    // Beats everything while a blocker is up, and it has to: an overlay with a
    // backdrop makes every other control fail the press hit-test, so until it
    // is gone the ghost's whole world reads as empty. On a fresh browser
    // profile the create-tutorial prompt is the FIRST thing on screen, which
    // means an un-dismissable blocker is a presenter that spends the entire jam
    // standing in front of a modal saying "let's go back".
    can: (ctx) => has(ctx, "dismiss"),
    appeal: () => 1,
    mood: "unsure",
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "dismiss", 1500))) return false;
      await g.sleep(g.jitter(900, 600));
      return true;
    },
  },

  {
    id: "leave-viewer",
    category: "explore",
    thought: "Right — what else was there?",
    // The viewer drawer covers the sidebar, so `go-to-module` cannot fire while
    // it is open: without this, a viewer with plenty to do inside it would hold
    // the ghost for the whole jam, and the only exit would be escape-room's
    // 45s-stuck gate. Restlessness makes leaving a decision rather than a
    // timeout — it loses to anything interesting for the first minute or so.
    can: (ctx) => ctx.viewerOpen && has(ctx, "close-overlay"),
    appeal: (ctx) => restlessness(ctx) * 0.5,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "close-overlay", 1500))) return false;
      await g.sleep(g.jitter(1200, 800));
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
      // be the ghost undoing its own work. A close-overlay control does not
      // count as something to do — it IS this intention's way out.
      Object.entries(ctx.available).every(
        ([kind, count]) => count === 0 || kind === "close-overlay",
      ) &&
      ctx.lingerCount === 0 &&
      ctx.moduleDwellMs > 45_000,
    appeal: () => 1,
    mood: "bored",
    perform: async (g, ctx) => {
      // Prefer the room's own door. An overlay (the viewer drawer) sits ABOVE
      // the module, so switching modules underneath it leaves the overlay
      // covering the app and the ghost still trapped — observed live: it
      // escaped to create and stayed stuck behind a viewer showing "animation
      // data not available". Pressing the real close button is also the
      // on-brand move: a viewer sees the app being driven.
      if (has(ctx, "close-overlay")) {
        if (await pressKind(g, ctx, "close-overlay", 1500)) {
          await g.sleep(g.jitter(1200, 800));
          return true;
        }
      }
      return escapeProgrammatically(g);
    },
  },

  {
    id: "browse-gallery",
    category: "explore",
    thought: "I wonder who else has made stuff.",
    can: (ctx) =>
      has(ctx, "gallery-item") &&
      ctx.budgets.galleryOpens < GALLERY_OPENS_PER_SESSION,
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
    can: (ctx) =>
      has(ctx, "gallery-item") &&
      ctx.budgets.galleryOpens < GALLERY_OPENS_PER_SESSION,
    appeal: () => 0.45,
    mood: "delighted",
    perform: async (g, ctx) => {
      if (!(await browseKind(g, "gallery-item", 3000))) return false;
      ctx.budgets.galleryOpens++;
      await g.sleep(g.jitter(1600, 1000));
      await watchKind(g, "stage", g.jitter(3200, 2000), 4000);
      return true;
    },
  },
];

/**
 * Test seam. The only module-level state left here is the escape hatch, which
 * is a host-injected seam rather than session memory — everything a tour
 * remembers now lives in GhostMemory, so it is seeded and it resets with the
 * mind instead of surviving as a hidden global.
 */
export function __resetExploreSessionState(): void {
  escapeHatch = null;
}
