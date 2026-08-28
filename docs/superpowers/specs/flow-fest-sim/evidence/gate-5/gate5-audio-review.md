# Flow Fest Gate 5 audio boundary review

Captured 2026-08-27 against `/test/flow-fest-sim?gate5=1&capture=1`.

## One continuous soundscape

Gate 5 extends the Gate 4 procedural sound owner instead of starting and stopping tracks at area boundaries. One gesture-created `AudioContext` builds three deterministic, looping sources. Location and fire-jam state only move gain targets for six layers:

- arrival field
- woodland
- selected camp
- fire circle
- LED circle
- festival crowd

The gain changes use `setTargetAtTime`, so crossing a boundary changes the mix without rebuilding the graph. The shared scene-audio state remains the mute and master-volume owner.

## Browser proof

The captured lower-tent itinerary recorded these dominant layers:

| Registered location      | Dominant layer | Graph builds | Long-lived source starts |
| ------------------------ | -------------- | -----------: | -----------------------: |
| Lower gate               | arrival field  |            1 |                        3 |
| Lower camp               | camp           |            1 |                        3 |
| Middle Earth fire circle | fire circle    |            1 |                        3 |
| Returned lower camp      | camp           |            1 |                        3 |

The final browser state remained `audioUnlocked=true`, `audioPlaying=true`, `graphBuilds=1`, and `sourceStarts=3` after festival exit, re-entry, and the night return. Reload correctly restored world state while requiring a new audio gesture.

## Scope boundary

This is a deterministic zone-mixed procedural bed, not HRTF positional audio and not a field-recorded final mix. It proves continuous ownership, gesture-safe playback, master mute persistence, and boundary crossfades without claiming production sound assets that do not exist.
