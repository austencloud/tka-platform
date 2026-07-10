# Brainstorming Gate — ENFORCED

## The Problem This Solves

Claude is sometimes reluctant to auto-invoke the `superpowers:brainstorming` skill, even for work that clearly requires it. Austen's workflow depends on deep brainstorming before any spec or plan. Skipping it produces shallow specs that cascade into broken implementations.

## The Rule

Before writing ANY of the following, invoke `superpowers:brainstorming` first:

- A new feature spec
- An implementation plan (even a small one)
- Any architecture decision
- Any new component, module, or service
- Any refactor that touches more than one file
- Any user-facing copy that will ship

**No exceptions.** The skill is not optional. If you catch yourself writing a plan or spec without having brainstormed, STOP, invoke `superpowers:brainstorming`, and restart.

## What counts as "already brainstormed"

- The current conversation already invoked `superpowers:brainstorming` for THIS specific feature
- The user said "skip brainstorming" or "just do it" in the current message
- You are executing a written plan that was brainstormed in a prior session

Memory of past brainstorms doesn't count. Each new feature = fresh brainstorming pass.

## Why this is a hard rule

Austen's feedback, verbatim: *"why are we not brainstorming anymore like this really feels shady."* Model thresholds for firing the skill vary across releases. This rule compensates by making brainstorming a context requirement, not a judgment call.
