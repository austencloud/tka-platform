# TKA Scribe - Claude Code Guidelines

## CATASTROPHIC DATA LOSS PREVENTION

**On January 2, 2026, Claude destroyed 8 HOURS of uncommitted work with `git checkout -- .`**

### FORBIDDEN - Never run without explicit user confirmation:
```
git checkout -- .
git checkout -- <file>
git reset --hard
git reset HEAD~
git clean -f
```

### REQUIRED: Ask and wait for "yes" before any command that discards changes.

**Mental model:** Every modified file in `git status` = hours of work. When uncertain, ASK.

---

## Rules

`.claude/rules/` contains:
- `code-style.md` - Imports, Svelte 5, state, TypeScript
- `service-naming.md` - Never use "Service" suffix
- `styling.md` - CSS variables, typography, panels
- `testing.md` - Earned tests philosophy
- `workflows.md` - /fb, /release, /done commands
- `project-patterns.md` - Module checklist

---

## Quick Reference

- **Stack:** Svelte 5 + TypeScript + Inversify DI + Firebase
- **User:** Austen Cloud (austencloud@gmail.com)
- **Context:** Suggest `/compact` at 70% capacity
