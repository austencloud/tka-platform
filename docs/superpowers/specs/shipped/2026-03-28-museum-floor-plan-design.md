# Museum Floor Plan — Full Skeleton Design

**Date:** 2026-03-28
**Status:** Draft
**Scope:** Rough out the entire Kinetic Archive as one continuous 2D tile grid — every room, corridor, easter egg, and ending — so it can be walked through and iterated on.

---

## Goal

Build a single `MuseumGrid` that contains every room in The Kinetic Archive as a walkable skeleton. Rooms have walls, floors, doors, placeholder exhibits, and thematic floor materials. The content is sparse — just enough to feel the pacing, flow, and scale of the full museum.

This is the "messy skeleton with meat hanging off it" — a bird's-eye view of the whole experience.

---

## Source of Truth

**`docs/museum/story-bible.md` is canon.** The old `museum-layout.md` Wing 1-8 numbering is retired. This floor plan follows the story bible's era-based structure and three-era architecture (Order-built → Crumble → K's museum).

### What's In

| Room | Era | Theme | Purpose |
|------|-----|-------|---------|
| Entrance Lobby | Order | institutional | Guest book, orientation, first Closed Palm hints |
| Vulcan Cave | Order | cave | Ancient origins, awe, OOGA/UG sequences |
| Egyptian Wing | Order | classical | Types formalized, Karnak scrolls, first LOOPs |
| Renaissance Wing | Order | renaissance | Da Vinci, Vitruvian Man, codex pages |
| Victorian Wing | Order | industrial | Brass notation device, patents, "RECALLED" stamps |
| Digital Wing | Order | digital | CRT/Windows 93, BBS printouts, the leak |
| The Suppression | Order | institutional | Order named, Protocol Lethe docs, the reveal |
| The Crumble | Crumble | construction | Half-finished exhibits, filing cabinets left open, the seam |
| K's Gallery | K's museum | gallery | Scribe-built, warm, handmade, K's annotations |
| Room of Fear | K's museum | institutional | Containment, warning, dread |
| Room of Isolation | K's museum | institutional | Cubicles for flow artists, managed aloneness |
| Room of Collaboration | K's museum | outdoor | Real people spinning, birds, trees, warmth |
| Gift Shop | Order (abandoned) | retail | Dusty merchandise, found $20 bill |
| Construction Zone | Crumble | construction | Easter egg — unfinished exhibits, scaffolding |
| Janitor's Closet | meta | construction | Deepest reveal — hot glue guns, whiteboard |
| VTG Wing | Crumble | construction | Roped off, perpetually under renovation |

### What's Out

