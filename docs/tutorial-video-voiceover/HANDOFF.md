# TKA Tutorial Voiceover — Agent Handoff

**Purpose:** pick up the TKA tutorial-video voiceover project from any machine.
**Last updated:** 2026-07-16 · **Status:** scripts complete (1–7, DJ, EK×2, FL); DRAFT guideline scripts 12–22 added (`Voiceover-Scripts-Next.md`, awaiting Austen's body-knowledge pass); production/editing not started.

---

## ⚠️ Read first — what's in the repo vs local-only

This project's **media lives on the original Windows machine, NOT in this repo**:

| Where | What |
|---|---|
| **In this repo** (`docs/tutorial-video-voiceover/`) | The rewritten voiceover **scripts**, all **transcripts** (final-cut + raw), the video **index**, and this handoff. All text — editable remotely. |
| **Local-only (Windows, D:\ drive)** | Every `.mov`/`.mp4` (final renders + raw footage), the `.wav`s, and the full production workspace. A remote agent **cannot** touch the video. |

So remotely you can: refine scripts, refine this plan, prep edit instructions.
Video editing (mute original audio, lay VO over the demo footage) must happen on
the local machine where the media is.

**Local workspace (source of truth for media/tooling):**
`D:\_THE KINETIC ALPHABET\_TUTORIALS\_PRODUCTION\` — has `SPEC.md` (fuller local
spec), `tools\` (transcription pipeline), `Transcripts\`, wavs.

## The project in one paragraph

Austen's old TKA tutorial videos are being finished the low-stress way: **keep the
demo footage from the existing final renders (or the raws), mute the original
audio, record new tightened voiceover over it.** The 11 scripts are written and
verified. What remains is the actual edit/record, plus sourcing/organizing raws.

## Deliverables in this folder

| File | What |
|---|---|
| `Voiceover-Scripts.md` | The 11 rewritten scripts (reels 1–7, DJ, EK Tog-Opp, EK Split-Opp, FL) |
| `Voiceover-Scripts-Next.md` | DRAFT guideline scripts 12–22 (G/H/I, Gamma, S/T/U+V, MP/NQ/OR, Type 1 wrap) — MCP-grounded skeletons with `[AUSTEN: ...]` slots for body knowledge; no footage exists for these |
| `Voiceover-Scripts.html` | Same, as a readable page |
| `transcripts/` | Verbatim transcripts — final cuts + the mapped RAW sessions |
| `Master-Video-Index.csv` | All 103 videos under `_THE KINETIC ALPHABET` (paths, dates, sizes) |
| `HANDOFF.md` | This file |

## Locked decisions

- **Lift + voiceover** off the final renders / raws (raws optional; finals are clean).
- Scripts keep Austen's teacher voice; filler / false starts / repeated count-runs
  cut; **beat counts kept** (load-bearing for movement tutorials).
- Terminology preserved and grounded against the Flow Arts knowledge base (MCP).
- Organization: workspace references media **in place** — no large file moves.
- The finished **Grid** script runs alpha→beta→gamma (original video cut off at alpha).

## Grounded domain facts (verified via MCP — do not re-derive)

- Position map: **A–F end alpha, G–L end beta, M–V end gamma.** ABC alpha→alpha,
  DEF beta→alpha, JKL alpha→beta.
- In every Type-1 VTG group the triple order is **iso-iso / anti-anti / hybrid**
  (so A/B/C and J/K/L share the shape).
- **Compounds** close a LOOP (beta→alpha→beta): **DJ** = D+J pro/pro = isolation
  loop (cousin of A); **EK** = E+K anti/anti = anti-spin loop (cousin of B);
  **FL** = F+L hybrid = hybrid loop (cousin of C).
- Split-opp vs tog-opp is **vantage-relative** — same loop, different entry phase.
- alpha 180° apart · beta 0° together · gamma 90° right angle.

## Source videos & clip → tutorial map

**Final renders (the primary edit sources), on the local machine:**
`D:\_THE KINETIC ALPHABET\_TUTORIALS\` → `First series - 1 thru 7\Individual Vids - HD\1..7`,
`DJ\DJ - FINAL FINAL FINAL - 1080.mp4`, `EK\Final Videos\1080\*` (Tog-Opp, Split-Opp).
Plus `First series...\TKA_tut_full_fixed_audio.mp4` (full combined first-series cut).

**Raw footage — CONFIRMED map (via live-narration transcription; raws in `transcripts/RAW ...`):**
- **First series (all of 1–7)** = one 52-min continuous take — `D:\PICTURES2\iCloud Photos\Photos\2024-04-18 20-51-09 RTMY ...(1).mov` (#15).
- **DJ** = `2024-04-23 14-40-35 RURF ...mov` (#23, 22 min).
- **EK Tog-Opp** = the `2024-04-29 14-56-50 Q0JB ...` clips (#11 continuous, #12 intro).
- **FL** = `D:\Downloads\Photos-1-001.zip` — 5 clips, all **2024-07-24** (Q0YX ×4 ~8 min each + QJAY 1.1GB). FL was shot ~3 months after the April sessions.

**Raw availability gotcha:** the April raws are in **iCloud Photos** (`D:\PICTURES2\iCloud Photos\Photos\`).
Only ~12 of ~36 are hydrated on disk; the rest are **online-only placeholders**
(reading them does NOT trigger download — iCloud for Windows isn't hydrate-on-access).
To use an offline clip: File Explorer → "Always keep on this device", or iCloud
app → download originals. Not blocking — the **final renders** already carry clean
demo footage for every video.

## Next actions (priority order)

1. **Edit/record.** For each reel: open the final render (or mapped raw), mute the
   original audio, record the script (in `Voiceover-Scripts.md`) as VO over the
   demo. Beat counts in the script stay in sync with the on-screen demo.
   - **Grid coverage gap:** the finished Grid ending (alpha→beta, alpha→gamma) has
     no matching footage in the existing renders (gamma demos = M–V, never filmed).
     Shoot those two ~10-sec demos fresh, or trim them. Note: draft script 15
     (Gamma, in `Voiceover-Scripts-Next.md`) opens with the same alpha→gamma demo —
     shooting for video 15 produces the Grid-gap footage for free.
2. **Hydrate remaining iCloud raws** (local machine) only if better/longer takes are
   wanted than the finals — otherwise skip.
3. **Publish the readable page** — `Voiceover-Scripts.html` (a claude.ai artifact
   backend was 500ing during authoring; local file is current).
4. **Review the next-series drafts** — `Voiceover-Scripts-Next.md` (added
   2026-07-16) holds guideline scripts 12–22 completing Type 1. Austen fills the
   `[AUSTEN: ...]` body-knowledge slots and answers the "Open domain questions"
   list at the bottom; the conceptual spoken text is already MCP-grounded.
5. **Word videos** (future, catalogued in the CSV): 92 clips under `_WORD_VIDEOS`,
   buckets `Posted` / `To re-record` / `To repost with pictographs` — not started.

## Tooling (local machine only — needs the media)

- `py` (Python 3.13) + `faster-whisper` (`small.en`, CPU int8) + `imageio-ffmpeg`
  (bundled ffmpeg; no system ffmpeg). Scripts in the local workspace `tools\`:
  extract 16kHz mono WAV, then transcribe. ~30 min audio → a few min on CPU.
- Use it to transcribe any newly-hydrated raw; the transcript's content (letters /
  "DJ" / "EK" / "FL" / "negative space") names the tutorial.
