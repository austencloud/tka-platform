---
description: Analyze changes and commit in logical chunks
allowed-tools: Bash(git *)
---

# Smart Commit

## Step 1: Analyze All Changes

!`git status`
!`git diff`
!`git diff --cached`

## Step 2: Plan Logical Commits

Group changes by these dimensions:
- **Feature work** vs **refactoring** vs **bug fixes**
- **Module/scope** (which feature area?)
- **Tests** vs **production code**
- **Deps/config** vs **behavior changes**
- **Docs** vs **code**

If everything belongs together → single commit.
If changes span multiple concerns → plan multiple commits.

## Step 3: Present the Plan

Show the user:
1. How many commits you'll create
2. What files go in each commit
3. The proposed message for each (conventional format)

Format: `type(scope): summary`
- Types: feat, fix, refactor, docs, style, test, chore, perf
- Scope: the module or feature area
- Summary: imperative mood, under 50 chars

**Wait for confirmation before proceeding.**

## Step 4: Execute

For each planned commit:
1. Stage only the relevant files: `git add <files>`
2. For mixed files, use patch staging: `git add -p <file>`
3. Commit with the planned message
4. Verify with `git status`

After all commits, show `git log --oneline -n <count>` to confirm.

## Rules

- Never commit unrelated changes together
- If a commit can't be described in one line, it's too broad—split it
- Each commit should be independently meaningful
- Think: "Will this make sense when generating the changelog?"
