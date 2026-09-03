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

| Feature | Where Austen put it | World (approx) |
| --- | --- | --- |
| Showcase stage | `B3`, the teal roof | 129, -99.5 |
| Fire circle | at `B2`, "basically" | 80.5, -118.5 |
| Fire circle entrance | NW of `B2` | — |
| Dip station | behind the entrance, reached by the queue | — |
| Queue | switches back and forth between entrance and field | — |
| Volunteer HQ | north of `B3` / east of `B1` | — |
| First aid tent | same area as volunteer HQ | — |
| Juggling tent | south of `B2` and east of `B9` | — |
| Unidentified white structure | `B9` | 55, -96.5 |

The walk-in, in Austen's order: enter around `B1`, go around the side, into the
dip station, through the rest of the queue which goes back and forth, into the
field north of `B2`, then spin around `B2`, maybe east of `B2`.

Middle Earth also holds the crops that are spun, the volunteer HQ, first aid,
and possibly food vendors.

## Upper section

| Pin | What it is |
| --- | --- |
| `B4` | The main cabin. Fancy stay, indoor activities. **Not really part of the festival.** |
| `B5` | Inside the campground. A covered porch and a bunch of lodges sit next to it. |
| `B6` | Approximately the parking lot. You park **west** of `B6`, never pulling forward into `B5`. |
| `B7` | Unrelated houses, or possibly rentable cabins. Year-round property. |

The drive that veers uphill is **further south, off the bottom of the middle
frame**. You do not drive into the `B5` area to reach parking.

## Lower campground

| Pin | What it is |
| --- | --- |
| `A3` | The junction is the gate |
| loop field | The lower campground |

## Open — still to establish

- Exact points for: fire circle entrance, dip station, queue path, volunteer HQ,
  first aid, juggling tent. All were given as compass offsets, not points.
- The uphill drive, south of the middle frame.
- Vendor village, jam circles, wristband canopy, temporary parking.
- The woods: which stands, which species, which density — feeds the ez-tree
  layout. See `project_ez_tree_adoption` in memory.

## Drive-in direction

Not a site fact. Austen: "It depends where you're driving from." The arrival
arc must ask the player, or pick from their stated origin. Do not hard-code a
compass bearing into the drive-in.
