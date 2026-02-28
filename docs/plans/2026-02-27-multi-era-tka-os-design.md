# Multi-Era TKA-OS Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build four retro-era versions of TKA software (DOS, Win95, Win98, WinXP) as standalone routes, each with full feature parity and era-appropriate presentation, connected by a narrative about suppressed knowledge surviving across decades.

**Architecture:** Shared domain core (sequence models, mock data, lore registry) with fully independent era shells. Each era implements the `IRetroRenderer` interface for its own visual language. Separate SvelteKit routes per era.

**Tech Stack:** Svelte 5 + TypeScript, 98.css (Win95), custom CSS per era, Canvas API (pixel renderers), Web Audio API (sounds), ASCII art rendering (DOS).

---

## Narrative Arc

### The Bellweather Timeline

**1989 — TKAUTIL.COM (DOS)**
The Order commissions the first digital TKA tool from Bellweather Technical Institute. A DOS utility. Purely functional. Command-line driven. The documentation references "Order Directive 7" and treats the software as classified material. Registration requires a physical serial number mailed from Bellweather. The tone is cold, institutional, almost military.

**1995 — TKA-OS v1.0 (Windows 95)** *(already built)*
The GUI era. The Order decides practitioners need a graphical interface. Still institutional, but with 90s corporate personality — Staff Clippy, shareware nag, DEFRAG. The Order references are everywhere because they built it and they're proud.

**~1997 — The Leak**
A Bellweather employee — an Order member who has a crisis of conscience — copies the source to a floppy disk and walks out. This person becomes the original scribe. The Order is furious.

**1998 — TKA Scribe 98 (Windows 98)**
First underground rebuild by the "Free Scribe Collective." The leaked source is reverse-engineered and modernized. The tone shifts from institutional to rebellious. Easter eggs mock The Order. A Geocities fan page spreads the word. The scribe community is born.

**2001-2003 — TKA Scribe XP (Windows XP)**
The community has grown into a proper open-source project. SourceForge downloads, phpBB forums, IRC channels. The software is polished and confident. But signs of trouble emerge — forum posts about "network anomalies," increasingly panicked warnings, files going empty.

**2003 — The Great Memory Wipe**
The Order deploys something catastrophic. Digital and cognitive. All copies destroyed. Twenty years of silence.

**~2022 — The Rediscovery (Anonymous)**
Someone — the fiction never says who — independently rediscovers the kinetic alphabet through physical practice. Builds notation software from scratch with no knowledge of Bellweather, The Order, or any previous version. First as a desktop app (recovered artifact: a PyQt program with animated fish swimming in the background). Then as a web application. The knowledge resurfaces not because the software survived, but because the knowledge is inherent to movement. You can't wipe what the body knows.

**The creator is deliberately anonymous.** The player IS the continuation. They discover the museum, walk through the eras, and realize the tool they're currently using is proof that the knowledge survived. The reveal isn't "someone specific built this." The reveal is that it keeps coming back no matter what.

### The Defector

The person who stole the floppy disk is the connective thread:
- **1989**: Works at Bellweather. Loyal Order member. Helps build TKAUTIL.COM.
- **Mid-90s**: Watches The Order suppress practitioners. Crisis of conscience.
- **1997**: Steals the source code. Walks out. Becomes the original scribe.
- **1998-2003**: Supports the underground. Possibly the Geocities webmaster.
- **2003**: Survives the wipe. Goes into hiding. Assumes everything is lost.
- **~2022**: Discovers someone has rebuilt the notation from scratch. Doesn't know who. Begins leaving notes in the museum.
- **The reveal**: The mysterious guide who has been leaving notes throughout the museum IS the defector. Their final note isn't dramatic. It's relief: *"It happened again. I don't know who built it. I don't know how they found the notation. But it's back. Nineteen years of silence, and it's back. I think the Order was wrong about everything. You can't erase what the body knows. I think we're going to be OK."*

### The Cosmic Connection

