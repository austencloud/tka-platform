---
status: backlog
value: 2
effort: L
remaining: Full build — Win98 route elevation
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# /1998 Route: TKA Constructor — Free Scribe Collective Edition

**Date:** 2026-03-27
**Status:** Draft

## Problem

The /1998 route is a placeholder — a teal page that says "Coming soon" and links back to /1995. The era config, lore strings, and timeline events are all defined and rich (the Leak, the Free Scribe Collective, DRM removal, underground identity), but zero components exist. No shell, no apps, no boot sequence.

## Goal

Build /1998 as a fully functional Windows 98 client for TKA — the rebel version. Same Firebase auth, same data, same generation engine as /1989, /1995, and the modern app. But the tone is different. This isn't the Order's clinical utility or their institutional OS. This is software that was stolen, reverse-engineered, and rebuilt by people who believe notation belongs to everyone.

## Naming

**TKA Constructor** — the Free Scribe Collective's name. "Constructor" is a declaration: this tool is for *making*, not archiving. The Order called it a Notation System. The rebels called it a Constructor.

In the era config: `title: "TKA Constructor 98"`, `subtitle: "Free Scribe Collective Edition"`.

## Relationship to /1995

/1998 reuses the Win95 **primitive components** (RetroButton, RetroWindow, RetroTextInput, RetroMenuBar, etc.) since Win98's UI chrome is nearly identical to Win95. The differences are:

1. **Visual:** Win98 is slightly more refined — gradient title bars, smoother bevels, toolbar icons with text labels, Active Desktop hints
2. **Tone:** Every piece of text reflects the Free Scribe Collective, not Bellweather
3. **Features:** Same apps, different branding and messaging
4. **Lore:** Rebellious, not institutional. "The Order doesn't want you to have this."

## Architecture

```
/1998 Route
├── src/routes/1998/+page.svelte          (renders Win98Desktop)
├── src/routes/1998/+page.ts              (ssr: false)
├── src/routes/1998/[...app]/+page.svelte (deep links)
├── src/routes/1998/[...app]/+page.ts
│
└── src/lib/features/retro/win98/
    ├── components/
    │   ├── shell/
    │   │   ├── Win98Desktop.svelte       (root shell — like RetroDesktop but FSC-themed)
    │   │   ├── Win98BootSequence.svelte  (rebel boot sequence)
    │   │   ├── Win98Taskbar.svelte       (Quick Launch bar, channel bar hints)
    │   │   ├── Win98StartMenu.svelte     (FSC branding on sidebar)
    │   │   └── Win98LoginDialog.svelte   (same auth, rebel tone)
    │   │
    │   ├── apps/
    │   │   (Reuse Win95 app components with era-aware props/config)
    │   │
    │   └── rendering/
    │       └── Win98CRTOverlay.svelte    (optional: less CRT, more LCD feel)
    │
    ├── state/
    │   └── win98-desktop-state.svelte.ts (same pattern as win95)
    │
    ├── services/
    │   └── Win98SoundManager.ts          (Win98-era sounds)
    │
    └── styles/
        ├── win98-tokens.css              (Win98 color palette, gradients)
        └── win98-overrides.css           (Win98 visual refinements)
```

### Reuse Strategy

The Win95 primitive components (RetroWindow, RetroButton, RetroTextInput, RetroMenuBar, RetroStatusBar, RetroTabControl, RetroDataGrid, RetroListBox, RetroTreeView, RetroProgressBar, RetroDialog, RetroToolbar, RetroSplitter, RetroDropdown, RetroCheckbox, RetroRadioButton, RetroTooltip) are **shared across Win95 and Win98**. They live in `retro/win95/components/primitives/` and get imported by both shells.

The Win95 app components (RetroScribe, RetroFileManager, RetroCards, RetroTutor, RetroControlPanel, RetroUpgrade) are also reusable — they accept configuration for era-specific text (window titles, menu labels, lore strings). The apps don't need to be duplicated, just wrapped with era context.

**Move primitives to shared:** The primitives should move from `retro/win95/components/primitives/` to `retro/shared/components/primitives/` since they serve both eras. This is a file move, not a rewrite.

### What's New for Win98

The shell components (desktop, taskbar, start menu, boot sequence) are the only truly new code. These define the visual and tonal identity of the era.

## Visual Differences from Win95

