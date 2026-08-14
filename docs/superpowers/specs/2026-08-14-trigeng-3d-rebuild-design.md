# Trigeng 3D Rebuild Design

## Goal

Replace the current Trigeng fallback, which renders the two-lobed procedural
Buugeng, with a production GLB that preserves the three-arm TKA silhouette and
behaves like a manufactured hand-manipulation prop.

## Ground truth

- The canonical silhouette is `static/images/props/trigeng.svg`: three broad,
  clockwise-curving arms that meet at one compact center.
- The Flow Arts MCP pictograph render confirms that each hand carries one
  complete Trigeng and that the full silhouette takes the hand color.
- The prop domain classifies Trigeng with small bilateral props and the Buugeng
  family. Its runtime origin therefore belongs at the visual center, where the
  hand can control the prop directly.
- Public results for the exact Trigeng name are sparse. Contemporary Buugeng
  products consistently emphasize lightweight, impact-resistant construction,
  rounded edges, balance, and direct hand or finger manipulation. References:
  [Flowtoys Flowgeng](https://flowtoys.com/products/flowgeng-3d-printed),
  [NeoFlowArt LED Buugeng](https://neoflowart.com/led-buugeng-fx/), and
  [Lighttoys Buugeng overview](https://www.lighttoys.cz/what-is-poi-staff-buugeng-hoop/).

## Form and dimensions

- Use the canonical SVG path directly, not a hand-redrawn approximation.
- Author the prop as a 0.63 m three-arm hollow shell, approximately 30 mm thick
  across the body with a shallow integral palm bolster at the center.
- Center the exact SVG bounds at local `0,0,0`. One arm points generally toward
  local `+Y`; the entire threefold silhouette lies in the local XY plane before
  the proven scene-3d export-basis transform.
- Crown both broad faces, keep the center as one continuous structural junction,
  and taper the outer hooks without changing the canonical face silhouette.
- The outer edge is continuously rounded and has no sharp or fragile tip.
- Build the grip into the shell thickness. Do not add a sleeve, axle, bearing,
  triangular plate, circular spinner hub, or applied finger hardware.

## Materials

- `TKA_Trigeng_Recolor`: the complete crowned shell. This is the only runtime
  recolor target and must remain bright enough for the black stage.
- `TKA_Trigeng_ShellSeam`: a restrained dark molding seam around the perimeter.

The object should read as one lightweight molded polymer shell, not stacked
signage, painted wood, chrome, or a soft tube.

## Runtime contract

- Root node: `TKA_Trigeng`
- Grip marker: `TKA_Hand_Pivot` at `0,0,0`
- Root metadata: prop type, authored span, origin, local primary axis, canonical
  source, and recolor material.
- Registry URL: `/models/props/trigeng.glb`
- Registry scale: `1`
- Grip offset: `0`
- Export contains no camera, lights, animation, or QA-only geometry.

## Verification

1. Run the structural GLB verifier for bounds, pivot, material names, normals,
   UVs, scene count, and mesh budgets.
2. Add a registry regression test that proves Trigeng resolves to its own GLB
   rather than the procedural Buugeng fallback.
3. Inspect front, three-quarter, profile, and rear proof renders.
4. Use the production 3D viewer with red and blue hands through generated
   16-count rotated LOOPs. Confirm grip alignment, scale, recoloring, silhouette,
   and loop turnover.
5. Sweep the seven required desktop, 4K, tablet, landscape-phone, and phone
   viewports.
6. Give the proof and live views to an independent visual reviewer. Apply the
   suggestions that improve manipulation, silhouette, or material credibility,
   then repeat the focused verification.
