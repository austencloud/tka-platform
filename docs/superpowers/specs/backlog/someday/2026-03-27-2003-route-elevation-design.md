---
status: backlog
value: 2
effort: L
remaining: Full build — XP route elevation
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# /2003 Route: OpenTKA — The Last Version Before Silence

**Date:** 2026-03-27
**Status:** Draft

## Problem

The /2003 route is a placeholder — deep blue page saying "Coming soon." Era config, lore, and timeline events are defined. Zero components. This is the final pre-silence era: open source, 47 contributors, 12,841 downloads, confident, doomed.

## Goal

Build /2003 as a fully functional Windows XP client for TKA — the open source community version, the most polished pre-modern era. Same Firebase auth, same data, same generation engine. But this version knows it's about to die. The shutdown messages say "They're here. Sending what I can. Remember us."

## Naming

**OpenTKA** — the open source community's name. SourceForge era naming. The rebels' "Constructor" became the community's "OpenTKA." Open source, open access, open everything. Licensed under the "Free Notation Public License (FNPL)."

In the era config: `title: "TKA Composer XP"` → update to `"OpenTKA"`, `subtitle: "Open Source Community Edition"`.

## The Tone: Confident and Doomed

This is the most bittersweet era. By 2003:
- 47 contributors have built real features
- 12,841 downloads worldwide
- The software is genuinely good — better than the Order's original
- They're proud. They should be.
- Protocol Lethe is about to erase all of it.

The UI should feel **competent and confident** — this is the best version of the software before the modern era. XP's Luna theme is bright, friendly, optimistic. The community believed they'd won.

The doom shows only in cracks:
- Shutdown messages reference "unusual network activity"
- Error messages mention "external tampering" and "file integrity check failed"
- Easter eggs: "If you find this after the wipe, know that we tried"
- The clock reads 3:47 PM (same as /1995 — the moment Lethe fired)

## Relationship to Other Eras

```
/1989 TKAUTIL.COM    — The Order builds it (institutional, clinical)
/1995 TKA Notation   — The Order ships it (institutional, polished)
/1998 TKA Constructor — Rebels steal and rebuild it (rebellious, underground)
/2003 OpenTKA        — Community perfects it (confident, doomed)
      ~~~ 23 years of silence ~~~
/     TKA Composer    — Someone picks it back up (modern)
```

## Architecture

Same pattern as /1998 — reuse shared primitives, create era-specific shell.

```
src/lib/features/retro/winxp/
├── components/
│   ├── shell/
│   │   ├── XPDesktop.svelte          (Luna theme desktop)
│   │   ├── XPBootSequence.svelte     (XP boot with progress bar)
│   │   ├── XPTaskbar.svelte          (XP-style with grouped windows)
│   │   ├── XPStartMenu.svelte       (Two-column XP start menu)
│   │   └── XPLoginDialog.svelte     (XP welcome screen style)
│   │
│   ├── apps/
│   │   (Reuse shared app components with era config)
│   │
│   └── rendering/
│       └── XPVisualStyle.svelte     (Luna theme CSS injection)
│
├── state/
│   └── xp-desktop-state.svelte.ts
│
├── services/
│   └── XPSoundManager.ts           (XP-era sounds — the iconic startup)
│
└── styles/
    ├── xp-tokens.css               (Luna blue, green start button, rounded corners)
    └── xp-overrides.css
```

## Visual Identity: Windows XP Luna Theme

XP was a massive visual departure from 98/95. The Luna theme is instantly recognizable:

