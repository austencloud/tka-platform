#!/usr/bin/env python
"""Lift the Level-2 "Turns" teaching artwork straight from the source artboards.

The Level-2 turn-lesson pages (TurnsPage, TwoTurnsShiftsPage,
TwoTurnsDashStaticPage) render each teaching frame's red staff+arrow drawing
exactly as Austen drew it in the guide PDF, rather than approximating the
end-direction arrows with the app's motion-arrow glyphs. This script does the
lift: it reads the red vector drawings from the proof PDF, calibrates each
frame's PDF space onto the pictograph 950 viewBox using that frame's diamond
hand-point dots, transforms the paths, and writes the typed data module the
pages import.

  Input : static/guides/_proof/level-2-v05.pdf  (pages 2 / 22 / 23, 0-indexed)
  Output: src/routes/(public)/guide/level-2/_data/lifted-turn-arrows.ts

Run from the repo root:

  py scripts/lift-turn-arrows.py        (Windows launcher)
  python scripts/lift-turn-arrows.py

Requires PyMuPDF (`pip install pymupdf`). The proof PDF is byte-identical to
D:/_THE KINETIC ALPHABET/_GUIDE/exports/level-2.pdf; keep them in sync if the
artboards change, then re-run this to regenerate the data.

Pages / strips (each strip is one teaching row, frames left->right =
start -> intermediate poses -> end -> combined):
  p2  : s0 pro 1-turn (4)     s1 anti 1-turn (4)
  p22 : s0 pro halves (4)     s1 anti thirds (5)   s2 anti halves (4)
  p23 : s0 dash quarters (6)  s1 dash halves (4)   s2 static halves (4)
"""

import math
import os
import statistics

import fitz  # PyMuPDF

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(REPO, "static", "guides", "_proof", "level-2-v05.pdf")
DEST = os.path.join(
    REPO, "src", "routes", "(public)", "guide", "level-2", "_data", "lifted-turn-arrows.ts"
)
PAGES = (2, 22, 23)

# viewBox center + the canonical center->hand-point distance (grid-coordinates.ts:
# n/e/s/w hand points at 331.9/618.1, i.e. 143.1 from center 475).
VB_C = 475.0
HAND_R = 143.1


def is_red(d):
    for key in ("fill", "color"):
        c = d.get(key)
        if c and c[0] > 0.6 and c[1] < 0.4 and c[2] < 0.4:
            return True
    return False


def is_darkdot(d):
    c = d.get("fill")
    r = d["rect"]
    return (
        c
        and c[0] < 0.3
        and c[1] < 0.3
        and c[2] < 0.3
        and 5.0 <= r.width <= 7.5
        and 5.0 <= r.height <= 7.5
    )


def dot_center(d):
    r = d["rect"]
    return ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)


def frame_center(dots):
    """Robust center = (median x, median y). The diamond is symmetric, so the
    median lands on the true center even if a cardinal dot is missing/extra."""
    return (statistics.median([d[0] for d in dots]), statistics.median([d[1] for d in dots]))


def strip_scale(frame_dots_list):
    """One viewBox-per-pt scale shared across a strip, from the inner ring of
    dots (the hand points at radius HAND_R). Per-frame E/W pairing is fragile on
    the irregular thirds poses, so measure the ring globally and share it."""
    dists = []
    for dots in frame_dots_list:
        cx, cy = frame_center(dots)
        for x, y in dots:
            r = math.hypot(x - cx, y - cy)
            if r > 4:  # skip the center dot
                dists.append(r)
    if not dists:
        return None
    dmin = min(dists)
    inner = [r for r in dists if r < dmin * 1.5]  # hand ring only (drop outer points)
    return HAND_R / statistics.median(inner)


def tp(pt, cal):
    cx, cy, s = cal
    return (VB_C + (pt.x - cx) * s, VB_C + (pt.y - cy) * s)


def _f(p):
    return f"{p[0]:.2f} {p[1]:.2f}"


def to_vb_d(d, cal):
    """PDF drawing -> SVG path `d` in the 950 viewBox. Emits `M` only at subpath
    starts (a gap between segments), so filled shapes stay filled instead of
    degrading to thin outlines."""
    parts = []
    cur = None
    started = False

    def start(pt):
        nonlocal cur, started
        parts.append(f"M{_f(pt)}")
        cur = pt
        started = True

    def close():
        nonlocal started
        if started:
            parts.append("Z")
            started = False

    for it in d["items"]:
        op = it[0]
        if op == "l":
            a, b = tp(it[1], cal), tp(it[2], cal)
            if cur is None or abs(cur[0] - a[0]) > 0.05 or abs(cur[1] - a[1]) > 0.05:
                close()
                start(a)
            parts.append(f"L{_f(b)}")
            cur = b
        elif op == "c":
            a, b, c, e = tp(it[1], cal), tp(it[2], cal), tp(it[3], cal), tp(it[4], cal)
            if cur is None or abs(cur[0] - a[0]) > 0.05 or abs(cur[1] - a[1]) > 0.05:
                close()
                start(a)
            parts.append(f"C{_f(b)} {_f(c)} {_f(e)}")
            cur = e
        elif op == "re":
            r = it[1]
            p0 = tp(fitz.Point(r.x0, r.y0), cal)
            p1 = tp(fitz.Point(r.x1, r.y0), cal)
            p2 = tp(fitz.Point(r.x1, r.y1), cal)
            p3 = tp(fitz.Point(r.x0, r.y1), cal)
            close()
            parts.append(f"M{_f(p0)}L{_f(p1)}L{_f(p2)}L{_f(p3)}Z")
            cur = None
        elif op == "qu":
            q = it[1]
            pts = [tp(q.ul, cal), tp(q.ur, cal), tp(q.lr, cal), tp(q.ll, cal)]
            close()
            parts.append("M" + "L".join(_f(p) for p in pts) + "Z")
            cur = None
    close()
    return "".join(parts)