- **Wing 7 "Vessel Hall"** — Vessels concept retired. Historical Scribes appear distributed throughout eras, not in a dedicated hall.
- **Wing 8 "Austen Wing"** — Austen is meta-only. No self-aggrandizing room. His presence is the recurring face on historical Scribes and the Janitor's Closet whiteboard.
- **Space Age room** — Story bible marks this as an open question. Deferred. The gap between Victorian and Digital IS the exhibit (the Order jumped to software and skipped the hippies — that's a containment joke waiting to happen).
- **Cross-Reference Room** — Interesting but deferred. Can be added later as a side room off K's Gallery.

---

## Grid Layout

### Design Principles

1. **Mostly linear** — the Order controls traffic flow. Main path is one way through.
2. **Snake pattern** — rows zigzag to keep total grid width manageable while feeling like a long journey.
3. **Side branches** — Easter eggs and optional rooms branch off the main path.
4. **Scale varies** — big rooms for important reveals (Cave, Suppression), smaller for transitions.
5. **Corridors tell the story** — stone becomes marble becomes industrial tile becomes linoleum becomes decay.

### Coordinate System

- Origin (0,0) at top-left
- X increases east (right)
- Y increases south (down)
- 1 tile = 0.5m real-world scale
- Player enters from the south and walks north into the museum

### Room Placement

Total grid: **150 tiles wide × 220 tiles tall** (75m × 110m real-world)

The layout reads top-to-bottom, with the player starting at the bottom (south) and progressing north (up the grid, decreasing Y). The snake pattern means the player moves generally northward but zigzags east-west between rows.

```
Y=0  ┌─────────────────────────────────────────────────────────────┐
     │                                                             │
     │    COLLABORATION    GIFT SHOP                               │
     │    (outdoor)        (retail)                                 │
     │         ↑               ↑                                   │
     │    ISOLATION ───── corridor                                 │
     │         ↑                                                   │
     │    FEAR                                                     │
     │         ↑                                                   │
     │    K'S GALLERY (Scribe-built, warm)                         │
     │         ↑                                                   │
     │    THE CRUMBLE (seam, decay corridor)                       │
     │         ↑                                                   │
     │    SUPPRESSION (Order named — the reveal)                   │
     │         ↑                                                   │
     │    DIGITAL WING ←──── VTG WING (roped off)                 │
     │         ↑                                                   │
     │    VICTORIAN WING ──→ CONSTRUCTION ZONE → JANITOR'S CLOSET │
     │         ↑                                                   │
     │    RENAISSANCE WING                                         │
     │         ↑                                                   │
     │    EGYPTIAN WING                                            │
     │         ↑                                                   │
     │    VULCAN CAVE (deep, large)                                │
     │         ↑                                                   │
     │    ENTRANCE LOBBY                                           │
     │         ↑                                                   │
Y=219│    PLAYER SPAWN                                             │
     └─────────────────────────────────────────────────────────────┘
```

### Connectivity Graph (Main Path + Branches)

```
ENTRANCE → Cave → Egyptian → Renaissance → Victorian → Digital → Suppression
                                               ↓                      ↓
                                        Construction Zone         VTG Wing
                                               ↓                (roped off)
                                        Janitor's Closet

Suppression → Crumble (seam) → K's Gallery → Fear → Isolation → Collaboration → Gift Shop → EXIT
```

All arrows are one-way for the main path (player progresses forward), but the player can backtrack freely. Side branches (Construction Zone, Janitor's Closet, VTG Wing) are optional.

### Room Definitions

Each room is defined by its bounding rectangle on the grid, connected to the next room by a corridor. Sizes are in tiles (1 tile = 0.5m).

| Room | Width | Height | Floor Material | Notes |
|------|-------|--------|---------------|-------|
| Entrance Lobby | 24 | 16 | marble | Wide, inviting, institutional signage |
| Vulcan Cave | 30 | 28 | stone | Largest Order room. Irregular edges (cave feel). Torches. |
| Egyptian Wing | 28 | 24 | sandstone | Warm, open hall. Pillar pedestals. |
| Renaissance Wing | 24 | 22 | wood | Studio atmosphere. Warmer than institutional. |
| Victorian Wing | 26 | 24 | marble | Gas lamp feeling. Brass-toned exhibits. |
| Digital Wing | 24 | 20 | stone | CRT glow. Smaller, boxier (office/server room). |
| The Suppression | 30 | 26 | marble | Large — the big reveal needs space. Sterile. |
| The Crumble | 8 | 20 | dirt | Narrow decay corridor. The seam. |
| K's Gallery | 28 | 24 | wood | Warm, handmade feel. Scribe annotations. |
| Room of Fear | 20 | 18 | stone | Containment aesthetic. Cold. |
| Room of Isolation | 30 | 24 | marble | Wide — needs cubicle grid visible. |
| Room of Collaboration | 26 | 22 | dirt | Outdoor feel. No walls on two sides (void = sky). |
| Gift Shop | 22 | 18 | marble | Commercial. Shelf pedestals. |
| Construction Zone | 16 | 14 | dirt | Small, cluttered with scaffolding. |
| Janitor's Closet | 10 | 8 | dirt | Tiny. Single bare bulb (torch). |
| VTG Wing | 18 | 14 | stone | Visible from Digital Wing, blocked by rope tiles. |

**Corridors** between rooms: 4-6 tiles wide, 8-14 tiles long, using `corridor` tile type with material matching the era transition.

### Detailed Placement (Tile Coordinates)

All coordinates are (x, y, width, height) where (x,y) is the top-left corner.
Corridors share their edge tiles with the rooms they connect — no gaps.
The corridor's first/last row of tiles overlaps the room's door tiles.

Working from the bottom (south) up:

```
PLAYER SPAWN: (80, 213)

ENTRANCE LOBBY:
  Position: x=68, y=197, w=24, h=16
  Bounds: x 68-91, y 197-212
  South door: center, 6 tiles wide (player enters here)
  North door: center, 4 tiles wide
  Material: marble
  Exhibits: guest book pedestal near entrance, orientation sign

CORRIDOR (Lobby → Cave): x=78, y=189, w=4, h=9, material=stone
  Bounds: x 78-81, y 189-197
  South edge (y=197) overlaps Lobby north wall. North edge (y=189) overlaps Cave south wall.

VULCAN CAVE:
  Position: x=65, y=161, w=30, h=29
  Bounds: x 65-94, y 161-189
  South door: center, 4 tiles
  North door: east side (x=88-91), 4 tiles (exit toward Egyptian corridor)
  Material: stone
  Exhibits: Lascaux tablets (north wall center), cave painting panels (side walls),
            Dr. Marchand display, prop recreation pedestals
  Torches: 6 total, irregularly placed (cave feel)
  Performers: 2 (caveman clubs demonstration)

CORRIDOR (Cave → Egyptian): material=sandstone
  This is an L-shaped corridor. Two rectangles:
    Vertical leg:   x=88, y=153, w=4, h=9  (bounds x 88-91, y 153-161)
      South edge overlaps Cave north wall at the east door.
    Horizontal leg: x=88, y=153, w=10, h=4  (bounds x 88-97, y 153-156)
      East edge overlaps Egyptian west wall at the west door.
  The two legs share the corner at (88-91, 153-156).

EGYPTIAN WING:
  Position: x=96, y=133, w=28, h=24
  Bounds: x 96-123, y 133-156
  West door: at y=153 area, 4 tiles (from cave corridor)
  South door: center (x=108-111), 4 tiles (leads to Renaissance)
  Material: sandstone
  Exhibits: Karnak scrolls, priesthood diorama, Greek amphora, "Controlled Knowledge"
  Pedestals: 4 pillar-pedestals in two rows

CORRIDOR (Egyptian → Renaissance): x=108, y=156, w=4, h=9, material=sandstone→wood
  Bounds: x 108-111, y 156-164
  North edge overlaps Egyptian south wall. South edge overlaps Renaissance north wall.

RENAISSANCE WING:
  Position: x=96, y=164, w=24, h=22
  Bounds: x 96-119, y 164-185
  North door: center, 4 tiles
  West door: at y=173 area (x=96), 4 tiles (leads to Victorian)
  Material: wood
  Exhibits: Codex pages, Vitruvian Man analysis, workshop diorama, "Notebooks Scattered"

CORRIDOR (Renaissance → Victorian): x=86, y=171, w=11, h=4, material=wood→marble
  Bounds: x 86-96, y 171-174
  East edge overlaps Renaissance west wall. West edge overlaps Victorian east wall.

VICTORIAN WING:
  Position: x=58, y=161, w=29, h=26
  Bounds: x 58-86, y 161-186
  East door: at y=171 area, 4 tiles (from Renaissance corridor)
  North door: west side (x=62-65), 4 tiles (leads to Digital)
  South door: east side (x=82-85), 4 tiles (leads to Construction Zone)
  Material: marble
  Exhibits: Brass notation device, patent documents, inventor portraits, "Discredited"

CORRIDOR (Victorian → Construction Zone): x=82, y=186, w=4, h=9, material=dirt
  Bounds: x 82-85, y 186-194
  North edge overlaps Victorian south wall (east side).
  South edge overlaps Construction Zone north wall.
  (Side branch — easter egg, goes south from Victorian)

CONSTRUCTION ZONE:
  Position: x=74, y=194, w=16, h=14
  Bounds: x 74-89, y 194-207
  North door: 4 tiles (from Victorian corridor)
  East door: small, 2 tiles (leads to Janitor's Closet) — marked "MAINTENANCE"
  Material: dirt
  Objects: scaffolding tiles throughout, sign tiles ("COMING SOON", "STAFF ONLY")
  (Positioned BELOW Victorian, no overlap with Renaissance)

JANITOR'S CLOSET:
  Position: x=89, y=197, w=10, h=8
  Bounds: x 89-98, y 197-204
  West door: 2 tiles (shares east wall of Construction Zone — direct adjacency, no corridor)
  Material: dirt
  Objects: 1 torch (bare bulb), 1 pedestal (desk with dossier),
           exhibit panels (whiteboard, mannequin)

CORRIDOR (Victorian → Digital): x=62, y=153, w=4, h=9, material=stone
  Bounds: x 62-65, y 153-161
  South edge overlaps Victorian north wall (west side).
  North edge overlaps Digital south wall.

DIGITAL WING:
  Position: x=50, y=133, w=24, h=21
  Bounds: x 50-73, y 133-153
  South door: at x=62-65, 4 tiles (from Victorian corridor)
  North door: center (x=60-63), 4 tiles (leads to Suppression)
  West wall: visible opening to VTG Wing (blocked by rope tiles at x=50)
  Material: stone
  Exhibits: The CRT, BBS printouts, "3,400 Users" counter, development team photo

VTG WING (roped off):
  Position: x=30, y=136, w=18, h=14
  Bounds: x 30-47, y 136-149
  East side: rope tiles at x=48-49 blocking entry (2-tile gap between VTG and Digital,
             filled with rope tiles to show it's visible but blocked)
  Material: stone
  Objects: scaffolding throughout, sign ("THE VULCAN WING - UNDER RENOVATION"),
           dust-covered pedestals

CORRIDOR (Digital → Suppression): x=60, y=125, w=4, h=9, material=marble
  Bounds: x 60-63, y 125-133
  South edge overlaps Digital north wall. North edge overlaps Suppression south wall.

THE SUPPRESSION:
  Position: x=46, y=95, w=30, h=31
  Bounds: x 46-75, y 95-125
  South door: center (x=60-63), 4 tiles
  North door: center (x=60-63), 4 tiles (leads to Crumble)
  Material: marble
  Exhibits: "The Order of the Closed Palm" large display, Protocol Lethe docs,
            "You've Seen This Before" interactive, May 8 1994 display
  This is the biggest reveal — needs breathing room.

CORRIDOR (Suppression → Crumble): connected directly (no separate corridor — Crumble IS the corridor)

THE CRUMBLE (The Seam):
  Position: x=58, y=73, w=8, h=23
  Bounds: x 58-65, y 73-95
  South edge: overlaps Suppression north wall (door at x=60-63)
  North edge: overlaps K's Gallery south wall
  Material: dirt
  This is a narrow passage. Filing cabinets (pedestals), water stains,
  collapsed section (wall tiles blocking half the width at one point).
  The player squeezes through institutional death.

K'S GALLERY:
  Position: x=46, y=45, w=28, h=29
  Bounds: x 46-73, y 45-73
  South door: center (x=58-61), 4 tiles (from Crumble)
  North door: center (x=58-61), 4 tiles (leads to Fear)
  Material: wood
  Exhibits: K's own curation — warm, handmade exhibits. Sticky notes as exhibit panels.
            Scribe history told from the inside. Spiral symbol finally prominent.
  Performers: 1 (Scribe demonstrating a sequence)

CORRIDOR (K's Gallery → Fear): x=58, y=37, w=4, h=9, material=stone
  Bounds: x 58-61, y 37-45
  South edge overlaps K's Gallery north wall. North edge overlaps Fear south wall.

ROOM OF FEAR:
  Position: x=50, y=19, w=20, h=19
  Bounds: x 50-69, y 19-37
  South door: center (x=58-61), 4 tiles
  East door: center (y=27-30), 4 tiles (leads to Isolation)
  Material: stone
  Exhibits: Containment warnings, Order symbols everywhere, institutional dread

CORRIDOR (Fear → Isolation): x=69, y=27, w=9, h=4, material=marble
  Bounds: x 69-77, y 27-30
  West edge overlaps Fear east wall. East edge overlaps Isolation west wall.

ROOM OF ISOLATION:
  Position: x=77, y=15, w=30, h=24
  Bounds: x 77-106, y 15-38
  West door: at y=27-30, 4 tiles
  East door: center (y=25-28), 4 tiles (leads to Collaboration)
  Material: marble
  Layout: Grid of cubicle walls (wall tiles creating 3x4 individual cells).
          Performer stations inside cubicles (spinners alone).
          Player walks the aisles between cubicles.

CORRIDOR (Isolation → Collaboration): x=106, y=25, w=9, h=4, material=dirt
  Bounds: x 106-114, y 25-28
  West edge overlaps Isolation east wall. East edge overlaps Collaboration west wall.

ROOM OF COLLABORATION:
  Position: x=114, y=10, w=26, h=22
  Bounds: x 114-139, y 10-31
  West door: at y=25-28, 4 tiles
  South door: center (x=125-128), 4 tiles (leads to Gift Shop)
  Material: dirt (outdoor ground)
  Design: No north or east walls (void = open sky).
          Performers scattered (multiple, playing together).
          No torches — natural light feel.

CORRIDOR (Collaboration → Gift Shop): x=125, y=31, w=4, h=9, material=marble
  Bounds: x 125-128, y 31-39
  North edge overlaps Collaboration south wall. South edge overlaps Gift Shop north wall.

GIFT SHOP:
  Position: x=116, y=39, w=22, h=18
  Bounds: x 116-137, y 39-56
  North door: center (x=125-128), 4 tiles
  South door: center, 4 tiles (EXIT)
  Material: marble
  Exhibits: Shelf pedestals (fake items), sign tiles (prices),
            pedestal near entrance (found $20 bill), mannequin cashier (performer)
```

### Total Grid Dimensions

Looking at the placement, the rooms span roughly:
- X: 30 (VTG Wing) to 139 (Collaboration) → need ~150 tiles wide
- Y: 10 (Collaboration) to 213 (player spawn) → need ~220 tiles tall

**Grid: 150 × 220 tiles = 75m × 110m real-world scale.**

---

## Room Details (Skeleton Content)

Each room gets just enough content to feel inhabited:

### Entrance Lobby
- 1 pedestal: Guest book
- 2 exhibit panels: Museum name, visiting hours
- 1 sign: "Welcome to The Kinetic Archive"
- Floor: marble, institutional

### Vulcan Cave
- 4 exhibit panels: Lascaux tablets (north wall), cave paintings (side walls)
- 2 pedestals: Stone tablet replicas
- 2 performer stations: Caveman clubs demo
- 6 torches: Irregularly spaced (cave ambiance)
- 2 triggers: Hidden spirals (floor near exit, ceiling pattern)

### Egyptian Wing
- 4 exhibit panels: Karnak scrolls, priesthood scene, amphora, "Controlled Knowledge"
- 4 pedestals: Pillar-pedestals in two rows
- 2 torches: Oil lamp positions (wall-mounted)
- 1 trigger: Hidden Closed Palm in scroll margin

### Renaissance Wing
- 4 exhibit panels: Codex pages, Vitruvian Man, workshop diorama, "Notebooks Scattered"
- 2 pedestals: Workbench, scattered notes
- 2 torches: Candle-style
- 1 trigger: Hidden Closed Palm (wax seal)

### Victorian Wing
- 4 exhibit panels: Brass device, patents, portraits, "Discredited"
- 2 pedestals: Brass notation machine, prototype
- 2 torches: Gas lamp style
- 1 trigger: Hidden Closed Palm in patent stamp
- Side door to Construction Zone visible

### Digital Wing
- 4 exhibit panels: CRT station, BBS printouts, "3,400 Users", team photo
- 1 pedestal: Working terminal (placeholder for TKA-OS)
- 0 torches: CRT glow only (no torch tiles — room is darker)
- 1 trigger: Hidden Closed Palm in BBS username
- West wall: Visible opening to roped-off VTG Wing

### The Suppression
- 6 exhibit panels: Order display (large, multiple tiles), Lethe docs, "You've Seen This Before",
  May 8 1994, redacted files, global map
- 2 pedestals: Filing cabinets with documents
- 0 torches: Fluorescent (no warm light — institutional)
- This room has the most exhibits — it's the climax of the Order's story.

### The Crumble
- 0 exhibit panels (nothing new was built here)
- 2 pedestals: Abandoned filing cabinets
- 1 torch: Flickering, half-broken
- Wall tiles blocking half the passage at one point (collapsed section)
- This is atmosphere, not content. The decay tells the story.

### K's Gallery
- 4 exhibit panels: K's own curation, warm colors, Scribe history
- 2 pedestals: Personal artifacts, spiral symbol prominent
- 2 torches: Warm, steady (maintained by K)
- 1 performer: Scribe demonstrating a sequence
- Annotations (triggers) scattered — K's sticky notes

### Room of Fear
- 4 exhibit panels: Containment warnings
- 0 pedestals
- 0 torches (harsh overhead — institutional)
- Closed Palm symbols on walls (exhibit panels used as decoration)

### Room of Isolation
- 0 exhibit panels (cubicle walls ARE the exhibit)
- Wall tiles forming cubicle grid (3x4 grid of individual cells)
- 6-12 performer stations inside cubicles (spinners alone, facing walls)
- 1 sign: "MAINTAIN INDIVIDUAL CONTAINMENT PROTOCOLS"

### Room of Collaboration
- 0 exhibit panels
- 4-6 performer stations (scattered, facing each other — spinning together)
- No north/east walls (open to void — feels like outdoors)
- Triggers: Bird sounds, warmth, the emotional counter
- 1 pedestal near exit: Wax figure with pamphlet

### Gift Shop
- 8-10 pedestals: Shelves with merchandise
- 2 signs: Prices, "SOLD OUT" items
- 1 performer: Mannequin cashier
- 1 trigger near entrance: Found $20 bill

### Construction Zone (Easter Egg)
- Scaffolding tiles throughout
- 2 signs: "COMING SOON", "STAFF ONLY"
- 1 pedestal: Unfinished statue (half-covered)
- Small door to Janitor's Closet at back

### Janitor's Closet (Easter Egg)
- 1 torch: Bare bulb
- 1 pedestal: Desk with dossier
- 2 exhibit panels: Whiteboard ("AUSTEN'S FAKE MUSEUM IDEAS"), mannequin face
- No plaque. No explanation.

### VTG Wing (Easter Egg)
- Rope tiles blocking the east entrance
- Scaffolding tiles inside
- 1 sign: "THE VULCAN WING - UNDER RENOVATION - Estimated completion: [DATE NOT FOUND]"
- Dust-covered pedestals (shapes visible but not readable)

---

## Architectural Eras in Tile Rendering

The three eras should be visible in floor materials and wall styling:

| Era | Floor Material | Wall Feel | Torch Style |
|-----|---------------|-----------|-------------|
| Order-built (Cave through Suppression) | stone → sandstone → wood → marble | Heavy, institutional | Warm but controlled |
| The Crumble | dirt | Broken, half-missing | Flickering, unreliable |
| K's Museum (Gallery through Endings) | wood (warm) | Handmade, lighter | Steady, maintained |

The material transitions happen in the corridors. A corridor from Victorian (marble) to Digital (stone) transitions mid-corridor. This is the construction-decade layering the story bible describes.

---

## Connection to Existing Code

### What Changes

**`Museum2DModule.svelte`** — Replace `buildDiscoveryChamber()` with new `buildFullMuseum()` that returns the complete grid.

**`museum-grid-types.ts`** — Already updated with new tile types (`rope`, `scaffolding`, `sign`) and expanded `WingTheme`.

**`tile-registry.ts`** — Already updated with metadata for new tile types.

**New file: `data/museum-floor-plan.ts`** — Contains `buildFullMuseum(): MuseumGrid` with all room placement, corridor routing, and exhibit definitions.

### What Stays the Same

- `Museum2DGame.svelte` — Renders any grid, no changes needed
- `MuseumTileRenderer.svelte` — Needs CSS for new tile types (rope, scaffolding, sign)
- `MuseumPlayerView.svelte` — No changes
- `museum-2d-state.svelte.ts` — No changes (handles any grid)
- `SplitScreenLayout.svelte` — No changes
- `DetailPanel.svelte` — No changes (already reads from exhibit/performer definitions)

### New CSS Needed

For `MuseumTileRenderer.svelte`:
- `.tile-rope` — Red/gold rope barrier appearance
- `.tile-scaffolding` — Orange/brown construction debris
- `.tile-sign` — Readable sign (blue/white informational)

---

## What This Does NOT Include

- Real sequence data in exhibits (wiring PictographRenderer is a separate task)
- Audio or narration system
- Floor plan editor (Workstream 2 from the 2D walker spec)
- 2D-to-3D pipeline (Workstream 3)
- Any Unreal Engine 5 work (separate product entirely)
- Minimap
- Wing name display on region entry

These are all future tasks. This spec is just the skeleton grid.

---

## Success Criteria

1. Player can walk from Entrance Lobby through every room to the Gift Shop exit
2. All 16 rooms are visually distinct (different materials, layouts, content density)
3. Easter egg branches (Construction Zone, Janitor's Closet, VTG Wing) are accessible
4. The pacing feels right — big rooms for big moments, narrow corridors for transitions
5. The three architectural eras are visible in the floor materials
6. Exhibit placeholders have plaque text from the story bible (titles at minimum)
7. The Crumble feels like decay — narrow, broken, atmospheric
8. The ending sequence (Fear → Isolation → Collaboration) builds emotionally
9. Total grid renders without performance issues at 32px tile size
