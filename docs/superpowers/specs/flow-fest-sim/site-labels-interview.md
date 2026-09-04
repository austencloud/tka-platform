# Kinetic Fire — site labels, interview record

Austen's own account of what is actually on the ground, gathered section by
section against the NAIP orthophoto. Everything here is evidence class
`austenObserved` unless marked otherwise. It supersedes the `invention` and
`interpreted` zones in `flow-fest-site-plan.json`, which were guesses.

Pin numbers are scoped to the frame they were asked in: `A1`–`A9` is the east
frame, `B1`–`B10` the middle frame, `ME-<cell>` the Middle Earth grid. Never
reuse a bare number across frames.

Registration: `worldX = -512 + src_x * 0.5`, `worldZ = -512 + src_y * 0.5`,
where `src` is a pixel in `static/data/flow-fest-sim/ortho.webp` (2048², 0.5 m/px).

## The land is three tiers, not one site

| Tier | Where | What it is |
| --- | --- | --- |
| Lower | East | The loop campground |
| Middle | Centre | **Middle Earth** — one grass clearing, and only that |
| Upper | West | Cabins, lodges, parking. Mostly year-round property, not festival |

Middle Earth is **small**. It is the clearing containing `B1`, `B2`, `B9` and
`B3` and nothing else. `B4`, `B5`, `B6`, `B7`, `B8` and `B10` are the **upper**
section. An earlier reading that stretched Middle Earth across all ten pins was
wrong and must not be reintroduced.

You leave Middle Earth by one of two ways:

1. up the road immediately beside `B10`, or
2. up the trail between `B9` and `B5`, which runs off to the side a little
   further south before reconnecting.

## Middle Earth (the fire field)

The clearing runs roughly world x 52 to 130, z -147 to -83: about 82 x 67 m.

A 6 x 5 interview grid is laid over it, columns `A`-`F` west to east, rows
`1`-`5` north to south, each cell ~13.6 x 13.5 m. Cell centre in world:

    worldX = 57.3 + 13.64 * col   (A=0 .. F=5)
    worldZ = -141.9 + 13.45 * row  (1=0 .. 5=4)

| Feature | Cell | World (approx) |
| --- | --- | --- |
| Fire circle, LED rope | centred D3, spans B3-E4 | 90.5, -119.5 |
| Fire circle entrance | `C2` | 79.5, -133.0 |
| Dip station | `B1` | 70.9, -141.9 |
| Walk-in | `E1` | 111.8, -141.9 |
| Volunteer HQ | `F2` | 125.5, -128.4 |
| First aid | `F3` | 125.5, -115.0 |
| Showcase stage, teal roof | `F4` | 126.8, -98.6 |
| Juggling tent | `C5` / `D5` | 93.6, -87.3 |
| Food vendors, at the white structure | `A4` | 55.9, -96.4 |

### The fire circle is an amoeba

Austen sized it at about seven grid cells, "more like a smushed oval so that
there is an ideal viewing section for everybody who's around it". Seven cells of
area is an ellipse of roughly **51 x 32 m**, long axis east-west.

It is **not** a circle and not a clean ellipse. It is a rope laid on grass, so
the preset is `area` (freeform trace) and the rendered boundary must be
irregular. The `circle` shape survives only for the fire pit. See
`.claude/rules/` history on this: shipping it as a circle was a corrected defect.

### The queue, in Austen's own order

    E1 walk in -> west along the north edge -> B1 dip station
      -> A1 -> A2 -> B2 (wait in line again) -> C2 entrance -> the field

A switchback along the top of the field that doubles back through the northwest
corner. You do not enter where you arrive. Once inside you spin around the fire,
maybe on its east side.

Middle Earth also holds the crops that are spun, and the props people bring.

## Upper section

Two frames cover it. The `UP` frame is the older, tighter crop; the `T` frame
covers the whole section and is the one to use.

`T` frame, cells 35 x 30 m:
`worldX = -202.5 + 35*col` (A=0), `worldZ = -185 + 30*(row-1)`.