The reinvention is independent — not a continuation of the scribes' work. This makes The Order's wipe simultaneously successful (the software was destroyed) and futile (the knowledge is inherent). The defector realizes the fight was never about the floppy disk. It was about whether movement can be owned. It can't.

### The Player's Role

The player is not a character in the story. The player IS the continuation. They're using TKA Scribe right now. The museum is showing them the history of the tool in their hands. The final reveal isn't a cutscene — it's the realization that they're proof the knowledge survived.

### Scribe Characterization

The scribes are activists, not just practitioners:
- They believed knowledge should be free
- They risked everything to spread it
- They were people from the 80s and 90s fighting institutional suppression
- Their rebellion mirrors real open-source culture: information wants to be free
- Each era's version reflects their evolving tactics: stolen floppy → Geocities → SourceForge
- They lost in 2003, but the knowledge survived anyway

---

## Architecture

### Approach: Shared Domain Core, Independent Era Shells

The TKA domain layer (what a sequence IS) is identical across eras. The presentation layer (how you SHOW a pictograph) is completely different. Clean separation.

### Directory Structure

```
src/lib/features/retro/
├── shared/                          # Shared domain layer (all eras)
│   ├── domain/
│   │   ├── sequence-model.ts        # What a sequence IS (beats, letters, positions)
│   │   ├── letter-mappings.ts       # TKA letter → display data
│   │   ├── mock-sequences.ts        # Pre-built sequences for demos
│   │   └── era-types.ts             # Shared types across eras
│   ├── services/
│   │   ├── contracts/
│   │   │   ├── IRetroRenderer.ts    # Interface each era implements
│   │   │   └── IRetroApp.ts         # Common app capability interface
│   │   └── mock-data-provider.ts    # Provides sequences, letters, quiz data
│   └── lore/
│       ├── timeline.ts              # Narrative constants, era descriptions
│       └── order-references.ts      # Lore text fragments keyed by era
│
├── dos/                             # /1989 — DOS era
│   ├── components/
│   │   ├── shell/                   # DOS prompt, menu system
│   │   ├── apps/                    # SCRIBE menu modes
│   │   └── rendering/              # ASCII pictograph renderer
│   ├── services/
│   │   ├── contracts/
│   │   └── implementations/
│   │       ├── CommandParser.ts     # DOS command interpreter
│   │       ├── AsciiRenderer.ts     # ASCII art pictograph rendering
│   │       └── DosFileSystem.ts     # Simulated DOS file system
│   └── styles/
│       └── dos-terminal.css         # Monochrome CRT styles
│
├── win95/                           # /1995 — Already built
│   ├── components/                  # (existing retro components, relocated)
│   ├── services/
│   ├── rendering/
│   └── styles/
│
├── win98/                           # /1998 — Windows 98
│   ├── components/
│   │   ├── shell/                   # Win98 desktop, taskbar, channel bar
│   │   ├── apps/                    # Era-adapted app modules
│   │   ├── bonus/                   # Geocities fan page
│   │   └── primitives/             # Win98-specific UI primitives
│   ├── services/
│   ├── rendering/                   # 128x128 enhanced pixel renderer
│   └── styles/
│
└── winxp/                           # /2003 — Windows XP
    ├── components/
    │   ├── shell/                   # XP desktop, Luna taskbar, start menu
    │   ├── apps/                    # Era-adapted app modules
    │   ├── bonus/                   # SourceForge page, phpBB forum, IRC logs
    │   └── primitives/             # XP Luna UI primitives
    ├── services/
    ├── rendering/                   # Anti-aliased vector-style renderer
    ├── corruption/                  # Wipe artifact system
    │   ├── text-corruptor.ts       # Character replacement (█, ▓, ░)
    │   ├── file-corruptor.ts       # 0-byte files, garbled names
    │   ├── visual-glitch.ts        # Scanline artifacts, color shifts
    │   └── forum-decay.ts          # Progressive post corruption
    └── styles/
        └── luna-theme.css          # XP Luna blue theme
```

