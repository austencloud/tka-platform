<script lang="ts">
  /**
   * Generic faithful TEXT layer for a manifest page that maps to a page in the
   * original proof PDF. The proof's runs (PROOF_TEXT, keyed by manifest id) are
   * clustered into paragraph GROUPS (proof-grouping.ts) so dev "Illustrator mode"
   * can move + edit a paragraph as one unit:
   *
   *  - Singleton group (1 run) renders and edits exactly as a lone run always did.
   *  - Multi-run group renders its runs at their exact proof coords (faithful, in
   *    and out of edit mode); in edit mode a transparent wrapper is the drag/select
   *    handle. Double-click COLLAPSES the group to one flowed block (detected align
   *    + leading) and enters rich edit. Escape with no change reverts to per-run
   *    (no reflow); committing a change keeps the flowed block.
   *
   * Non-edit output is unchanged until a paragraph is actually edited. Title is NOT
   * rendered here (GuidePage draws it from the manifest). Images/pictographs are NOT
   * here yet - text only. Body font is Cambria (the proof's face) so line spacing
   * matches the extracted coordinates, with Georgia/Times fallback off-Windows.
   */
  import { tick } from "svelte";
  import { PROOF_TEXT } from "../_data/proof-text";
  import { groupRuns, type Group } from "../_data/proof-grouping";
  import {
    guideEdit,
    ptDrag,
    pt,
    editText,
    beginTextEdit,
    registerEditSource,
    type Movable,
    type Editable,
  } from "../_data/guide-edit.svelte";

  let { id }: { id: string } = $props();

  const S = 816 / 612; // pt → px (4/3), same as the bespoke pages

  // Runtime group with collapse/anchor state layered on the pure grouping result.
  type G = Group & { collapsed: boolean; justCollapsed: boolean; ax: number; ay: number };

  // Deep-copy the runs so ?edit drags never mutate the shared PROOF_TEXT data.
  let groups = $state<G[]>(
    groupRuns((PROOF_TEXT[id] ?? []).map((r) => ({ ...r })), id).map((g) => ({
      ...g,
      collapsed: false,
      justCollapsed: false,
      ax: g.anchorX,
      ay: g.y0,
    }))
  );

  // Stable Movable/Editable per group id (closures read the reactive proxy).
  const mvCache = new Map<string, Movable>();
  const edCache = new Map<string, Editable>();

  function mv(g: G): Movable {
    const hit = mvCache.get(g.id);
    if (hit) return hit;
    const m: Movable = g.multi
      ? {
          id: g.id,
          label: "paragraph",
          apply: (dx, dy) => {
            if (g.collapsed) {
              g.ax += dx;
              g.ay += dy;
            } else for (const r of g.runs) {
              r.x += dx;
              r.y += dy;
            }
          },
          snapshot: () => (g.collapsed ? [g.ax, g.ay] : g.runs.flatMap((r) => [r.x, r.y])),
          restore: (s) => {
            if (s.length === 2) {
              g.ax = s[0]!;
              g.ay = s[1]!;
            } else for (let i = 0; i < g.runs.length; i++) {
              g.runs[i]!.x = s[2 * i]!;
              g.runs[i]!.y = s[2 * i + 1]!;
            }
          },
        }
      : pt(g.id, "text", g.runs[0]!);
    mvCache.set(g.id, m);
    return m;
  }

  function ed(g: G): Editable {
    const hit = edCache.get(g.id);
    if (hit) return hit;
    const e: Editable = g.multi
      ? {
          id: g.id,
          label: "paragraph",
          get: () => g.html,
          set: (h) => (g.html = h),
          onCommit: (changed) => {
            // Peeked without a change → revert to the faithful per-run render.
            if (!changed && g.justCollapsed) g.collapsed = false;
            g.justCollapsed = false;
          },
        }
      : {
          id: g.id,
          label: g.runs[0]!.t,
          get: () => g.runs[0]!.t,
          set: (v) => (g.runs[0]!.t = v),
          plain: true,
        };
    edCache.set(g.id, e);
    return e;
  }

  /** bbox of a multi-run group in px (reads runs → follows a group drag). */
  function bbox(g: G) {
    const x = Math.min(...g.runs.map((r) => r.x));
    const y = Math.min(...g.runs.map((r) => r.y));
    const right = Math.max(...g.runs.map((r) => r.x + r.w));
    const bottom = Math.max(...g.runs.map((r) => r.y)) + Math.max(...g.runs.map((r) => r.fs));
    return { x: x * S, y: y * S, w: (right - x) * S, h: (bottom - y) * S };
  }

  /** Collapse to a flowed block (anchoring from current, possibly-dragged coords) and edit. */
  async function editGroup(g: G) {
    if (!guideEdit.on) return;
    if (!g.collapsed) {
      const x0 = Math.min(...g.runs.map((r) => r.x));
      const right = Math.max(...g.runs.map((r) => r.x + r.w));
      g.ay = Math.min(...g.runs.map((r) => r.y));
      g.ax = g.align === "center" ? (x0 + right) / 2 : x0;
      g.justCollapsed = true;
      g.collapsed = true;
      await tick();
    } else {
      g.justCollapsed = false;
    }
    beginTextEdit(g.id);
  }

  /** Double-click handler as an action so it doesn't trip a11y lint (no on:dblclick). */
  function onDbl(node: HTMLElement, handler: () => void) {
    const h = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      handler();
    };
    node.addEventListener("dblclick", h);
    return { destroy: () => node.removeEventListener("dblclick", h) };
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  $effect(() =>
    registerEditSource(`Proof: ${id}`, () =>
      groups
        .map((g) =>
          g.collapsed
            ? `  [group ${g.id}] align:${g.align} anchorX:${r1(g.ax)} y:${r1(g.ay)} leading:${r1(g.leading)}\n    ${JSON.stringify(g.html)}`
            : g.runs.map((r) => `  ${JSON.stringify(r.t).slice(0, 30)}: x: ${r1(r.x)}, y: ${r1(r.y)}`).join("\n")
        )
        .join("\n")
    )
  );