| Feature | Cell | World (approx) | Note |
| --- | --- | --- | --- |
| Top parking, made pad | `T-E6`/`T-F6` (= `UP-D4` `UP-E4` `UP-D5`) | -87 to -22, -44 to 19 | Hard pale rectangle. Mostly south of the `T` crop |
| Top parking, overflow field | `T-B5` to `T-D6` (= `UP-A3` to `UP-C5`) | -185 to -55, -75 to 19 | Grass. The pad fills first, then this |
| Mown clearing, north half | `T-C4` to `T-F4` | -185 to -20, -95 to -65 | **Nothing is programmed here.** One year it held a firewalk |
| Treeline camping | `T-E2` `T-E3` `T-F2`, and every edge of the clearing | -80 to -10, -170 to -110 | Tents tuck into shade wherever there is an edge |
| Workshop cabin | `T-F2`, pink roof, centred -15, -141 | -22 to -8, -147 to -136 | Workshop `W6`. Austen calls it the pink building |
| Unidentified building | `T-E2`/`T-F2`, dark grey roof, centred -35, -140 | -43 to -28, -146 to -135 | Directly west of the cabin. Austen has never been inside it |
| Main cabin | `T-G4` / `T-H4` (= `UP-F2` `UP-G2`) | 2 to 40, -100 to -78 | Fancy stay, indoor activities. **Not really part of the festival** |
| Lodges and covered porch | `T-F5` (= `UP-E3` `UP-F3`) | -42 to 6, -70 to -48 | |
| North and west woods | `T-A1` to `T-D3` | x below -60, z below -110 | **Not the festival's land.** Property line runs somewhere in there |
| Unrelated houses / rentable cabins | wide `H2` area | 60, -30 | Year-round property |

The clearing is the trap here. It is the largest open ground on the property and
it does nothing. Its southern end is overflow parking; its northern end is
empty grass. Do not site programming on it.

The drive that veers uphill is south of the middle frame and reaches this
section from the paved road. You do not use it on arrival — you drive past it
to the campground first and only come back up if you are not car camping.

## Lower campground

| Pin | What it is |
| --- | --- |
| `A3` | The junction is the gate |
| loop field | The lower campground |

## Arrival, in Austen's route order

Two frames are in play. The **wide frame** is a 6 x 4 grid `A1`-`J4` over the
whole property; cell centre is `worldX = 65*col - 217.5` (A=0), `worldZ =
62.5*row - 168.75` (row 1 = 0). The **loop frame** is a 6 x 6 grid over the
lower campground; `worldX = 213 + px/9.032`, `worldZ = -209 + py/9.032`.

1. **Down the paved road.** `B4` `C4` `D4` `E4` `F4` `G4` `H4`, then veer north
   into `I3`. You do not turn off at the west or middle drives.
2. **In at the lower campground.** Turn **right** into the loop.
3. **Check in.** A canopy on your **left**, to the right of the main building
   that is there year round. Several volunteers.
4. **Pull off first.** Get the car into the grass beside the campground, out of
   the traffic lane, before you do anything.
5. **Sign in**, hand over ID, receive a **wristband**, get told how everything
   works.
6. **Back in the car**, out of the spot, and around the loop
   **counterclockwise. That is the only direction allowed.**

Then it forks:

### Camping is a rule, not a zone

You drive to wherever your campsite is going to be and unload at it. Arrive
early and that is easy; arrive late and every good spot is taken. Then the car
has to end up in one of exactly two places:

| If you are | Your car ends up |
| --- | --- |
| Car camping | in the **middle of the loop**, beside your tent |
| Setting up a regular camp | at the **very top parking**, `B3` `C3` `B4` `C4` |

Getting to the top lot means driving back out of the lower section, along the
paved road the way you came, and up. Upper camping options: the treeline at
`C2`, the bottom of `D1`, the bottom-right of `C1`.

Do not model camping as fixed pitches. Model it as first-come occupancy plus
that two-way parking rule.

## Lower campground

The loop is a closed gravel circuit roughly 111 x 101 m, world x 219 to 330,
z -177 to -76. One junction, at its southeast corner beside the main building.

| Feature | Loop cell | World (approx) |
| --- | --- | --- |
| Junction off the paved road | `E5` | 319.6, -105.5 |
| Main building, year round | `D5` | 305.4, -114.0 |
| Check-in canopy | `E4` | 319.6, -116.2 |
| Sign-in pull-off | top of `E4`, or the east side of `E5` | — |
| Park in the middle | `C4` | 272.8, -131.5 |

## Vendor village, and the barn