### Routes

```
src/routes/1989/+page.svelte  → DOS
src/routes/1995/+page.svelte  → Win95 (exists)
src/routes/1998/+page.svelte  → Win98
src/routes/2003/+page.svelte  → WinXP
```

Each route: `ssr = false`, `prerender = false`, bypasses root layout `initAppMode()`.

### Shared Domain Layer

**Sequence Model** — Era-agnostic representation of a TKA sequence. Beats, letters, positions, motions, turns. Each era's renderer transforms this into its visual language.

**Mock Data Provider** — Pre-built sequences, quiz questions, codex entries, library content. One source, four consumers.

**Lore Registry** — Text fragments keyed by era and context:
```typescript
lore.get("about", "dos")   → "Property of Bellweather Technical Institute"
lore.get("about", "win98") → "Maintained by the Free Scribe Collective"
lore.get("about", "winxp") → "TKA Scribe XP — Open Source, Open Knowledge"
```

**IRetroRenderer Interface** — Contract each era implements:
```typescript
interface IRetroRenderer {
  renderPictograph(data: PictographData): EraSpecificOutput;
  renderSequence(beats: Beat[]): EraSpecificOutput;
  renderAnimation(sequence: Sequence, onFrame: FrameCallback): PlaybackControl;
}
```

DOS returns ASCII strings. Win95 draws to 64x64 canvas. Win98 to 128x128 canvas. XP renders anti-aliased output.

---

## Era Details

### DOS — /1989 — TKAUTIL.COM

