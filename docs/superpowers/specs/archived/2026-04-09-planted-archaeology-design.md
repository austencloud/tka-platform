---
status: archived
---
# Planted Archaeology: Real-World Museum Artifacts

> **Status:** Brainstorm — concept validated, needs era-by-era design pass
> **Date:** 2026-04-09
> **Goal:** Seed discoverable artifacts across real platforms so TKA's fictional history has real-world provenance

---

## The Concept

Extend the Andy Kaufman Rule beyond the museum game. Plant functional, discoverable artifacts on real platforms (package registries, archived websites, social media pages) that corroborate the museum's fictional timeline. If someone goes snooping, they find evidence. Their reality gets fucked with.

Every artifact must work on two axes:
- **Standalone weird** — someone finds it cold, no context, and stays because the content is compelling
- **Museum payoff** — a player recognizes it from the game and their jaw drops

---

## The 30-Second Test

Every artifact must pass this: someone arrives cold, no context, no museum game, no Reddit thread. Within 30 seconds they hit something that makes them stay. Not a broken link. Not a reference to something else. A moment of "this is weird and I want to know more."

---

## Discovery Model: Option C

Optimized for BOTH scenarios:
- Players who played the museum game and go looking for corroboration
- Strangers who stumble in cold and get pulled into the rabbit hole

---

## Artifact Network: Skeleton + Dead Ends

3-4 real artifacts that link to each other (working breadcrumbs), surrounded by dead references to things that don't exist. Working links make the dead ones feel like losses instead of gaps.

Every 404 becomes evidence of Protocol Lethe. The player who's been through the museum hits a dead link and thinks "they got to this one." The stranger thinks "this used to be bigger."

The network should feel like it *used to be* complete and someone took a machete to it — which is literally what Protocol Lethe is.

### Cross-reference rules:
- Every real artifact links to at least one other real artifact (working)
- Every real artifact references at least one thing that doesn't exist (dead)
- Dead references include: "the European mirror" (404), "the mailing list archive" (gone), "the BKC internal FTP" (obviously gone), "the Tokyo archive" (never built)
- Dead links are losses, not gaps — the content around them implies something was there

---

## Provenance: Full Theater

Maximum authenticity. Backdated commit messages (git allows arbitrary dates), obscure registries, bare-bones HTML on platforms where old content is plausible. SourceForge projects, Neocities pages that get Wayback Machine crawled.

The artifacts say "...wait, is this actually old?" not "cool art project pretending to be old."

If people argue about whether it's real, that IS the Kaufman endgame.

---

## Artifact Timeline

| Era | Story Bible Version | Artifact Type | Platform | Hook |
|-----|-------------------|---------------|----------|------|
| 1989 | DOS v1 (K builds it) | Functional CLI package | npm/pip/PowerShell | BKC TEMPORARY CLEARANCE welcome screen |
| ~1993 | v2 (post-Bellweather) | Early internet traces | Usenet posts, mailing list archives | Leaked classified tool, hushed discussion |
| 1998 | v3 (Scribes grow) | Personal website(s) | GeoCities-style (Neocities), webring | Earnest forbidden-knowledge tutorials, guestbook arguments |
| 2003 | v4 (peak spread) | Social media community | MySpace page, Xanga blogs | Active community mid-conversation, frozen by Lethe |

---

## 1989 CLI Package: Deep Rabbit Hole

Not just cosmetic. A real classified government tool delivered as an installable package.

### Framing: Archive + Composer (Same Principle as TKA Scribe)

TKAUTIL.COM is both a knowledge database AND a composition tool — the same way TKA Scribe today contains the museum experience inside the composer. The Order needed both: a system to catalog suppressed notation AND analytical tools to reconstruct/classify sequences for threat assessment. The Order authorized the creative tools themselves, for containment purposes. They didn't anticipate someone using them to fall in love with what they were analyzing.

That's the comedy: the government built the creative tools. K just started enjoying them.

### Existing codebase: ~28,000 lines already built

