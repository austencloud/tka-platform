# Moon Observatory Source Asset Package

This package holds cleared source material for the Moon observatory's later art-production gates. It does not select a final site, prescribe a finished room, or replace the current graybox.

## Package boundary

- Tracked manifest: `scripts/moon-source-assets.json`
- Tracked resolved lockfile: `scripts/moon-source-assets.lock.json`
- Tracked fetcher and verifier: `scripts/fetch-moon-source-assets.mjs`
- Ignored source files: `assets/3d-source/moon/`
- Generated local inventory: `assets/3d-source/moon/inventory.json`
- Current runtime material: `static/textures/moon-regolith/`

The source directory is intentionally covered by the repository's existing `/assets/3d-source/` ignore rule. Raw TIFF, GLB, glTF, and texture files must not enter the web bundle. Runtime assets require a separate optimization and visual-approval gate.

## Curated inputs

### Large forms and lunar reference

The NASA CGI Moon Kit supplies an 8K LRO color map and a 16-pixels-per-degree LOLA displacement map. These are appropriate for broad lunar forms, distant terrain, site studies, and globe work. They do not contain enough local detail to carry the floor at visitor scale.

The package also includes NASA's small color Moon GLB and small topographic Moon GLB. Their intended roles are distant geometry, exhibit screens, reference, and previews. The topographic model must not be treated as a walkable production surface without scale and collision work.

Five NASA terrain meshes preserve useful regional forms for later composition studies: Aristarchus, Copernicus, Gassendi, Mount Hadley, and Tycho. These are study meshes, not a decision to reproduce any one site in the exhibit.

### Visitor-scale surface

Poly Haven supplies two regolith-simulant materials and two rock models at 4K:

- Moon Dusted 01: primary close-range ground material
- Moon Meteor 02: crater-marked secondary material
- Moon Rock 01: larger scatter and foreground accent
- Moon Rock 03: smaller scatter and foreground accent

These assets were photoscanned from lunar regolith simulant at Spaceport Rostock. They are useful visual analogues, not scans of material returned from the Moon. Production notes and any public educational text must preserve that distinction.

Each glTF package retains its OpenGL normal map for web and Blender work. A DirectX normal map is stored beside it for UE5. The two ground materials also include EXR displacement maps. Do not import an OpenGL normal into UE5 without converting its green channel.

### Optional exhibit props

The Apollo Lunar Module and Lunar Reconnaissance Orbiter are retained as optional side-display assets. They are not part of the Moon wing's required visual hierarchy. The performer station, choreo card, synchronized screen, sealed glass, and motion lesson remain the exhibit's functional center.

Format validation on 2026-08-12 found no glTF specification errors. Import preparation still needs to address source warnings: Poly Haven packages expect generated tangent space; NASA's two spacecraft GLBs use Draco compression and contain unused authoring data; the small color Moon GLB contains one empty node. These are source cleanup notes, not permission to overwrite the originals.

## Rights and credits

Poly Haven assets are CC0. Attribution is not required, but the manifest preserves the provider and artist credits.

NASA media and 3D model files are generally not subject to copyright in the United States. NASA permits factual use in public exhibits and computer graphical simulations under its media guidelines. The shipped project must acknowledge NASA as the source, avoid any suggestion of NASA endorsement, and keep protected NASA marks out of product branding. No identifiable astronaut or employee imagery is included in this package.

Required production credit draft:

> Lunar imagery, topography, and spacecraft models include source material from NASA and NASA's Scientific Visualization Studio. LRO imagery and LOLA elevation data were used for lunar reference and terrain development. NASA does not endorse this project. Additional lunar-surface analogue assets by Poly Haven, CC0.

Review the wording against the current NASA guidelines before release. Credits attached to individual assets in `scripts/moon-source-assets.json` take precedence over this draft.

## Deliberate exclusions

- `CoryG89/MoonDemo`: code may be studied under MIT, but its principal Moon imagery is described as personal, non-commercial material. Its starfield rights are not established. No binary asset from that repository belongs in this package.
- Cesium Moon: useful for site scouting, but its streaming, attribution, subscription, and offline-use requirements make it unsuitable as a packaged source dependency.
- Poly Haven Moon Lab HDRI: an indoor laboratory capture. It may be used for lighting calibration, not as the exterior sky.
- Marketplace packs: deferred until a production gate proves a specific missing need.

## Reproduce and verify

Run:

```powershell
node scripts/fetch-moon-source-assets.mjs
node scripts/fetch-moon-source-assets.mjs --verify
```

The first command downloads missing files from the tracked lockfile and verifies provider MD5, declared byte length, and SHA-256. It then records MD5 and SHA-256 hashes for every local file. The second command performs the same checks without downloading missing or invalid files. Both commands work without querying the Poly Haven API.

Poly Haven file URLs and provider checksums are resolved from the current Poly Haven API only during an intentional lock refresh. The lockfile records the exact expanded file set and SHA-256 hashes. NASA SVS downloads are pinned to explicit file URLs, byte lengths, and the same SHA-256 lock. NASA 3D Resources downloads are pinned to a repository commit and individual source Git blob revisions in the manifest.

When the curated manifest is intentionally changed, refresh the expanded lock after reviewing the diff:

```powershell
node scripts/fetch-moon-source-assets.mjs --refresh-lock
node scripts/fetch-moon-source-assets.mjs --verify
```

## Production gate when Moon work resumes

1. Review the source inventory and current rights pages.
2. Choose a terrain composition that preserves the sealed-glass performer case and clear hand-path sightlines.
3. Compare the existing generic rock-derived material against the two Poly Haven surface candidates at the same camera and lighting.
4. Build runtime derivatives outside this source package. Record each derivative's source asset IDs, scale, channel packing, compression, and transformations.
5. Verify the chosen material at visitor height, across the exhibit sightline, and under the approved lunar lighting before replacing `static/textures/moon-regolith/` or importing into UE5.

The Moon package is an asset shelf, not an approved scene composition.