def cluster(vals, key, gap):
    """Gap-based clustering (used for y-axis strip separation)."""
    vals = sorted(vals, key=key)
    out, cur, last = [], [], None
    for v in vals:
        k = key(v)
        if last is not None and k - last > gap:
            out.append(cur)
            cur = []
        cur.append(v)
        last = k
    if cur:
        out.append(cur)
    return out


def span_cluster(vals, key, span=85):
    """Frame clustering by span: a frame is a run whose key stays within `span`
    of the run's first member. Robust when adjacent frames are packed closer than
    a frame's own internal E/W dot spread (the dash-quarters case)."""
    vals = sorted(vals, key=key)
    out, cur, start = [], [], None
    for v in vals:
        k = key(v)
        if start is not None and k - start > span:
            out.append(cur)
            cur = []
            start = None
        if start is None:
            start = k
        cur.append(v)
    if cur:
        out.append(cur)
    return out


def process_page(doc, page_idx, y_min=110):
    page = doc[page_idx]
    dr = page.get_drawings()
    dots = [dot_center(d) for d in dr if is_darkdot(d) and d["rect"].y0 > y_min]
    reds = [d for d in dr if is_red(d) and d["rect"].y0 > y_min]
    strips = cluster(dots, key=lambda p: p[1], gap=60)
    res = {}
    si = 0
    for strip_dots in strips:
        frames = span_cluster(strip_dots, key=lambda p: p[0], span=85)
        frames = [f for f in frames if len(f) >= 4]
        if len(frames) < 3:
            continue
        sc = strip_scale(frames)
        if not sc:
            continue
        # Constrain reds to this strip's Y band. Frames are separated horizontally
        # (x), but strips share x-columns vertically — without a Y gate a red from
        # another strip whose center-x lands in a frame's column leaks in and gets
        # this strip's (wrong) calibration, producing off-canvas garbage paths.
        # Margin 50pt covers an arrow reaching the outer point (~75pt viewBox ≈
        # 19pt... up to ~40pt past the hand ring) while excluding the next strip
        # (dot clusters are 60pt+ apart).
        ys = [p[1] for p in strip_dots]
        sy0, sy1 = min(ys) - 50, max(ys) + 50
        for fi, fdots in enumerate(frames):
            fc = frame_center(fdots)
            cal = (fc[0], fc[1], sc)
            xs = [p[0] for p in fdots]
            fx0, fx1 = min(xs) - 22, max(xs) + 22
            freds = [
                d
                for d in reds
                if fx0 < (d["rect"].x0 + d["rect"].x1) / 2 < fx1
                and sy0 < (d["rect"].y0 + d["rect"].y1) / 2 < sy1
            ]
            if not freds:
                continue
            res[f"p{page_idx}_s{si}_f{fi}"] = [
                {"d": to_vb_d(d, cal), "eo": bool(d.get("even_odd"))} for d in freds
            ]
        si += 1
    return res


def emit_ts(frames):
    L = []
    L.append("/**")
    L.append(' * Level 2 "Turns" pedagogy artwork, lifted vector-exact from the source')
    L.append(" * artboards (static/guides/_proof/level-2-v05.pdf, pages 2/22/23).")
    L.append(" *")
    L.append(" * Each teaching frame (start -> halfway/thirds/quarters -> end = combined) is")
    L.append(" * the red staff+arrow drawing exactly as Austen drew it, transformed into the")
    L.append(" * pictograph 950 viewBox by calibrating on the frame's diamond hand-point dots")
    L.append(" * (n/e/s/w at 331.9/618.1). Rendered over LiftedTurnFrame's minimal grid so the")
    L.append(" * arrows land on the real grid. These are the CANONICAL end-direction arrows")
    L.append(" * (pro curl, anti zig-zag, dash bow, static loop) — do not substitute the app")
    L.append(" * motion-arrow assets, whose shapes differ.")
    L.append(" *")
    L.append(" * Regenerate with `py scripts/lift-turn-arrows.py`. Keys: p<page>_s<strip>_f<frame>.")
    L.append(" * Frame order within a strip = left->right (start, intermediate poses, end, combined).")
    L.append(" */")
    L.append("")
    L.append(
        "/** One filled subpath of a lifted frame (viewBox 0 0 950 950), with its winding rule. */"
    )
    L.append("export type LiftedPath = { d: string; eo: boolean };")
    L.append("")
    L.append("export const LIFTED_TURN_FRAMES: Record<string, LiftedPath[]> = {")
    for k in sorted(frames.keys()):
        items = ", ".join(
            '{ d: "%s", eo: %s }' % (p["d"], "true" if p["eo"] else "false") for p in frames[k]
        )
        L.append(f'  "{k}": [{items}],')
    L.append("};")
    L.append("")
    L.append("/** Red used for the lifted arrows/staves (matches the source artboards). */")
    L.append('export const LIFTED_ARROW_RED = "#DC2626";')
    L.append("")
    return "\n".join(L)


def main():
    doc = fitz.open(PDF)
    frames = {}
    for pg in PAGES:
        frames.update(process_page(doc, pg))
    with open(DEST, "w", encoding="utf-8") as f:
        f.write(emit_ts(frames))
    print(f"wrote {DEST} — {len(frames)} frames from pages {PAGES}")


if __name__ == "__main__":
    main()
