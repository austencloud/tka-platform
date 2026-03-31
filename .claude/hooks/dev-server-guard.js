#!/usr/bin/env node
/**
 * Dev Server Guard for Claude Code
 *
 * Blocks commands that would kill the user's dev server on port 5173.
 * Claude should use port 5174 if it needs its own dev server.
 * Returns exit code 2 to deny the action.
 */

const rules = [
  { pattern: /npm\s+run\s+dev\b/, msg: "npm run dev kills port 5173 (the user's dev server). Use 'vite --port 5174' if you need a dev server." },
  { pattern: /kill-port\s+5173\b/, msg: "Port 5173 belongs to the user. Never kill it." },
  { pattern: /npx\s+kill-port\s+5173\b/, msg: "Port 5173 belongs to the user. Never kill it." },
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
        console.error(`\n⛔ BLOCKED: ${msg}\n\nCommand: ${command}\n`);
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});
