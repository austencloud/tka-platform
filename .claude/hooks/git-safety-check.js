#!/usr/bin/env node
/**
 * Git Safety Hook for Claude Code
 *
 * Blocks dangerous git commands that could destroy uncommitted work,
 * create branches, rewrite history, or force push.
 * Returns exit code 2 to deny the action.
 */

const rules = [
  // Discard uncommitted changes
  { pattern: /git\s+checkout\s+--\s*\./, msg: "This discards all uncommitted changes." },
  { pattern: /git\s+checkout\s+--\s+\S/, msg: "This discards uncommitted changes to a file." },
  { pattern: /git\s+reset\s+--hard/, msg: "This discards all uncommitted changes." },
  { pattern: /git\s+reset\s+HEAD~/, msg: "This rewrites recent commits and may lose work." },
  { pattern: /git\s+reset\s+--soft\s+HEAD~/, msg: "This undoes commits. Other sessions' uncommitted work may be affected." },
  { pattern: /git\s+reset\s+--mixed\s+HEAD~/, msg: "This undoes commits and unstages changes. Other sessions' work may be affected." },
  { pattern: /git\s+reset\s+HEAD\s+--/, msg: "This unstages files. Check that you're not affecting other sessions' staged work." },
  { pattern: /git\s+clean\s+-f/, msg: "This permanently deletes untracked files." },
  { pattern: /git\s+restore\s+--staged\s+\.\s*$/, msg: "This unstages all staged changes." },
  // Broad git add that catches unrelated files
  { pattern: /git\s+add\s+-A/, msg: "git add -A stages EVERYTHING including other sessions' work. Add specific files by name." },
  { pattern: /git\s+add\s+\.\s*($|[;&|])/, msg: "git add . stages EVERYTHING including other sessions' work. Add specific files by name." },

  // Stash — BLOCKED unless user explicitly confirms all other agents are stopped
  { pattern: /git\s+stash\b/, msg: "BLOCKED. git stash is unsafe with multiple agents. Austen runs 10+ concurrent agents — stash WILL destroy their uncommitted work. Before asking to override: (1) Tell the user they MUST stop ALL other Claude Code sessions first. (2) Ask them to confirm all sessions are stopped. (3) Only then proceed. Do NOT say 'this won't affect your files' — it WILL." },

  // History-rewriting operations that require exclusive git access
  { pattern: /git\s+lfs\s+migrate\b/, msg: "EXCLUSIVE ACCESS REQUIRED. git lfs migrate rewrites commit history. You MUST tell the user: 'This requires stopping ALL other Claude Code sessions first.' Then confirm they are stopped before proceeding. Do NOT run this while other agents are active." },
  { pattern: /git\s+rebase\b/, msg: "EXCLUSIVE ACCESS REQUIRED. git rebase rewrites commit history and requires a clean working directory. You MUST tell the user: 'This requires stopping ALL other Claude Code sessions first.'" },

  // Branch creation (ALL work happens on main per CLAUDE.md)
  { pattern: /git\s+checkout\s+-b\s/, msg: "Branch creation is forbidden. All work happens on main." },
  { pattern: /git\s+branch\s+(?!-D\b)\S/, msg: "Branch creation is forbidden. All work happens on main." },
  { pattern: /git\s+switch\s+-c\s/, msg: "Branch creation is forbidden. All work happens on main." },
  { pattern: /git\s+worktree\s+add\b/, msg: "Worktree creation is forbidden. All work happens on main." },

  // History rewriting (nuclear options)
  { pattern: /git\s+filter-repo\b/, msg: "filter-repo rewrites ALL commits and resets the working tree. Extremely destructive." },
  { pattern: /git\s+filter-branch\b/, msg: "filter-branch rewrites history. Extremely destructive." },

  // Force push
  { pattern: /git\s+push\s+.*--force/, msg: "Force push can overwrite remote history." },
  { pattern: /git\s+push\s+-f\b/, msg: "Force push can overwrite remote history." },
];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const toolInput = JSON.parse(input);
    const command = toolInput.command || '';

    for (const { pattern, msg } of rules) {
      if (pattern.test(command)) {
        console.error(`\n⛔ BLOCKED: ${msg}\n\nCommand: ${command}\n\nAsk the user for explicit confirmation before running this.\nRemember: Every modified file = hours of user work.\n`);
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});
