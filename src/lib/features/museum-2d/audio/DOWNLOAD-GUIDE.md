# Museum Soundscape Download Guide

All sounds need manual download (Freesound requires login, Pixabay is direct).

## Quick Download List

### CC0 (No Attribution Required)

| Wing | File to Save As | Source | Duration |
|------|----------------|--------|----------|
| Entrance Lobby | `entrance-ambient.wav` | [Empty Office Room Tone](https://freesound.org/people/richwise/sounds/456207/) | 7:52 |
| Vulcan Cave | `cave-ambient.wav` | [Water Dripping in Cave](https://freesound.org/people/Sclolex/sounds/177958/) | 1:30 |
| Egyptian Wing | `egyptian-ambient.wav` | [Gentle Wind on Desert Plain](https://freesound.org/people/dhallcomposer/sounds/697217/) | 0:41 |
| Renaissance | `renaissance-ambient.wav` | [Pencil Scratch 1](https://freesound.org/people/OwlStorm/sounds/320151/) | 0:30 |
| Digital Wing | `digital-ambient.wav` | [Dial-up Internet](https://freesound.org/people/wtermini/sounds/546450/) | 0:29 |
| Suppression | `suppression-ambient.mp3` | [Fluorescent Buzzing](https://freesound.org/people/Rvgerxini/sounds/474312/) | 0:04 |
| K's Gallery | `gallery-ambient.wav` | [Music Box Melody 1](https://freesound.org/people/DRFX/sounds/338986/) | 0:16 |
| Room of Fear | `fear-ambient.wav` | [Quasi Drone](https://freesound.org/people/bassimat/sounds/840934/) | 10:08 |
| Isolation | `isolation-ambient.wav` | [Ambient Low Hum](https://freesound.org/people/TimBahrij/sounds/234918/) | 0:58 |
| Collaboration | `collaboration-ambient.wav` | [Forest Birds Loop](https://freesound.org/people/Magnesus/sounds/723913/) | 0:27 |
| VTG Wing | `vtg-ambient.wav` | [Dripping Water](https://freesound.org/people/Electroviolence/sounds/234554/) | 0:33 |
| Construction | `construction-ambient.mp3` | [Fluorescent Buzzing](https://freesound.org/people/Rvgerxini/sounds/474312/) | 0:04 |
| Janitor | `janitor-ambient.wav` | [Ambient Low Hum](https://freesound.org/people/TimBahrij/sounds/234918/) | 0:58 |

### CC-BY-4.0 (Attribution Required)

| Wing | File to Save As | Source | Duration |
|------|----------------|--------|----------|
| The Crumble | `crumble-ambient.wav` | [Windy Creaky House](https://freesound.org/people/pfranzen/sounds/393808/) | 4:07 |

### Manual Search Required (Pixabay)

| Wing | File to Save As | Search On Pixabay |
|------|----------------|-------------------|
| Victorian | `victorian-ambient.mp3` | [clockwork](https://pixabay.com/sound-effects/search/clockwork/) or [steampunk](https://pixabay.com/sound-effects/search/steampunk/) |
| Gift Shop | `giftshop-ambient.mp3` | [muzak](https://pixabay.com/music/search/muzak/) or [elevator](https://pixabay.com/music/search/elevator/) |

### Layer Sounds (Optional)

| ID | Source | For Wings |
|----|--------|-----------|
| Paper Rustling | [HarpyHarpHarp/449127](https://freesound.org/people/HarpyHarpHarp/sounds/449127/) | Renaissance, Suppression |
| Paper Shuffling | [bevibeldesign/635156](https://freesound.org/people/bevibeldesign/sounds/635156/) | Suppression |
| Modem Sounds | [joedeshon/80288](https://freesound.org/people/joedeshon/sounds/80288/) | Digital (CC-BY) |

## Post-Download

Convert large WAV files to MP3:
```bash
ffmpeg -i input.wav -codec:a libmp3lame -b:a 192k output.mp3
```

Target: under 2MB per file for web delivery. The Room of Fear drone (10 min) and Entrance (8 min) will need compression.