| Element | Win95 | Win98 |
|---------|-------|-------|
| Title bar | Flat navy blue (#000080) | Gradient blue (left dark → right lighter) |
| Start button | Gray, flat "Start" text | Raised, Windows flag icon + "Start" |
| Taskbar | 28px, flat gray | 30px, slightly raised, Quick Launch area |
| Desktop | Solid teal (#008080) | Darker teal or custom wallpaper |
| Window borders | Sharp 3D bevels | Slightly smoother bevels |
| Font | MS Sans Serif 8pt | Tahoma 8pt (Win98's default) |
| Toolbar | Icon-only buttons | Icon + text label buttons |
| Start menu sidebar | Dark blue, "TKA-OS v1.0" rotated | Dark blue, "TKA Constructor 98" rotated |
| Active Desktop | N/A | Optional: HTML content on desktop surface |

These are CSS-level differences applied through `win98-tokens.css`. The component structure is the same.

## Boot Sequence

The Win98 boot has a different character — it's not Bellweather's controlled institutional POST. It's a rebel startup.

```
TKA Constructor 98
Free Scribe Collective Edition

Loading...
████████████████████████████ 100%

This software was rebuilt from leaked Bellweather source.
The Order tried to suppress this knowledge. We said no.

Welcome to TKA Constructor 98.
```

Shorter, punchier than Win95's boot. No fake driver loading. No compliance checks. The rebels stripped all that out. The progress bar is smooth and fast — these are competent engineers, not bureaucrats.

Skippable via click (same as /1995).

## App Naming

Same apps, different identity:

| Win95 Name | Win98 Name | Why |
|------------|-----------|-----|
| TKA Notation System | TKA Constructor | Rebels renamed it |
| TKANOTTN.EXE | TKACON.EXE | New 8.3 name |
| FILEMGR.EXE | FILEMGR.EXE | Same (it's a file manager) |
| CARDS.EXE | CARDS.EXE | Same |
| TUTOR.EXE | TUTOR.EXE | Same (but FSC-authored content) |
| CONTROL.EXE | CONTROL.EXE | Same |
| UPGRADE.EXE | N/A | No upgrade nag — "this software is FREE" |
| README.TXT | README.TXT | FSC readme (the leak story) |
| HELP.HLP | HELP.HLP | FSC help |

**UPGRADE.EXE is removed.** The Free Scribe Collective doesn't charge. Instead, a "FREEDOM.TXT" file on the desktop contains the FSC manifesto.

## Lore: The Rebel Tone

The same "decoration, not the meal" rule applies. Normal software text for normal operations. But when lore shows up, it's different from Win95:

**Win95 (Order):**
- About: "© 1995 Bellweather Technical Institute. All rights reserved."
- Error: "Contact your Bellweather systems administrator."
- Register: "Submit Form 221-B to your department supervisor."

**Win98 (Free Scribe Collective):**
- About: "Maintained by the Free Scribe Collective. The Order doesn't want you to have this."
- Error: "The Order's DRM module has been removed. You're welcome."
- Register: "This software is FREE. As in freedom."

These strings already exist in `order-references.ts` under the `win98` key.

## Sound

Win98 had more refined sounds than Win95 — slightly longer, more musical, less harsh. The sound manager should use audio files styled after Win98's sound scheme but with a subtle edge — maybe slightly distorted, like they were ripped from a scratchy floppy disk.

## Easter Eggs

| Trigger | Result |
|---------|--------|
| Right-click desktop > Properties | Shows FSC wallpaper with hidden message in metadata |
| About dialog | Shows build number "4271" (the employee who leaked it) |
| Help > About > click logo 7 times | "Employee #4271 says hello." |
| DOOM | Still works (they're rebels, of course they included DOOM) |
| Type "ORDER" in any text field | Brief screen flicker, then nothing. No acknowledgment. |
| Start menu > Shut Down | "Are you sure? The Order would prefer that." |

## Real Functionality

Same as /1995 — every app is wired to real Firebase data through the shared DI services:

- **TKA Constructor** → real GenerationOrchestrator
- **FILEMGR.EXE** → real LibraryRepository
- **CARDS.EXE** → real library sequences
- **TUTOR.EXE** → real Learn module data
- **CONTROL.EXE** → real settings persistence
- **Recycle Bin** → real soft-delete

All through the same adapters created for /1995. The adapters are era-agnostic — they translate DI services to retro data shapes. The Win98 shell just renders them with different chrome and messaging.

## Implementation Order

1. **Move primitives to shared** — relocate Win95 primitives to `retro/shared/components/primitives/`
2. **Win98 shell** — Win98Desktop, Win98Taskbar, Win98StartMenu, Win98BootSequence
3. **Win98 styling** — win98-tokens.css, gradient title bars, Tahoma font
4. **Route setup** — +page.svelte renders Win98Desktop, add [...app] deep link route
5. **Wire apps** — Import same app components with era-aware config props
6. **Sound** — Win98SoundManager with era-appropriate audio
7. **Login** — Win98LoginDialog (same auth, FSC tone)
8. **Easter eggs** — Employee #4271, shut down message, etc.
9. **Lore injection** — About dialogs, README, HELP use win98 lore strings

## Dependencies

- **Plan 1 from /1995** (retro init, DI wiring, auth, adapters) must be complete
- **Shared primitives move** is a prerequisite for clean architecture
- Apps reuse the same adapters (notation-adapter, library-adapter, etc.)

## What This Achieves

Someone visits /1998 and gets a Windows 98 desktop. It looks slightly more refined than /1995. The boot is faster and punchier. The About dialog says "Free Scribe Collective" instead of "Bellweather Technical Institute." They generate a real sequence, browse their real library, save real data — all through the same Firebase backend. But the whole experience feels like underground software that was stolen from a government lab and rebuilt by idealists.

Three eras, one data layer. The Order's utility (/1989), the Order's OS (/1995), and the rebels' version (/1998). Same sequences. Different story.