</script>

<div class="proof-text" class:editing={guideEdit.on}>
  {#each groups as g (g.id)}
    {#if g.collapsed}
      {@const fsPx = g.fs * S}
      <div
        class="para {g.align}"
        class:selected={guideEdit.selectedId === g.id}
        style="left:{g.ax * S}px; top:{g.ay * S - ((g.leading - 1) * fsPx) / 2}px; font-size:{fsPx}px; line-height:{g.leading};"
        use:ptDrag={mv(g)}
        use:editText={ed(g)}
      >{@html g.html}</div>
    {:else if g.multi}
      {@const bb = bbox(g)}
      <div class="group" class:selected={guideEdit.selectedId === g.id} style="left:{bb.x}px; top:{bb.y}px; width:{bb.w}px; height:{bb.h}px;" use:ptDrag={mv(g)} use:onDbl={() => editGroup(g)}>
        {#each g.runs as r (r)}
          <span class="run s-{r.s}" style="left:{(r.x - g.x0) * S}px; top:{(r.y - g.y0) * S}px; width:{r.w * S}px; font-size:{r.fs * S}px">{r.t}</span>
        {/each}
      </div>
    {:else}
      {@const r = g.runs[0]!}
      <span
        class="run singleton s-{r.s}"
        class:edit={guideEdit.on}
        class:selected={guideEdit.selectedId === g.id}
        style="left:{r.x * S}px; top:{r.y * S}px; width:{r.w * S}px; font-size:{r.fs * S}px"
        use:ptDrag={mv(g)}
        use:editText={ed(g)}
      >{r.t}</span>
    {/if}
  {/each}
</div>

<style>
  /* Absolute layer over the whole sheet; proof points map straight to pt×S. */
  .proof-text {
    position: absolute;
    inset: 0;
    color: #141414;
  }
  .run {
    position: absolute;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    line-height: 1;
    white-space: nowrap;
  }
  .s-bold {
    font-weight: 700;
  }
  .s-italic {
    font-style: italic;
  }
  .s-bolditalic {
    font-weight: 700;
    font-style: italic;
  }
  /* f1 (Monotype Corsiva) sub-headings - kept serif per the page-title-only
     script rule; sized by the proof, weighted to read as a heading. */
  .s-heading {
    font-weight: 600;
  }

  /* ── multi-run group: faithful per-run render inside a positioned wrapper ── */
  .group {
    position: absolute;
    pointer-events: none; /* transparent out of edit mode; runs are static text */
  }
  .group .run {
    pointer-events: none; /* the wrapper owns dragging/selection */
  }
  .proof-text.editing .group {
    pointer-events: auto;
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .proof-text.editing .group.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }

  /* ── collapsed paragraph: one flowed, editable block ── */
  .para {
    position: absolute;
    display: inline-block;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    white-space: nowrap;
    color: #141414;
  }
  .para.center {
    transform: translateX(-50%);
    text-align: center;
  }
  .para.left {
    text-align: left;
  }
  .proof-text.editing .para {
    cursor: move;
    outline: 1px dashed rgba(55, 48, 163, 0.4);
  }
  .proof-text.editing .para.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }

  /* ── singleton run: individually draggable/editable (unchanged behavior) ── */
  .run.singleton.edit {
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .run.singleton.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }
</style>
