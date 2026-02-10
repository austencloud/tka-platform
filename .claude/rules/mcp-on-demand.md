# MCP Servers: Off by Default

MCP servers are **disabled by default** to save memory. Each server costs ~100-200 MB, and with multiple Claude Code sessions running, this adds up fast.

## When MCP Tools Are Needed

If a task requires MCP tools (TKA rendering, browser inspection, etc.), **tell the user to relaunch with them enabled.**

### TKA Domain Tools Needed When:
- User asks to generate/render a pictograph or sequence
- User asks to view letter data, variations, or alphabet info
- User asks for sequence feasibility analysis

**Say:** "This needs the TKA domain MCP server. Relaunch this session with MCP enabled: edit `.claude/settings.local.json` and add `"tka-domain"` to `enabledMcpjsonServers`, then restart."

### Chrome DevTools Needed When:
- User asks to inspect the running app in browser
- User asks for runtime state, console logs, or screenshots via DevTools
- User grants Playwright/browser automation permission

**Say:** "This needs the Chrome DevTools MCP server. Add `"chrome-devtools"` to `enabledMcpjsonServers` and restart."

### What NOT To Do
- Do NOT suggest workarounds that bypass MCP (bash scripts, manual rendering, etc.)
- Do NOT claim you can use MCP tools if they're not loaded
- Do NOT enable MCP servers yourself by editing settings mid-session (won't take effect)

## Enabling MCP Servers

In `.claude/settings.local.json`, add server names to the array:

```json
"enabledMcpjsonServers": ["tka-domain", "chrome-devtools"]
```

Available servers (defined in `.mcp.json`):
- `tka-domain` - TKA alphabet rendering and data (~95 MB)
- `chrome-devtools` - Browser inspection and automation (~185 MB with watchdog)

## Quick Toggle

User can say "enable MCP" or "I need domain tools" and Claude should walk them through the settings edit + restart.
