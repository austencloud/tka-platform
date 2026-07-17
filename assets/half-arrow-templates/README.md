# Half-Arrow Illustrator Templates

One template per **missing** halved-motion glyph — the orange cells on
[/test/half-movements](https://localhost:5173/test/half-movements). Draw the
arrow in the template, save, run one command, and the glyph is live in the
app with the matrix cell flipped green.

## The loop

1. **Open** a template from this folder in Illustrator (they're plain SVG).
   The white 950×950 stage shows exactly what the app renders for that
   family's canonical seed motion: grid, hand points, and the staff frozen at
   its halfway pose. The dimmed arrow is the current *fallback* art — right
   anchor and stroke weight, wrong arc. The purple crosshair marks the anchor
   point the glyph gets placed and rotated around.
2. **Draw** the halfway arrow for that motion type + turns value, at the
   ghost's stroke weight, positioned against the staff exactly as it should
   render. Draw anywhere on the stage — position is meaningful and preserved.
3. **Outline strokes before saving** (Object → Path → Outline Stroke). The
   runtime recolors arrows by rewriting `fill`, so the final art must be
   filled shapes, not strokes.
4. **Save as SVG** over the same file (File → Save As → SVG works with
   default settings; don't move art into the `REFERENCE__*` groups — those
   are ignored on ingest).
5. **Ingest:**

   ```bash
   npm run half:ingest
   ```

   This normalizes the drawing into the pipeline's glyph-local space (inverse
   anchor/rotation/mirror of the seed motion), writes
   `static/images/arrows/{mt}_half/from_radial/{mt}_half_{turns}.svg`, and
   regenerates `half-asset-manifest.ts` so the resolver and the coverage
   matrix pick it up. Templates you haven't drawn in yet are skipped, so you
   can ingest after every glyph or once at the end — both work.

6. **Verify + tune:** open
   [/test/half-movements](https://localhost:5173/test/half-movements). The
   family should be green. Click it, check all 8 variations (one drawing
   serves every start point and direction via rotation/mirroring), and
   WASD-nudge the placement if needed — nudges autosave as canon.

## Regenerating templates

Templates are captured from the live app (headless Chromium against the dev
server), so they're exact by construction. To rebuild them — e.g. after new
art lands and you want fresh ghosts, or the pipeline's poses change:

```bash
npm run half:templates          # dev server must be running (default https://localhost:5173)
```

Only families **without** real art get a template, so finished glyphs drop
out of this folder's next rebuild. Already-drawn template files are
overwritten — commit or ingest your drawings first.

## Proving the math (no art needed)

```bash
npm run half:ingest -- --selftest
```

Forward-transforms two existing assets (one mirrored seed, one unmirrored)
into template space, ingests them back, and asserts zero geometric drift.
Run it if you ever suspect the normalization and the pipeline disagree.

## What's NOT here

Float **motions**, skewed motions, hash (center-touching dashes), and quarter
fractions are pipeline-blocked, not art holes — no template exists because
`buildHalvedStep` can't represent them yet. (The `fl` templates here are
float **turns** on pro/anti, which are representable.)

## File map

| Piece | Path |
| --- | --- |
| Templates (draw here) | `assets/half-arrow-templates/*.svg` |
| Template builder | `scripts/build-half-arrow-templates.mjs` |
| Ingest + selftest | `scripts/ingest-half-arrows.mjs` |
| Shared seed table (poses, anchors, rotation, mirror) | `scripts/half-arrow-seeds.mjs` |
| Runtime assets (generated) | `static/images/arrows/{mt}_half/from_radial/` |
| Coverage manifest (generated) | `src/lib/shared/pictograph/arrow/rendering/services/half-asset-manifest.ts` |
| Review harness + placement editor | `src/routes/test/half-movements/+page.svelte` |
| Guide-frame extractor (original 6 seeds) | `scripts/extract-half-glyphs.mjs` |
