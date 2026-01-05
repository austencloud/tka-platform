#!/usr/bin/env node
/**
 * Git Safety Hook for Claude Code
 *
 * Blocks dangerous git commands that could destroy uncommitted work.
 * Returns exit code 2 to deny the action.
 */

const dangerousPatterns = [
  /git\s+checkout\s+--\s*\./,           // git checkout -- .
  /git\s+checkout\s+--\s+\S/,           // git checkout -- <file>
  /git\s+reset\s+--hard/,               // git reset --hard
  /git\s+reset\s+HEAD~/,                // git reset HEAD~
  /git\s+clean\s+-f/,                   // git clean -f or -fd
  /git\s+stash\s+drop/,                 // git stash drop (less common but dangerous)
];

// Read the tool input from stdin (Claude Code passes it as JSON)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const toolInput = JSON.parse(input);
    const command = toolInput.command || '';

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        // Output error message that Claude will see
        console.error(`
⛔ BLOCKED: Dangerous git command detected!

Command: ${command}

This command would discard uncommitted changes.
Ask the user for explicit confirmation before running this.

Remember: Every modified file = hours of user work.
`);
        process.exit(2); // Exit code 2 = deny action
      }
    }

    // Command is safe, allow it
    process.exit(0);
  } catch (e) {
    // If we can't parse, allow the command (fail open)
    process.exit(0);
  }
});
