# TKA pronunciation recording guide

The workspace reads a word as a list of TKA letter names. It uses human audio only when every letter in that word has the right contextual take. If one take is missing or fails to load, the complete word goes to browser speech synthesis. A word never changes voices halfway through.

## Record four takes for every letter

Each letter needs four complete spoken forms:

| Take       | Delivery                                         | Carrier phrase                                  |
| ---------- | ------------------------------------------------ | ----------------------------------------------- |
| `isolated` | Neutral, complete, no implied continuation       | Say the letter by itself.                       |
| `initial`  | Opens the list with a light continuation contour | “{letter}, beta, gamma.” Keep the first item.   |
| `medial`   | Level list contour, connected on both sides      | “alpha, {letter}, gamma.” Keep the middle item. |
| `final`    | Settled terminal contour                         | “alpha, beta, {letter}.” Keep the last item.    |

Record every dash form as a whole name. `Sigma dash`, for example, gets its own four takes. Do not splice `Sigma` and `dash`; that seam removes the coarticulation that makes a voice sound human.

The final contour belongs to the complete spoken name. In a final `Sigma dash`, let the pitch settle naturally across `Sigma dash`; do not force a separate drop onto the word `dash`. The initial contour is a restrained continuation, not a question. The medial contour is near-level. Read speech is not perfectly flat, so keep the delivery conversational instead of trying to hold a fixed musical note.

Each context has one production slot. Record another pass when articulation, noise, or contour is wrong, then choose one. Do not ship two or three interchangeable variants per slot unless the player also gains a deliberate variant-selection model; random variants make the joins less predictable without adding useful context.

The carrier phrases are prompts, not audio assets. Keep the target word’s natural lead-in and release when cutting it out. Use 20–40 ms of clean room tone at the edges and short equal-power fades to prevent clicks.

## Session setup

- Capture one continuous mono session at 48 kHz, 24-bit. Export delivery clips as 48 kHz, 16-bit PCM WAV.
- Keep the microphone, chair, mouth angle, preamp gain, and room fixed for the full alphabet. Place the microphone about 15–20 cm away and slightly off-axis behind a pop filter.
- Disable automatic gain control, noise suppression, and room effects. Record at least ten seconds of room tone before the first take.
- Keep one approved pass per context. Retake freely while auditioning, but replace the slot instead of accumulating runtime variants.
- Normalize the session as a batch around -18 LUFS with true peaks no higher than -1 dBTP. Do not loudness-normalize every short clip independently; that erases the level relationships inside the performance.
- Use light corrective editing only: remove clicks, trim subsonic rumble, and apply the same processing chain to the entire session. Heavy gating and denoising make the joins obvious.

The -18 LUFS target follows the AES recommendation for virtual-assistant voice content. ITU-R BS.1770 defines the loudness and true-peak measurements.

## File layout

Place the delivery files under `static/audio/pronunciations/v1`:

```text
static/audio/pronunciations/v1/
  a/
    isolated.wav
    initial.wav
    medial.wav
    final.wav
  sigma-dash/
    isolated.wav
    initial.wav
    medial.wav
    final.wav
```

Asset keys come from the canonical letter member names: `A` becomes `a`, `SIGMA_DASH` becomes `sigma-dash`, and `TERRA` becomes `terra`.

After adding or replacing clips, run:

```powershell
pnpm exec tsx scripts/build-pronunciation-manifest.ts
```

The generator rejects unknown directories and filenames, then reports coverage across all contextual cues. Commit the WAV files and the updated `manifest.json` together.

The Lab → Pronunciation tool handles this layout directly. Choose `static/audio/pronunciations/v1`, connect the studio microphone, read each carrier phrase, adjust the proposed waveform crop, and approve the take. It writes a 48 kHz, 16-bit mono delivery WAV and rebuilds the manifest after every approval. Without direct folder access, it keeps approved takes in the current tab and exports the session as a ZIP.

## Listening pass

Check more than isolated files. Build a listening set with:

- every two-letter boundary at least once across the batch;
- short words of two to four letters;
- long words with repeated letters and dash forms;
- compressed workspace labels containing a middle dot;
- headphones, phone speaker, and laptop speaker playback.

Listen for boundary clicks, level jumps, clipped consonants, uneven gaps, and a final take that fails to settle. Replace the source take when the contour is wrong; stretching or pitch-shifting a mismatched take usually makes the join more mechanical.

## Why this structure

Limited-domain concatenative speech research consistently finds that longer, context-aware units sound more natural than small fragments because they preserve coarticulation. Four list positions capture the most audible phrase contour without requiring a recording for every possible pair of TKA letters. The runtime schedules the chosen WAV files through one Web Audio clock with fixed inter-letter and inter-group spacing.

## Research sources

- [Six approaches to limited-domain concatenative speech synthesis](https://www.isca-archive.org/interspeech_2006/utama06_interspeech.html)
- [Combining the flexibility of speech synthesis with the naturalness of prerecorded audio](https://www.isca-archive.org/interspeech_2005/hamza05b_interspeech.html)
- [Prosodic phrase boundaries in English read speech](https://www.isca-archive.org/speechprosody_2020/herment20_speechprosody.html)
- [Using prosodic categories in unit-selection speech synthesis](https://www.isca-archive.org/icslp_2000/wightman00_icslp.html)
- [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
- [AES TD1008: Recommendations for loudness of internet audio streaming and on-demand distribution](https://aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf)
- [ITU-R BS.1770: Algorithms to measure audio programme loudness and true-peak audio level](https://www.itu.int/rec/R-REC-BS.1770/en)
