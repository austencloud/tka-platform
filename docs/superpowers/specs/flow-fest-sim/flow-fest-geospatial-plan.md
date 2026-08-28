# Flow Fest Sim geospatial planning foundation

Status: implemented foundation. This plan governs the 2D campground diagram,
the gameplay minimap, and any later road- or entrance-driven 3D placement.

## Decision

Use the Ohio Department of Transportation TIMS Road Inventory as the road
centerline authority, clipped into the existing EPSG:26916 terrain frame. Use
the registered 2023 USDA/USGS NAIP orthophoto only to interpret internal camp
drives. Keep Austen's two path traces as their own evidence class. Festival
zones remain proposed placements until field evidence refines them.

The first official feature is Camden College Corner Road, ODOT Road Inventory
`OBJECTID 3019609`, network linear feature `CPRECR00024**C`. ODOT describes the
layer as the state's official source for the roadway networks it maintains or
tracks, and the service supports JSON, GeoJSON, and PBF. Source:
<https://tims.dot.state.oh.us/ags/rest/services/Roadway_Information/Road_Inventory/FeatureServer/0>.

## Why this source

- ODOT is the strongest available authority for the public road that anchors
  the campground. Its ArcGIS service can return the source geometry directly
  in NAD83 / UTM zone 16N, matching the terrain's EPSG:26916 frame and avoiding
  a second runtime coordinate system.
- 2025 Census TIGER/Line remains the permissive public-domain fallback, but it
  is a nationwide cartographic network rather than Ohio's certified roadway
  inventory. It is not needed while the ODOT feature is available. Source:
  <https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html>.
- OpenStreetMap is useful for broad context but is community-authored, not the
  road authority, and its ODbL attribution/share-alike obligations would add a
  second data-license regime. It is not used in this slice. Source:
  <https://www.openstreetmap.org/copyright>.
- Google Maps imagery and place-page geometry are not imported. The project
  continues to use its already source-locked public-domain NAIP orthophoto.

## Licensing and provenance

The ODOT layer declares `ODOT Office of Technical Services` as its copyright
text. The repository therefore stores only a small clipped derivative needed
for this site and retains agency, dataset, service URL, feature ID, network ID,
CRS, retrieval date, and transformation note beside the coordinates. Any
public release must preserve that attribution and must not claim ODOT warrants
camp entrance, private-drive, or festival-placement accuracy.

The authoritative metadata and clipped line live in
`src/routes/test/flow-fest-sim/flow-fest-camp-plan.ts`. Runtime code never makes
an ArcGIS request.

## Shared 2D plan contract

`createFlowFestCampPlan()` produces four visibly distinct evidence layers:

1. `official-road-inventory`: the ODOT public centerline;
2. `imagery-interpreted`: internal vehicle drives already registered from the
   public-domain orthophoto;
3. `austen-traced`: the two canopy-hidden walking connectors Austen drew over
   that orthophoto; and
4. `festival-placement`: camps, parking, check-in, and activity zones that are
   useful for simulation but are not surveyed geography.

The gameplay minimap projects those layers directly. Future 3D road meshes,
entrance dressing, vegetation exclusions, navigation splines, and a standalone
planning editor must consume the same plan instead of copying coordinates.

## Entrance registration

The public-road line still does not establish a private driveway by itself.
The west-side entrance now has the two independent anchors required for
promotion: exact August 2024 Street View panorama metadata at
`39.5904289, -84.7819155`, projected into EPSG:26916 and snapped 0.63 metres to
ODOT feature `3019609`; and the identifiable private-drive junction in the
registered 2023 NAIP raster. The colored diagnostic circles from the earlier
reference attempt are rejected evidence and are not consumed by the plan.

This promotes the road junction and inward bearing only. The festival's
check-in location, permanent-structure footprints beyond the visible
gatehouse, and internal traffic details remain provisional until Austen
annotates them or field evidence is captured.

## Next geospatial evidence gate

- Record the check-in position and remaining private circulation with a field
  GPS trace or user-verified orthophoto annotation.
- Review the official road against the terrain edge in the standalone 2D plan
  before moving road-adjacent 3D objects.
- Add a source-class legend to any future planning editor; do not expose those
  provenance details as gameplay HUD clutter.
- Keep every new path or object coordinate attached to one of the four evidence
  classes and its source date.
