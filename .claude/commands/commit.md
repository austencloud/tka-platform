---
description: Commit staged changes with AI message
allowed-tools: Bash(git *)
---

# Commit

!`git status`
!`git diff --cached`
!`git log -5 --oneline`

Write a concise commit message:
- Imperative mood ("Add", "Fix", not "Added", "Fixed")
- First line under 50 chars
- Explain what and why, not just how

Show proposed message and ask to confirm before committing.
