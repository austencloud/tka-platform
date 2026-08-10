# Olive Cloudbreak Gate 1 revision 4

Date: 2026-08-10  
Status: Ready for Austen's visual-comprehension review  
Review route: `https://127.0.0.1:5176/test/celestial-integration?view=assets`

## Decision carried forward

Revision 4 implements tracker decision `YRzymqYQL7NHDnB2SSag`:

- enlarge the rear sanctuary into a massive connected limestone structure;
- strengthen the dry stage read;
- animate and enlarge the lagoon-side waterfall;
- replace the faceted shoreline stones with free licensed scans;
- remove the mismatched loose rock from the water channel; and
- spend Meshy credits only on custom assets that the catalog could not supply.

## Spatial revision

The rear threshold is now a 42 metre wide, 26 metre high sanctuary mass with a
12 metre opening and a 17 metre deep footprint. The worn 5.25 metre path still
runs from the fixed-view foreground to the opening. A 1.75 metre figure remains
beside the opening so the scale is legible without text.

The performance circle is now a shallow raised limestone disc. It remains clear
of both olives and the lagoon, but no longer disappears into the surrounding
shelf. The new sanctuary footprint is represented as one connected mass, with a
dark passage and ceiling rather than a facade cutout.

## Produced assets

### Meshy 6 multi-image

| Asset                | Role                    | Source                       | Optimized result           |
| -------------------- | ----------------------- | ---------------------------- | -------------------------- |
| Ancient Olive West   | Western stage frame     | Four-view ImageGen turntable | 58,680 triangles, 1.77 MiB |
| Windswept Olive East | Lagoon-side stage frame | Four-view ImageGen turntable | 51,939 triangles, 1.66 MiB |

The paid run started at 215 credits, consumed 30 credits per asset, and ended at 155. Task IDs and input hashes are recorded in
`blender/cloudbreak-meshy-image-tasks.json`. The batch cap was 60 credits, so a
retry could not silently create another paid pair.

### CC0 geology

No rocks were generated. The shoreline uses Poly Haven scans under CC0:

| Asset               | Cloudbreak role              | Optimized result                    |
| ------------------- | ---------------------------- | ----------------------------------- |
| Coast Rocks 05      | Long weathered lagoon ledge  | 101,897 triangles, 1.31 MiB         |
| Sand Rocks Small 01 | Broken opposite-bank cluster | 84,735 triangles, 0.92 MiB          |
| Boulder 01          | Occasional bank accent       | Existing optimized repository asset |

The long scans were reduced from 727,930 and 529,663 triangles. Their silhouettes
and surface relief remain readable, but they no longer carry scan-scale geometry
budgets into the runtime scene. Source pages:

- <https://polyhaven.com/a/coast_rocks_05>
- <https://polyhaven.com/a/sand_rocks_small_01>
- <https://polyhaven.com/a/boulder_01>

## Water and light

The lagoon now composes the shared `ReflectivePool` owner for real-time sky and
scene reflection. The production-shell water remains underneath it to preserve
the approved irregular boundary. The review route disables the rectangular
reflector in Plan view so the footprint cannot be mistaken for the lagoon shape.

Four procedural waterfall ribbons replace the static waterfall planes. The
lagoon overflow is larger and brighter than the three distant falls. Two
captures 450 milliseconds apart produced distinct frame hashes, confirming the
scene is advancing rather than presenting a frozen strip.

The camera-centred sun is now 0.68 degrees across with a larger soft halo. It
keeps the no-parallax behavior but no longer reads as a yellow ball placed in
the scene.

## Review evidence

- Registered front: `./seraphic-vault-gate1-cloudbreak-r4-front.png`
- Reverse sanctuary: `./seraphic-vault-gate1-cloudbreak-r4-rear.png`
- Measured plan: `./seraphic-vault-gate1-cloudbreak-r4-plan.png`
- Olive asset bench: `./seraphic-vault-gate1-cloudbreak-r4-trees.png`
- Stone asset bench: `./seraphic-vault-gate1-cloudbreak-r4-stone.png`

The Front camera is fitted to the narrow in-app review pane. It keeps the dry
stage, both olives, the one lagoon, the enlarged overflow, and all four floating
banks visible in the same frame.

## Gate decision requested

Gate 1 revision 4 is ready for comprehension review. It is not approved yet.
The review question is whether the full front-to-back location now reads as one
coherent place: a clear performance terrace, one reflective lagoon, deep floating
geology, and a massive sanctuary behind the fixed camera.
