# Research Before Building — ENFORCED

Frameworks ship most plumbing, and the ecosystem moves faster than training
data. Before writing infrastructure code — event handling, raycasting,
animation, physics, state patterns, build tooling — check whether the
framework or its extras package already provides it: web search
"[framework] [feature] [current year]", context7, npm. A hand-rolled 175-line
ManualRaycaster once cost hours of debugging when Threlte's `interactivity()`
did the same thing in one line.

The test: would a senior developer who uses this framework daily already know
a built-in for this? If probably yes, search before building. And if a
hand-rolled first attempt doesn't work, research alternatives before attempt
two — don't keep debugging a solution the framework may have obsoleted.
