# Formation Presets Research

Research on existing stage formation/blocking systems for placing 1-8 performers aesthetically on a circular stage.

## Curated Aesthetic Sources

### Varsity NDA Formation PDFs
Professionally tested formations used in national cheerleading/dance competitions. Dot positions on a stage grid, judge-validated for visual appeal.
- Formation Key: https://varsity.com/nda/wp-content/uploads/2024/01/Formation-Key.pdf
- 2021 Team Dance Formations: https://varsity.com/nda/wp-content/uploads/2021/05/2021-NDA-Team-Dance-Formations.pdf

### CheerPlace
Exhaustive ASCII dot diagrams broken out by group size (5, 6, 7, 8, up to 25+).
- https://cheerplace.tripod.com/formations/

### Dance Insight
Focuses on "awkward numbers" (odd group sizes). Key insight: "the eye likes to see groups of odd numbers" and "numbers divisible by multiple factors offer more options."
- https://dance-insight.com/formation-ideas/

### RockStar Academy
Formation types by name with descriptions: diamond, V-shape, wave/zig-zag, compact triangle, curved.
- https://rockstaracademy.com/blog/cheerleading-formations

---

## Game Dev Formation Repos (Algorithmic)

### CodeSquirl FormationsTool
Visual formation editor that exports to JSON. Built for Unreal but the output is engine-agnostic. Companion FormationSystem plugin handles runtime.
- https://github.com/codesquirl/FormationsTool

### Goodgulf281/Unity-Formation-Movement
Uses `FormationGridPoint` with (x,z) offsets from grid center. Units auto-assigned to grid points. Almost exactly our data model.
- https://github.com/Goodgulf281/Unity-Formation-Movement2.0

### EezehDev/AI-Formations
Unity C# research project with parameterized formation types (circle, wedge, arc, box) defined as ScriptableObjects. Scales with unit count.
- https://github.com/EezehDev/AI-Formations

### RTSNavigationLib
C++ library with formation shapes defined as JSON config. Architecture: shapes generate untransformed position arrays, then a "Usher" assigns units. Formation types include Rectangle with pluggable shapes.
- https://github.com/Liech/RTSNavigationLib

---

## Code Reference

### OpenMarch
TypeScript/Electron marching band drill writer (AGPL-3.0). Stores positions as X/Y coordinate pairs in `.fielddots` JSON. Shape-building tools for curves, lines, complex shapes. Being TypeScript, directly readable.
- https://github.com/OpenMarch/OpenMarch

### DanceForm
Open source Android app (Java/Firebase). Interactive 2D stage with draggable circle markers on a grid. Stores dancer positions as coordinates per slide/frame.
- https://github.com/anjalis-ingh/DanceForm

---

## Academic

### Fekete Points
Mathematically optimal "spread out evenly" positions on a surface. For 2-8 points on a circle, converges to regular polygons (equilateral triangle for 3, square for 4, pentagon for 5, etc.). Good baseline for a "maximally spread" preset.
- https://arxiv.org/pdf/1606.08203

### Andrew TC Formation Thesis
Formation shape as a function of N (performer count) rather than a fixed layout. Covers how formation shapes auto-determine based on unit count.
- https://andrewtc.dev/thesis/

### Dynamic Formations in RTS Games (Heijden, Bakkes, Spronck, 2008)
Defines formations as grids of lines with configurable unit spacing. Formalizes formation shape as "lines placed behind each other, each line consisting of a fixed number of units."
- https://sander.landofsand.com/publications/CIG08Heijden.pdf

### Building a RTS Formation System (Vlad-Luca Matei, 2026)
Covers Hungarian algorithm for optimal slot assignment and distance-minimizing heuristic for assigning units to formation slots without cross-pathing.

---

## Formations to Add

Shapes that appeared repeatedly across all sources but are missing from our current presets:

| Formation | Description | Source |
|---|---|---|
| **Arc / Semi-circle** | Partial circle facing audience | Very common in dance/cheer |
| **Triangle / Pyramid** | 1 front, 2 mid, 3 back (distinct from V-shape — filled, not hollow) | Cheerleading catalogs |
| **Diamond** | 4 cardinal positions (distinct from grid-2x2) | Game dev + dance |
| **Staggered rows** | Two offset lines (checkerboard pattern) | Common cheerleading pattern |

## Pruning Candidates

- `line` vs `side-by-side` are nearly identical (2.0m vs 1.8m spacing) — consider merging
- `solo` is trivially a single centered dot — may not need its own preset
- `back-to-back`, `facing-each-other`, `stage-lr` are all 2-performer-only — consider whether all three are needed or if one general "duo" preset with facing options would be better

## Algorithm Reference

| Formation | Algorithm |
|---|---|
| Circle | `x = R * cos(2pi * i/N)`, `z = R * sin(2pi * i/N)` |
| Line | Linear interpolation along X axis |
| V-shape / Wedge | Leader at front, staggered pairs behind at widening angle |
| Diamond | 4-point cardinal positions + center fill |
| Triangle | Row-based: row 0 = 1, row 1 = 2, row 2 = 3... |
| Staggered rows | Two lines offset by half-spacing |
| Arc | Circle formula with restricted angle range (e.g., 180 degrees) |
| Scattered | Fekete points with optional jitter |