| Element | XP Luna Style |
|---------|--------------|
| Title bar | Rounded top corners, blue gradient with glossy effect |
| Start button | Green, rounded, "start" in white italic |
| Taskbar | Blue gradient, grouped window buttons |
| Start menu | Two-column: left = recent apps, right = system links |
| Desktop | Rolling green hills wallpaper (or equivalent TKA themed) |
| Window borders | Rounded corners, blue frame, drop shadow |
| Buttons | Rounded, subtle gradient, hover glow |
| Font | Tahoma 8pt (same as 98), but with ClearType hint |
| Colors | Luna blue (#0054E3), green start (#3C9A2F), white panels |

This is a bigger CSS job than /1998 (which is essentially /1995 with gradients). XP Luna requires:
- Rounded corners on windows and buttons
- Blue gradient frames
- Drop shadows on windows
- Green Start button
- Two-column Start menu layout
- Grouped taskbar buttons

## Boot Sequence

XP has the most recognizable boot of all Windows versions: the scrolling progress bar on a black screen with the Windows flag.

```
[Black screen]
[OpenTKA logo — a stylized spiral]

[Progress bar scrolls left to right, repeating]

OpenTKA
Open Source Community Edition
47 contributors | v3.2.1
```

Clean, confident, fast (~6 seconds). No institutional disclaimers, no rebel manifestos. Just a well-made piece of software booting up. The community doesn't need to justify itself anymore.

## Start Menu: Two-Column XP Style

**Left column:** Recently used apps (pinned)
- OpenTKA (composer)
- File Manager
- Cards Viewer
- Tutorial

**Right column:** System links
- My Sequences (opens file manager)
- My Cards
- Control Panel
- Help and Support
- Search
- SourceForge Project Page (easter egg — "Page not found")

**Bottom:** Log Off | Shut Down

The sidebar says "OpenTKA" vertically in the XP blue gradient style.

## App Naming

| App | XP Name | Notes |
|-----|---------|-------|
| Composer | OpenTKA | The main app |
| File Manager | File Manager | Explorer-style, XP visual |
| Cards | Cards Viewer | Same functionality |
| Tutorial | Help & Learning | More polished than previous eras |
| Control Panel | Control Panel | XP-style categorized view |
| Upgrade | N/A | Open source — no upgrade nag |
| README | About OpenTKA | Project info, contributor list |

## Lore: Confidence With Cracks

Normal software text everywhere. Error messages are clear and helpful — this is the most user-friendly era. But the cracks show:

**Normal operation:** Reads like any well-made XP app. Professional, clean, helpful.

**Error messages (from lore):**
- "WARNING: Network anomaly detected in sector 7-G"
- "File integrity check failed — possible external tampering"
- "Connection to SourceForge mirror lost. Retrying..."

These aren't random errors. They're the first signs of Protocol Lethe. The user probably won't notice on first visit. On second visit, after learning the story, these hit differently.

**Shutdown (from lore):**
- "Saving session state..."
- "WARNING: Unusual network activity detected."
- "They're here. Sending what I can. Remember us."

The shutdown sequence is the most emotionally loaded moment in all four eras. The user clicks "Shut Down" and watches the community's last words scroll by.

**Easter eggs (from lore):**
- "If you find this after the wipe, know that we tried."
- "The notation is in the movement, not the software."
- "47 contributors. 12,841 downloads. They can't erase all of us."

## Sound

XP had the most iconic startup sound in Windows history — the ascending chime. The OpenTKA version should reference it but be its own thing. Slightly warmer, slightly more human. The community's sound, not Microsoft's.

## Easter Eggs

| Trigger | Result |
|---------|--------|
| Click "SourceForge Project Page" | "Error 404: Page not found. The mirror is down." (it's been wiped) |
| Help > About > Contributors | Lists 47 fake contributor names. Last entry: "Employee #4271 (founding contributor)" |
| Shut Down | The full doomed shutdown sequence (lore strings) |
| DOOM | Works. Every era has DOOM. |
| Clock | 3:47 PM. Always. Same moment across all eras. |
| Control Panel > Date/Time | Date shows March 2003. Can't be changed. |
| Right-click desktop > "Last updated" | "March 14, 2003. No updates since." |
| Open 47 windows | "47 contributors couldn't prevent this many windows." |
| Search for "Lethe" | "0 results found. (Are you sure that's a word?)" |

## Real Functionality

Same as /1995 and /1998 — all apps wired to real Firebase:

- **OpenTKA** → real GenerationOrchestrator
- **File Manager** → real LibraryRepository
- **Cards Viewer** → real library sequences
- **Help & Learning** → real Learn module data
- **Control Panel** → real settings persistence
- **Recycle Bin** → real soft-delete

Same shared adapters. Different shell.

## The 3:47 PM Detail

All four eras have clocks frozen at 3:47 PM. This is never explained in any era. It's the moment Protocol Lethe fired. If someone visits all four eras and notices the clocks match, they've found one of the deepest lore threads without a single word of exposition.

## Implementation Order

1. **XP shell** — XPDesktop, XPTaskbar, XPStartMenu, XPBootSequence
2. **Luna styling** — xp-tokens.css, rounded corners, gradients, drop shadows, green start button
3. **Route setup** — +page.svelte renders XPDesktop, add [...app] deep link route
4. **Wire apps** — Import shared app components with XP-era config
5. **Two-column Start menu** — The distinctive XP layout
6. **Sound** — XPSoundManager with era-appropriate audio
7. **Login** — XPLoginDialog (XP welcome screen style)
8. **Shutdown sequence** — The emotionally loaded Lethe moment
9. **Easter eggs** — SourceForge 404, contributor list, date freeze
10. **Lore injection** — About dialogs, error messages with Protocol Lethe hints

## Dependencies

- **Plan 1 from /1995** (retro init, DI wiring, auth, adapters)
- **Shared primitives** (moved from win95 to shared in /1998 plan)
- Same adapters as /1995 and /1998

## What This Achieves

The most polished, most confident, most heartbreaking era. Someone uses OpenTKA and it feels like the best version of the software — clean XP interface, fast boot, helpful UI, 47 contributors' worth of care. Then they click Shut Down and read: "They're here. Sending what I can. Remember us."

Then they navigate to `/` and realize: someone picked it back up. Twenty-three years later. The notation survived.

Four eras. One data layer. One story.