The in-game 1989 DOS terminal (`src/lib/features/retro/dos/`) already has:
- Full command parser (DIR, TYPE, CD, HELP, SCRIBE, GENERATE, etc.)
- Simulated filesystem (C:\BELLWTHR, C:\SYSTEM, C:\TEMP)
- Two ASCII/Braille renderers for pictograph display
- 7 SCRIBE sub-applications (generate, construct, spell, browse, cards, tutorial, config)
- Boot sequence, lore database, institutional tone throughout
- CRT effects, phosphor color schemes, sound

Content is highly portable. Rendering layer (Svelte/CSS/DOM) would need rewriting for real terminal output.

### Surface layer — BKC Analytical Workstation:
- `QUERY` / `RETRIEVE` / `DIR` — archive side, browse containment records
- `GENERATE` / `CONSTRUCT` / `ANALYZE` — analytical tools, "reconstruct suspected kinetic sequences for classification"
- `CLASSIFY` / `FILE` / `AUDIT` — bureaucratic operations, threat assessment
- SCRIBE tutorial = **mandatory BKC training material** ("all personnel must complete kinetic notation certification before accessing Level 3 records")
- Institutional welcome: BKC TEMPORARY CLEARANCE granted

### Hidden layer — K's traces:
- Hidden files in install directory
- K's personal notes, growing doubt
- `BELLWEATHER.log` — corrupted
- Breadcrumbs that don't make sense until you know K's arc
- Things someone would post on Reddit saying "I found something weird in the install folder"

---

## Community Deliberation Content

**Key insight:** Austen lived the real notation debates. The fake community arguments should mirror the real deliberations that happened during TKA's actual creation.

Examples of real debates to fictionalize:
- Should static positions count as letters?
- Should the dash type be split into two types?
- Why 6 types when 4 covers everything?
- 8 grid points vs 9 — is center redundant?
- Is the notation descriptive or prescriptive?
- Orientation algebra: how deep does it go?
- LOOP detection: automatic or manual classification?

The losing sides had reasonable arguments. That's what makes it feel real — actual substance, not strawmen. Some arguments were settled correctly by the losing side's logic.

### Deliberation distribution across eras:
- **1998 (GeoCities):** Simpler, foundational debates. One person's passionate essay pages with guestbook disagreements. Lonely, early-internet energy.
- **2003 (MySpace):** Deeper, community-scale debates. Forum threads with multiple voices. The complexity growing mirrors the community growing.

**Needs:** Era-by-era design pass to map specific debates to specific eras and voices.

---

## Aesthetic References by Era

| Era | Visual Language |
|-----|---------------|
| 1998 | Tiled backgrounds, visitor counters, "under construction" gifs, webrings, Angelfire energy |
| 2003 | MySpace custom CSS, top 8 friends, embedded music players, Xanga blog layouts, early social media |

The 2003 MySpace era is unexplored aesthetic territory for the museum — early social media hasn't been played with in any of the retro eras yet.

---

## Open Questions

- Which package registry for the 1989 CLI? (npm feels wrong for a "1989" tool — pip or a standalone installer might sell better)
- How to handle the 1993 Usenet/mailing list era? Real Usenet archives exist (Google Groups). Feasibility of planting there vs. fabricating screenshots.
- Should any artifacts contain actual functional TKA notation tools, or just documentation/community content?
- Legal/ethical line: fabricating platform metadata (backdated uploads) vs. fabricating content on honestly-dated platforms with retro aesthetics
- How do the retro museum terminals in the UE5 game reference/link to the real-world artifacts? QR codes? URLs in terminal output?
- Voice/persona guidelines for fake community members — how many distinct personas, what are their archetypes?

---

## Next Steps

1. Era-by-era deep design pass (map specific content, debates, and artifacts per era)
2. Platform feasibility research (what can actually be backdated, what gets crawled by Wayback Machine)
3. Persona development for fake community members
4. Content writing for the 1989 CLI (text adventure + hidden files)
5. Implementation planning per artifact
