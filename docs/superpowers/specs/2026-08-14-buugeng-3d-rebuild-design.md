# Buugeng 3D rebuild

## Target

Replace the placeholder Buugeng with a production GLB that reads correctly in
silhouette, survives close inspection, recolors for both hands, and keeps the
hand pivot at the exact center of the prop.

## Reference contract

- Canonical silhouette: `static/images/props/buugeng.svg`
- Overall length: 0.83 m
- Blade depth: 0.010 m
- Runtime long axis: local `+Y`
- Runtime grip point: local origin `(0, 0, 0)`
- Construction: one continuous S-shaped body with rounded edges and no added
  grip geometry. The center of the blue body is the hand pivot.

The dimensions follow the current wooden Buugeng specifications published by
RD Buugeng. The one-piece body and rounded-edge treatment are also consistent
with current production examples from RD Buugeng and Dubé.

## Asset zones

- `TKA_Body_Recolor`: the entire prop surface

The asset contains one mesh and one material. Grip sleeves, rings, bands, and
separate edge materials are rejected so the selected hand color runs through
the entire prop.

## Delivery and proof

`scripts/build-buugeng-model.py` is the source of truth. It rebuilds the GLB
from the canonical SVG, names every mesh and material, generates UVs, exports
indexed geometry, and can render a studio proof image.

`scripts/verify-buugeng-glb.cjs` rejects broken headers, triangle soup, missing
normals or UVs, leaked QA lights/cameras, incorrect axes or dimensions, missing
material zones, excessive geometry, and a shifted grip origin.

Runtime acceptance requires both blue and red props to load through `Prop3D`,
remain centered in the hand throughout a sequence, and preserve silhouette and
grip readability at desktop and phone viewports.
