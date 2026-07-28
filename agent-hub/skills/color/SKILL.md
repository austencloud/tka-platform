---
name: color
description: Assign the current Claude or Codex terminal the first unused Agent Hub background color, or reapply its existing lease. Use when the user invokes /color or $color, asks to color or tint this session, or says this terminal lost its assigned background.
---

# Assign Terminal Color

Run this command once:

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -Command '& "$env:LOCALAPPDATA\AgentHub\bin\AgentTerminalSession.exe" -ApplyCurrentColor'
```

Do not choose a color yourself, edit Windows Terminal settings, focus another
window, or send input to a terminal. The helper reuses this session's Agent Hub
lease. Outside an Agent Hub launch, it atomically claims the first free color
and holds that lease until the current Claude or Codex process exits.

Report the helper's single result line. If it fails, report the error and stop.
