# Deprecated terrain artifact

`hannons-camp-terrain.json` is retained only as the record of the January 2026 prototype. It must not be used for collision, measurement, object placement, or new scene work.

- SHA-256: `e03af18bbabd102c3c6859e6f8ccc872256628f49f31bf5b2f7c23725cf9e649`
- Producer: deleted; the artifact cannot be reproduced from the repository
- Likely source family: Mapbox Terrain-RGB, based on the deleted loader and 0.1 meter quantization; the exact source request and terms were not recorded
- Declared height field: 512 × 512, 274.0–297.600006 meters
- Declared world: 467.5 × 444.0 meters centered at `(0, 0)`
- Stored boundary span: 1126.35 × 415.11 meters centered near `(-260.82, -541.45)`
- Runtime behavior before quarantine: normalized 23.60 meters of relief into 40 world meters
- Resolution warning: only 121 distinct rows and 129 distinct columns were measured in the 512 × 512 field

The replacement is governed by `docs/superpowers/specs/active/2026-08-24-flow-fest-sim-design.md` and `scripts/geospatial/flow-fest-source-lock.json`.
