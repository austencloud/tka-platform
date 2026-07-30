---
name: colorall
description: Restore every live Claude and Codex terminal's assigned Agent Hub background color in one pass. Use when the user invokes /colorall or $colorall, asks to recolor all agent terminals, or says several sessions lost their colors.
---

# Restore All Terminal Colors

Run this command once:

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -Command '& "$env:LOCALAPPDATA\AgentHub\bin\AgentTerminalSession.exe" -ApplyAllColors'
```

Do not enumerate processes yourself, choose colors, focus other windows, or send
input to another terminal. The helper finds every live Agent Hub session,
reuses its assigned lease, and requests Administrator approval only when an
elevated terminal needs to be recolored.

Report the helper's complete result. If it fails, report the exact error and
stop.