`G2` is **primarily Vendor Village**. From the air it reads as woods; it is
not. You walk straight through it easily, because you are only looking at the
tops of the trees. Through it runs a **decorated pathway**, usually hung with
art strung along the trees.

At the northwest of `G2`, immediately **east of Middle Earth and nestled into
the woods**, stands the **abandoned stage** — the old stage, kept after they
built the new one. The teal roof inside Middle Earth is that new one. The
abandoned stage is under canopy and does not read from the air.

A third frame covers this block: columns `P`-`V`, rows `1`-`7`, cells ~13 m,
lettered `P` onward so they cannot be confused with the wide frame's `G2`.
`worldX = 134.6 + 13.22*col` (P=0), `worldZ = -160.6 + 13.22*row`.

| Feature | Vendor cell | World (approx) |
| --- | --- | --- |
| Barn | `T3` | 187.5, -120.9 |
| Abandoned stage | `P3` / `Q3` | 135 to 148, -121 |

### The pathway is the loop road continued

The decorated path is not a separate trail cut through the woods. It **follows
the same line the bottom of the campground loop already follows**, ever so
slightly diagonal, runs straight up into Middle Earth, then veers left to go up
the road. It is invisible from the air because the canopy closes over it.

That is a load-bearing detail for the tree work: the canopy must close above
the path while the understory stays open enough to walk and to hang art in.

### Jam circles are everywhere

Austen: "literally everywhere. It's a flow festival." Do not place jam circles
as fixed sites. They are emergent, wherever there is room and people.

`H2`, at its bottom, has another clearing where vendor village spills over. It
is a big space.

At the **top right of `G2` there is a barn**. It matters: activities happen in
it, and when the festival rains out, everyone and everything goes into the
barn. Austen: "Kinetic Fire or Kinwetic Water as we like to call it." Rain is a
recurring, expected condition, not an edge case.

## Woods people actually walk through

Only `G2`. Everything else reads as woods and functions as edge and backdrop.
That single block is where tree work has to hold up at eye level: a walkable
understory, a decorated path, art in the branches. The rest can be canopy.

This is the layout constraint for the ez-tree work. See
`project_ez_tree_adoption` in memory.

## Open — still to establish

- Exact canopy, pull-off, and per-site camping spots around the loop.
- Where exactly the abandoned stage sits, and what condition it is in.
- Exact porta-potty and shower positions inside the campground and Middle
  Earth. The zones are settled; the pins are still my picks.
- The property line through the upper woods.

**Closed 2026-09-03:** workshop locations (all seven placed), and the whole map
as a unit. Shown the consolidated recap — every traced route, the loop, the
fire-field amoeba, the check-in queue and nineteen labeled pins — Austen
validated it in one pass: *"It's all about right."* Nothing in the record above
is waiting on his confirmation any more.

## Drive-in direction

Not a site fact. Austen: "It depends where you're driving from." The arrival
arc must ask the player, or pick from their stated origin. Do not hard-code a
compass bearing into the drive-in.

## Trees

Answers from 2026-09-03, the batch that drives the ez-tree layout.

**The two big clearings are genuinely bare.**

- The Middle Earth grass clearing — the fire field — has **no trees in it at
  all**. Not ringed-with-a-few-in-the-middle. Bare.
- The **inside of the lower campground loop is wide open, no trees**. Shade
  there comes only from the tree wall at the loop's edge.

**The good trees — hammocks, slacklines, the ones people compete for — are on
the lower campground treeline.** Not the pathway, not the fire-field edge, not
the upper treeline. That treeline is the one place the layout should spend
open-grown, big-crowned, low-forking specimens.

Art is still strung along the decorated pathway (see the pathway section), but
that is hung decoration, not the hammock trees. Keep the two separate.

**The property line through the upper woods is unknown.** Austen knows where
people go, not where the deed line runs. Until it is traced, the north and west
woods stay pure backdrop: canopy, no programming, no camping, nothing sited.
The one exception is what he named directly — treeline camping at `T-E2`,
`T-E3`, `T-F2`, and the workshop cabin at `T-F2`/`T-F3`.

### Resolved: the tree cluster inside the loop

Austen said the loop interior is "wide open, no trees". The LiDAR canopy survey
puts **12 trees inside the traced loop road** against 79 on the treeline
outside it. The orthophoto backs the survey in part: most of those twelve sit
on a real dark canopy mass in the middle-south of the loop, wrapped around the
main building. A few sit on open grass at the north end.

