---
status: backlog
value: 3
effort: M
remaining: Full build — MCP tool for viewing sequences
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# View Sequence MCP Tool Design

## Goal

Let Claude open any TKA sequence directly in the 3D viewer from sequence data — no manual navigation required. Claude receives sequence data, encodes it to a URL, and navigates Chrome DevTools to it.

## Architecture

1. **MCP tool** (`view_sequence_3d`) in `flow-arts-knowledge` server
2. Takes `SequenceData` JSON → encodes via ported `SequenceEncoder` → returns URL
3. Claude navigates Chrome DevTools to the URL with `?render=3d`

## Implementation

### New files
- `mcp-server/src/tools/viewer-tools.ts` — tool registration (~50 lines)
- `mcp-server/src/tools/sequence-encoder.ts` — ported encoder (~250 lines)

### Modified files
- `mcp-server/index.ts` — register new tool

### What to port from web
- `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts`
- Only the `encode()`, `encodeWithCompression()`, and `generateSequenceRoutePath()` methods
- `LOCATION_ENCODE`, `ORIENTATION_ENCODE`, `TYPE_ENCODE` mappings
- LZString compression (npm package, works in Node.js)
- No DOM dependencies — it's all pure functions

### Usage flow
```
Claude: view_sequence_3d({ sequenceData: {...}, renderMode: "3d" })
MCP:    returns "http://localhost:5173/sequence/z:BZQ...?render=3d"
Claude: navigate_page({ url: "http://localhost:5173/sequence/z:BZQ...?render=3d" })
Claude: take_screenshot() → sees exact sequence in 3D viewer
```

## Estimated effort
- MVP (URL generation): 4-6 hours
- With Chrome DevTools integration: 1 day
- Full featured (auto-detection, presets): 2-3 days
