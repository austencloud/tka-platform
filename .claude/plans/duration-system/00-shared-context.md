# Musical Duration System - Shared Context

> This document provides shared context for all planning agents working on the duration system.
> Created: 2026-01-11 | Feedback ID: AYMHIvudhrRC0NWwWcUU

## Vision

Synchronize motion notation with music theory precision. Every pictograph can span any number of musical subdivisions, enabling flow artists to express timing with the same granularity musicians use.

## Core Concepts

### Musical Subdivisions

In 4/4 time, one beat subdivides as: **1 e & a**

| Symbol | Name | Position in beat |
|--------|------|------------------|
| 1 | Downbeat | 1st subdivision |
| e | Eighth-and | 2nd subdivision |
| & | And | 3rd subdivision |
| a | Ah | 4th subdivision |

A full measure in 4/4: `1 e & a 2 e & a 3 e & a 4 e & a` (16 subdivisions)

### Duration as Subdivision Count

- **Duration = number of subdivisions a pictograph spans**
- Default duration = 4 (one full beat: "1 e & a")
- Minimum = 1 (single subdivision)
- No maximum (can span multiple beats/measures)

### Examples

| Pictographs | Durations | Musical Coverage |
|-------------|-----------|------------------|
| A | 4 | 1 e & a |
| B, C, D, E | 1, 1, 1, 1 | 2, 2e, 2&, 2a |
| F | 3 | 3 e & |
| G | 1 | a |
| H | 6 | 4 e & a 1 e |

### Time Signature Flexibility

Must support:
- **Simple time**: 4/4, 3/4, 2/4 (subdivisions in groups of 4)
- **Compound time**: 6/8, 9/8, 12/8 (subdivisions in groups of 3)
- **Triplet feels**: 3 subdivisions per beat instead of 4
- **Custom**: User-defined subdivisions per beat

---

## Legacy App Analysis

**Location**: `F:\_THE KINETIC ALPHABET\_ARCHIVE\_LEGACY_DESKTOP_APP\modern`

### What Existed

| File | What It Had |
|------|-------------|
| `beat_data.py` | `duration: float = 1.0` property |
| `sequence_data.py` | `total_duration` property (sum of beat durations) |
| `beat_data_builder.py` | `with_duration()` method, start positions = 0.0 |
| `sequence_validator.py` | Validates duration > 0 |

### What Was Missing

- No playback/animation timing
- No BPM/tempo integration
- No visual scaling based on duration
- No subdivision notation system
- Unclear semantics (beats? seconds? arbitrary units?)

### Key Insight

Legacy stored duration but never used it. We're building what it intended.

---

## Current TKA-SCRIBE Systems to Integrate

### BPM System
- Already has BPM chips for tempo selection
- No new tempo UI needed
- Duration system should integrate with existing BPM for playback calculations

### Compose Module Timeline
- Has comprehensive timeline editor
- Visual representation of sequence over time
- Potential integration point, but NOT required for Create module

### Create Module
- Where users build sequences beat-by-beat
- Needs intuitive duration editing
- Should NOT require Compose module complexity
- Must feel modern (not dropdown menus)

### Beat Display
- Currently shows "Beat 1", "Beat 2", etc.
- Needs to show musical position: "1", "2e", "3&", "4a"
- Position depends on where pictograph starts in the measure

### Playback/Animation
- Pictographs animate in sequence
- Duration should control how long each displays
- At 120 BPM, one beat = 500ms, so duration=4 means 500ms, duration=2 means 250ms

---

## Design Constraints

### Must Have
- Integer durations (subdivision counts, not floats)
- Time signature stored per sequence
- Beat display shows musical notation
- Playback respects duration
- Intuitive Create module editing

### Must NOT Have
- New BPM UI (use existing chips)
- Dropdown menus for duration selection
- Forced Compose module usage for timing
- Breaking changes to existing sequences (graceful migration)

### Open Questions for Planning Agents

1. **Data Model**: Where does time signature live? Sequence level? Global setting?
2. **Display**: How to handle positions that span beat boundaries? (e.g., "4a-1e")
3. **Playback**: How to calculate ms from duration + BPM + subdivisions-per-beat?
4. **UX**: What's the most intuitive way to adjust duration in Create module?

---

## Planning Workstreams

### Stream 1: Data Model & Core Domain
- Duration representation in Beat model
- Time signature types and storage
- Subdivision calculations
- Migration strategy for existing sequences

### Stream 2: Display & Notation
- Musical position calculation
- Beat number display format
- Handling multi-beat spans
- Visual indicators for duration

### Stream 3: Playback & Animation
- Duration to milliseconds conversion
- BPM integration
- Animation timing engine changes
- Tempo-aware playback

### Stream 4: Create Module UX (After Streams 1-3)
- Intuitive duration editing interface
- Quick adjustment without complexity
- Modern interaction patterns

---

## File Locations for Plans

Each planning agent should write to:
- `01-data-model-plan.md` - Data & Domain
- `02-display-notation-plan.md` - Display & Notation
- `03-playback-animation-plan.md` - Playback & Animation
- `04-create-ux-plan.md` - Create Module UX (follow-up)

---

## Success Criteria

When complete, a user should be able to:
1. Create a sequence where pictograph A lasts "1 e & a" and B lasts "2 e"
2. See beat display show "1" for A and "2e" for B
3. Play the sequence and see A display 4x longer than B
4. Adjust timing intuitively in Create module without dropdown menus
5. Use any time signature (4/4, 3/4, 6/8, triplets)