Shown the overlay, Austen confirmed all twelve: *"I was speaking loosely.
Those trees exist, you just don't get to camp under them."* The survey is
right. "Wide open" describes campable shade, not tree count — a useful
reminder that his zone language is about use, not about geometry.

## Tree character, by zone

- **Lower campground treeline** — *"a dense wall of woods."* Not open-grown
  spreading specimens. Tight trunks, canopy carried high, closed-stand forms.
  The hammock and slackline trees are simply the first few trunks of that wall
  where it faces the field. This is the one place the layout should be
  deliberate; everywhere else habitat casting is fine.
- **Decorated pathway** — canopy is **dappled and patchy**, not a closed
  tunnel. Do not roof it. Gaps of sky along its length are correct.
- **Middle Earth fire field** — bare. No trees at all.
- **Loop interior** — a real stand around the main building, no campable shade.
- **North and west woods** — backdrop only, and the survey already stops at
  roughly the property edge (trees span world x -160 to 380, z -170 to 40).

## Infrastructure

Present on site: **porta-potties** and **showers**. Austen did not name potable
water spigots, generators, or power drops when offered them, so do not invent
them.

**They cluster in two places only: the lower campground and Middle Earth.**
The top parking gets none — you walk down. Exact positions within those two
zones are still my picks, not his; the candidates currently drawn are:

| Cluster | World (approx) | What it serves |
| --- | --- | --- |
| Middle Earth, west edge | 66, -100 | The fire field and the food vendors |
| Campground, north arc | 266, -178 | Camping along the top of the loop |
| Campground, south arc | 262, -79 | Camping along the bottom of the loop |
| Campground, near the gate | 312, -101 | Arrivals and the check-in canopy |

Showers ride with the Middle Earth cluster and the campground south arc. The
other two are toilets only.

## Workshops

Workshops have **specific, repeated locations**, not ad-hoc shade. **They do
not need trees** — Austen: *"Workshops don't need shade."* They pitch their own
canopies, so the layout must not treat a workshop spot as a reason to place a
tree, and must not push one into the treeline to find shade.

Seven spots, resolved 2026-09-03:

| # | Where | World (approx) | Source |
| --- | --- | --- | --- |
| W1 | Middle Earth, north-west of the fire field | 72, -134 | my pick |
| W2 | Middle Earth, north-east of the fire field | 106, -131 | my pick |
| W3 | Middle Earth, west side by the food vendors | 61, -110 | my pick |
| W4 | Middle Earth, south-east past the juggling tent | 110, -89 | my pick |
| W5 | The road intersection west of the loop | 213, -95 | Austen |
| W6 | The pink cabin | -15, -141 | Austen |
| W7 | North of the lodges' covered porch | -27, -83 | Austen |

**The Middle Earth four are mine to choose.** Austen: *"The whole thing gets
filled doesn't really matter you can pick the spots I'll just tell you if I
want to change."* They ring the fire field on open grass, spread to the four
compass sides, clear of the amoeba, the queue, the food vendors, and the
juggling tent. Treat them as placed, not provisional — he corrects rather than
approves.

**W5 is the T where the Vendor Village road meets the south-west corner of the
loop road.** Austen: *"kind of at the left corner of the whole loop on the
other side of Vander Village so serve at the intersection."* The junction is
visible in the orthophoto at roughly world (215, -95).

**W6 is the pink-roofed cabin**, and it is the same building as the "red roof"
workshop cabin recorded in the Upper section table. Confirmed at 9x zoom: two
buildings sit side by side on the north edge of the upper clearing — the west
one has a dark grey roof and is the building Austen has never been inside, the
east one has a distinctly rose-pink roof and is the workshop. He described it
as *"the pink building on the north edge on the right."* That resolves the
Upper section's open question by elimination: the unidentified building is the
**west** one at roughly world (-35, -140).

**W7 is the open lawn immediately north of the lodges and covered porch.**

The count reconciles: two at the top of the hill are W6 and W7 (the cabin was
never a separate eighth venue), four in Middle Earth, one at Vendor Village.

## Backdrop woods

Extend the trees past the property line. From inside the festival you look at
the neighbor's treeline and it reads as one continuous mass, so the survey's
current cutoff at world x -160 / z -170 leaves a visible hole in the horizon.
Ownership does not decide what is rendered; sightlines do.
