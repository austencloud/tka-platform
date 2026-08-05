/**
 * The split pane's left column is a height budget shared by two zones: the
 * category catalog on top and the value editor below it. Neither zone may be
 * `height: auto` with the remainder stranded — that is the dead air Austen
 * called out on 2026-08-05 ("go to Grid mode, look at all that empty vertical
 * space ... so maybe it should morph up and down").
 *
 * CSS alone cannot resolve it. The editor's screens live inside a `fill`
 * Crossfade, so their layers are absolutely positioned and contribute no
 * intrinsic height to the column — the stage can never be content-sized. This
 * action measures what the ACTIVE screen occupies with its cards at their
 * per-screen ceiling (`--pane-row-max` in GalleryWorkspace) and publishes it as
 * `--editor-need`, which the column's flex basis consumes. Everything the
 * ceiling leaves over flows to the catalog, whose tiles grow into it.
 *
 * The measurement is invariant to the zone height it feeds: in the pane every
 * block of a screen is content-sized (`flex: 0 1 auto`) and top-aligned, so the
 * union of the blocks is the screen's own height whatever the box around it is
 * doing. Without that there would be a feedback loop between the budget and the
 * thing it measures.
 */

export function heightBudget(node: HTMLElement, _key?: unknown) {
  let frame = 0;
  let settle: ReturnType<typeof setTimeout> | undefined;

  function measure() {
    frame = 0;
    // During a section crossfade both layers are mounted; the incoming screen
    // is the last one, and it is the one the budget must fit.
    const screens = node.querySelectorAll<HTMLElement>(
      ".drill-editor-stage .drill-screen"
    );
    const screen = screens[screens.length - 1];
    if (!screen) {
      node.style.removeProperty("--editor-need");
      return;
    }
    const style = getComputedStyle(screen);
    let need =
      (Number.parseFloat(style.paddingTop) || 0) +
      (Number.parseFloat(style.paddingBottom) || 0);
    let blocks = 0;
    for (const child of screen.children) {
      const box = child.getBoundingClientRect();
      if (box.height <= 0) continue;
      // `scrollHeight`, not just the box: a list too tall for the column is
      // allowed to shrink its box and overflow, and the budget must see the
      // content it wanted rather than the squeeze it got.
      need += Math.max(box.height, (child as HTMLElement).scrollHeight);
      blocks += 1;
    }
    if (blocks === 0) {
      node.style.removeProperty("--editor-need");
      return;
    }
    need += (blocks - 1) * (Number.parseFloat(style.rowGap) || 0);
    node.style.setProperty("--editor-need", `${Math.ceil(need)}px`);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(measure);
  }

  /** Re-measure once the crossfade has settled and the new screen is alone. */
  function scheduleSettled() {
    schedule();
    clearTimeout(settle);
    settle = setTimeout(schedule, 420);
  }

  // Width changes recompose the grids; DOM changes (a rule that adds or drops
  // options inside the open screen) change the row count without one.
  const resize = new ResizeObserver(schedule);
  resize.observe(node);
  const mutations = new MutationObserver(schedule);
  mutations.observe(node, { childList: true, subtree: true });
  scheduleSettled();

  return {
    update() {
      scheduleSettled();
    },
    destroy() {
      resize.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    },
  };
}
