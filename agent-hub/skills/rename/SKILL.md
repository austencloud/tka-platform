---
name: rename
description: Use when the user types /rename or /rn, or asks to rename, retitle, or name this Claude Code session or terminal. Chooses a short Title Case name and applies it without window-title matching or simulated input.
---

# Name This Session

Choose the title, then run:

```powershell
python.exe "C:\Users\Austen\.claude\skills\rename\scripts\rename_current_session.py" --title "<new name>"
```

The helper identifies this Claude session through Agent Hub's inherited owner
PID. It appends Claude's native `custom-title` record, updates the exact live
terminal, and verifies persistence. Do not inspect `~/.claude/sessions` for the
current window title. Do not use SendKeys or emit a `/name` line for the user to
paste.

On success, report the old and new names in one sentence. On failure, report the
helper's exact error.

## Naming Rules

1. Name the conversation's main subject, not its latest command or current step.
2. Use two to four Title Case words. Prefer two or three.
3. Preserve meaningful acronyms and domain terms such as TKA, LOOP, VTG, MCP,
   QR, 4K, R2, CAP, and SEO.
4. Drop process words such as Fix, Bug, Issue, Investigation, Work, Update,
   Refactor, Implement, and Debug unless one is the subject.
5. Use no trailing punctuation, quotes, or emoji.

Examples: `Session Rename`, `Ocean Scene Redesign`, `Shortcode Dedup`,
`4K Landing Layout`, `MCP Ground Truth`.

For `/rename <hint>` or `/rn <hint>`, treat the hint as the subject and compress
it to the same title rules.