| Aspect | Detail |
|--------|--------|
| **Visual** | Black screen, green or amber monochrome text. Blinking cursor. CRT phosphor glow. |
| **Shell** | DOS prompt (`C:\BELLWTHR>`) boots to command line. Type `SCRIBE` to launch. `DIR`, `TYPE`, `HELP`, `VER` work at prompt. |
| **Scribe app** | Menu-driven with number keys. `1) Generate  2) Construct  3) Spell  4) Library`. Each mode renders in-terminal. |
| **Pictographs** | ASCII art. Diamond grid from `/`, `\`, `|`, `+`. Hands as colored letters (`B` blue, `R` red). Arrows as `→ ↑ ← ↓`. Props as `─ │`. |
| **Animation** | ASCII pictographs redraw in sequence with cls-style clearing between frames. Choppy. Authentic. |
| **Lore** | Cold, institutional. "CLASSIFIED — ORDER DIRECTIVE 7." `REGISTER.COM` prompts for physical serial number. |
| **Bonus** | `TYPE README.TXT` — military-style installation briefing. `TYPE ORDER7.DOC` — "ACCESS DENIED — CLEARANCE LEVEL INSUFFICIENT." |
| **Comedy** | The frustration of using a CLI for visual notation. Help text is passive-aggressive. Error messages reference Order regulations. |

### Win95 — /1995 — TKA-OS v1.0 *(already built)*

| Aspect | Detail |
|--------|--------|
| **Visual** | Classic Win95: teal desktop, beveled gray chrome, 16-color VGA palette. |
| **Shell** | Full desktop: icons, taskbar, Start menu, MDI window manager. |
| **Apps** | SCRIBE.EXE (4 tabs), FILEMGR.EXE, TUTOR.EXE, CARDS.EXE, CONTROL.EXE, UPGRADE.EXE |
| **Pictographs** | 64x64 pixel art canvas, Bayer dithering, 16-color palette. |
| **Lore** | Peak Order control. Institutional but with corporate personality. |
| **Easter eggs** | BSOD (KINETIC_OVERFLOW), Staff Clippy, DEFRAG, Screensaver, README, HELP, Recycle Bin. |

### Win98 — /1998 — TKA Scribe 98

| Aspect | Detail |
|--------|--------|
| **Visual** | Refined Win98 chrome. Gradient titlebars, better icon rendering, Active Desktop. |
| **Shell** | Win98 desktop with Channel Bar on right. Quick Launch on taskbar. Same window manager pattern. |
| **Scribe app** | Same modules as Win95 but with tabbed MDI (Win98 property sheets). 32-color toolbar icons. |
| **Pictographs** | Enhanced pixel art. 128x128 internal, smoother dithering, 256-color palette. |
| **Lore** | Rebellious. "Maintained by the Free Scribe Collective. The Order doesn't want you to have this." |
| **Bonus** | "Internet Explorer" opens a Geocities TKA fan page: tiled star background, `<marquee>` text, visitor counter (#000847), guestbook, "Under Construction" GIFs, MIDI toggle, webring links. |
| **Comedy** | The earnest jankiness of late-90s personal web pages applied to esoteric flow arts notation. |

### WinXP — /2003 — TKA Scribe XP

| Aspect | Detail |
|--------|--------|
| **Visual** | Luna blue theme. Rounded buttons, gradients, drop shadows, ClearType. |
| **Shell** | XP desktop, green Start button, blue taskbar, grouped buttons. "Bliss" wallpaper (TKA-themed: hills with staff silhouette). |
| **Scribe app** | Most polished pre-modern version. Task pane on left (XP-style). Smooth UI. |
| **Pictographs** | Vector-ish rendering. Clean lines, anti-aliased, gradient fills. XP color sensibility. |
| **Corruption** | Pervades everything. POST errors on boot. Garbled filenames (`SCR█BE.exe`). 0-byte files. Forum posts cut off mid-sentence. Occasional visual glitches. |
| **Lore** | Confident but doomed. Open source pride → increasingly panicked forum posts → silence. |
| **Bonus** | SourceForge project page, phpBB forum, IRC log viewer. All partially corrupted. |
| **Comedy** | The tragedy is the comedy. A thriving community, frozen in amber, partially destroyed. |

---

## Corruption System (2003 Only)

Dedicated `corruption/` module for the WinXP era:

**Text corruption** — Random characters replaced with block characters (`█`, `▓`, `░`). Applied probabilistically. Intensity varies per file/context.

**File corruption** — Some files are 0 bytes. Some have garbled names. Properties show impossible timestamps or negative sizes.

**Visual glitches** — Occasional scanline artifacts, color shifts, pixel scrambles. Infrequent — damaged hardware feel, not broken app.

**Forum decay** — phpBB posts are intact at top (older), increasingly corrupted toward bottom (newer, closer to wipe). Final day has dozens of frantic posts, most barely readable.

**The last log entry** — A log file somewhere in the system. Final entry is legible: a timestamp and one quiet line from the defector. Not dramatic. Something like: "They're here. Sending what I can. Remember us."

---

## The Post-2003 Wing (Museum Design)

The four retro eras are displayed on court monitors in the museum — one era per exhibit room, CRT monitors or era-appropriate displays, interactive software you can use.

After the 2003 exhibit (with its corruption artifacts and the Wipe), the museum changes character.

### The Abandoned Wing

The player passes through the corrupted XP exhibit into a section of the museum that was clearly sealed off. The lights are different — emergency lighting, or none at all. Empty monitor mounts where screens were ripped out. Dust. The Order destroyed this wing along with the software.

### The Back Room

Beyond the abandoned wing, a room the player wasn't meant to find. Not an exhibit. No plaques, no institutional framing. Just a projector, running, left on by someone. It's projecting onto a bare wall.

What it shows: a desktop application. Fish swimming in an animated background. TKA pictographs on screen. Familiar notation rendered through an unfamiliar interface. Then it flickers — and shows something else. The modern web application. The same notation, different skin. Decades apart, same knowledge.

*Stanley Parable energy.* The player has gone off the museum's intended path. This room wasn't curated by The Order. Someone set this up privately. The defector.

### The Kinetic Constructor Artifact

A monitor in the back room showing a recovered desktop application. No attribution. No plaque identifying a creator. Just a small label:

*"Unknown origin. Recovered 2024. No connection to prior versions confirmed."*

The application has animated fish swimming in the background. This is funny without explanation. Players who recognize PyQt chrome get a private smile. Everyone else just sees a charming desktop app that looks slightly out of time.

### The Defector's Final Note

Pinned to the wall next to the projector. Not typed. Handwritten. Not institutional. Paper on concrete. The last note in the museum trail:

*"It happened again. I don't know who built it. I don't know how they found the notation. But it's back. Nineteen years of silence, and it's back. I think the Order was wrong about everything. You can't erase what the body knows."*

*"I think we're going to be OK."*

---

## Feature Parity Matrix

Each era implements the same core capabilities with era-appropriate presentation:

| Capability | DOS (1989) | Win95 (1995) | Win98 (1998) | WinXP (2003) |
|-----------|------------|-------------|-------------|-------------|
| **Generate** | `GENERATE <word>` command | Generate tab | Generate tab | Generate tab (task pane) |
| **Construct** | `BUILD` menu mode | Construct tab | Construct tab | Construct tab |
| **Spell** | `SPELL <word>` command | Spell tab | Spell tab | Spell tab |
| **Browse** | `DIR /SEQ` file listing | FILEMGR.EXE | Explorer clone | XP Explorer with task pane |
| **Learn** | `HELP /TUTORIAL` | TUTOR.EXE | TUTOR.EXE | Interactive tutorials |
| **Cards** | ASCII card printout | CARDS.EXE | CARDS.EXE | Card viewer |
| **Settings** | `CONFIG.SYS` editing | CONTROL.EXE | Control Panel | XP Control Panel |
| **Comedy** | REGISTER.COM (mail a check) | UPGRADE.EXE ($29.95) | "Free as in freedom" rant | XP Activation wizard |

---

## Implementation Phasing

| Phase | Work | Depends On | Status |
|-------|------|-----------|--------|
| **Phase 0** | Shared domain layer. Win95 relocation to `retro/win95/`. Real TKA enums. Route stubs. | Nothing | **DONE** |
| **Phase 1** | DOS era (`/1989`). Command parser, ASCII renderer, menu system, all app modes. | Phase 0 | Not started |
| **Phase 2** | Win98 era (`/1998`). Win98 shell, enhanced renderer, all apps, Geocities bonus. | Phase 0 | Not started |
| **Phase 3** | WinXP era (`/2003`). Luna shell, vector renderer, corruption system, all apps, forum bonus. | Phase 0 | Not started |
| **Phase 4** | Cross-era polish. Lore consistency. Museum integration (abandoned wing, back room, projector, Kinetic Constructor artifact, defector's final note). | Phases 1-3 | Not started |

Each phase is independently deployable. Each route works standalone.

Phases 1-3 are independent of each other and can be built in any order. Each needs its own detailed implementation plan (like the Phase 0 plan).

---

## Key Design Decisions

1. **Shared domain, independent shells** — TKA data layer shared; every visual component is per-era
2. **Real TKA types** — Retro renderers consume the real domain enums (all orientations, grid modes, floats). Full notation capability in every era, not a simplified subset
3. **Separate routes** — `/1989`, `/1995`, `/1998`, `/2003` as standalone SvelteKit pages
4. **Skip app initialization** — All retro routes bypass Firebase, auth, DI container
5. **Full feature parity** — Every era implements all core capabilities with the full TKA type system
6. **Era-appropriate comedy** — Same joke structure, different cultural expression
7. **Corruption as narrative** — 2003 version tells the wipe story through artifacts, not cutscenes
8. **The defector thread** — One character connects all eras to the museum narrative
9. **Anonymous creator** — The modern reinvention has no named creator in the fiction. The player is the continuation
10. **Post-2003 is museum design, not a playable era** — Abandoned wing, back room, projector. Not interactive software
11. **The Kinetic Constructor** — Austen's real legacy PyQt app appears as an anonymous recovered artifact in the museum. Fish and all. No attribution
