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
 * The measurement MUST be invariant to the zone height it feeds, and reading the
 * rendered boxes is not. A grid track written `minmax(a, b)` is maximised into
 * whatever free space its container has before `align-content` ever runs, so a
 * value list inside the stage is exactly as tall as the stage lets it be — and
 * the stage's basis is this measurement. Every allocation is then a fixed point
 * and the one you land on is whichever screen you arrived from. Austen,
 * 2026-08-05: "sometimes you can go to LOOPs and it's all spelling out an
 * incorrect way like this, as a result of whatever was selected before."
 *
 * So a grid block is measured from quantities the allocation cannot move: how
 * many ROWS its items occupy (row assignment follows the column count, not the
 * height) and the track's own ceiling. Anything else falls back to its content
 * height. The result is the same number no matter which screen was open before.
 */

/** `minmax(<anything>, 224px)` → 224. The ceiling is what a row is owed. */
const TRACK_CEILING = /minmax\([^,]+,\s*([\d.]+)px\s*\)/;

/**
 * What one block of a screen is owed, measured independently of the height it
 * currently has.
 */
function blockNeed(block: HTMLElement): number {
  const style = getComputedStyle(block);
  if (style.display === "grid" || style.display === "inline-grid") {
    const ceiling = TRACK_CEILING.exec(style.gridAutoRows);
    if (ceiling) {
      const cap = Number.parseFloat(ceiling[1]);
      // Group items by grid row. Which row an item lands in depends on the
      // column count and its span — never on how tall the rows turned out.
      const rows = new Map<number, number>();
      for (const item of block.children) {
        const box = item.getBoundingClientRect();
        if (box.height <= 0) continue;
        const key = Math.round(box.top);
        const content = (item as HTMLElement).scrollHeight;
        rows.set(key, Math.max(rows.get(key) ?? 0, content));
      }
      if (rows.size > 0) {
        const gap = Number.parseFloat(style.rowGap) || 0;
        let total = (rows.size - 1) * gap;
        // A row that cannot fit inside the ceiling keeps its own content
        // height; every other row is owed the ceiling exactly.
        for (const content of rows.values()) total += Math.max(cap, content);
        return total;
      }
    }
  }
  const box = block.getBoundingClientRect();
  return Math.max(box.height, block.scrollHeight);
}

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
      if (child.getBoundingClientRect().height <= 0) continue;
      need += blockNeed(child as HTMLElement);
      blocks += 1;
    }
    if (blocks === 0) {
      node.style.removeProperty("--editor-need");
      return;
    }
    need += (blocks - 1) * (Number.parseFloat(style.rowGap) || 0);
    // The value is consumed as the STAGE's flex-basis, and the stage is
    // border-box with its own panel padding. Without adding it back the last
    // row loses exactly that much and gets clipped along its bottom edge.
    const stage = screen.closest<HTMLElement>(".drill-editor-stage");
    if (stage) {
      const box = getComputedStyle(stage);
      need +=
        (Number.parseFloat(box.paddingTop) || 0) +
        (Number.parseFloat(box.paddingBottom) || 0) +
        (Number.parseFloat(box.borderTopWidth) || 0) +
        (Number.parseFloat(box.borderBottomWidth) || 0);
    }
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
