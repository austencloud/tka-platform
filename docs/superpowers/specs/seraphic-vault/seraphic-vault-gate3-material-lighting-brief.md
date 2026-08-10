# Seraphic Vault Gate 3 material and lighting brief

**Status:** Ready for Gate 3 review

**Geometry authority:** Gate 2 revision 3

**Visual authority:** `../active/2026-08-09-seraphic-vault-celestial-design.md`

## Target sentence

The sanctuary floats inside a deep cloud sea at white-gold morning, with cool
weathered alabaster holding the performer lane and warm light catching only the
feather edges, floor horizon, and distant sanctuary crowns.

## Material families

| Family | Target | Working palette | Surface behavior |
|---|---|---|---|
| Carved feather stone | Cool pearl-alabaster with chipped edges, hairline cracks, mineral variation, and restrained iridescent seams | `#D8DEE5`, `#BAC6D4`, `#BFDDE6`, `#D9C4ED` | Rough body with narrow warm edge response; never glossy white plastic |
| Performance floor | Pale weathered marble with subtle concentric inlay and a quiet horizon reflection | `#E9E2D7`, `#C7CED8`, `#9EA9B8` | Broad readable plane, soft contact shadow, no mirror finish |
| Cloud light | Dense ivory cumulus with cool blue-gray undersides | `#F6F1E8`, `#DCE2E8`, `#75849B`, `#4F607A` | Soft volume and layered depth; hides platform edges without entering the performer lane |
| Solar focus | One white-gold disc, two fine aureole rings, and restrained radial rays | `#FFF8DC`, `#F2D18A`, `#D99A4D` | Brightest point in every registered view; no second sun or overhead hotspot |
| Distant sanctuaries | The same stone civilization with increasing cool shift and decreasing detail | Near `#D6D8D8` to far `#93A9C0` | Broken Vigil remains most legible; Cloud Crown approaches an abstract silhouette |

## Lighting logic

- The centered disc inside the feather vault is the only sun and the source of
  all warm illumination.
- Warm light catches rib edges, floor cracks near the horizon, and the top edges
  of the four distant sanctuaries.
- The lower third stays cooler and darker so pale props, trails, and interface
  chrome retain contrast.
- Cloud shadows provide depth before added fog. Volumetric rays stay soft and
  never form a second focal point.
- The main sanctuary remains the first read. Broken Vigil and Twin Choir sit
  below it; Eroded Halo sits upper left; Cloud Crown remains highest at upper
  right.

## Runtime ownership

- The optimized environment GLB owns the performance floor and six carved
  feather ribs.
- `CelestialScene.svelte` owns runtime cloud motion, the solar focus, motes,
  fog, quality adaptation, and distant sanctuary assembly.
- `Environment3D.svelte` remains the sole environment selection, transition,
  and stage-alignment owner.
- Gate 3 targets material, light, atmosphere, and hierarchy. It does not alter
  the approved Gate 2 coordinates or camera presets.

## Rejection conditions

- Open blue gaps again dominate the frame.
- The solar focus reads as a plain ball, a duplicated sun, or an overhead light.
- Stone reads as clean plastic, literal animal feathers, or classical columns.
- Any distant sanctuary crosses a feather silhouette or the central performer
  band.
- Gardens, trees, foliage, coral, stars, statues, people, or unrelated ruins
  enter the scene.

## Production translation

The visual targets are paint-overs, not runtime assets. Gate 4 must prove one
representative production slice using the existing Blender and Threlte owners:
one finished feather material, the floor treatment, one dense cloud layer, the
single solar focus, and one distant sanctuary under the approved desktop camera.
