#!/usr/bin/env node
// PreToolUse hook: run npm run check before git commit
// Prevents committing code with type errors.

const { execSync } = require("child_process");

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
	const input = JSON.parse(data);
	const command = input.tool_input?.command || "";

	// Only gate on git commit commands
	if (!/^git commit/.test(command)) process.exit(0);

	try {
		execSync("npx svelte-check --tsconfig ./tsconfig.json --threshold error --compiler-warnings state_referenced_locally:ignore", {
			cwd: "E:/tka-platform",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 120000,
		});
		// Type check passed, allow the commit
	} catch (err) {
		const stderr = err.stderr?.toString() || "";
		const stdout = err.stdout?.toString() || "";
		const errorCount = ((stdout + stderr).match(/Error:/g) || []).length;

		// Only block if there are actual type errors. svelte-check exits non-zero
		// for warnings too (e.g. unused CSS selectors), but those aren't blockers.
		if (errorCount > 0) {
			const result = {
				hookSpecificOutput: {
					hookEventName: "PreToolUse",
					permissionDecision: "deny",
					permissionDecisionReason: `svelte-check found ${errorCount} error(s). Fix type errors before committing.`,
				},
			};
			console.log(JSON.stringify(result));
		}
		// errorCount === 0 means only warnings — allow the commit to proceed
	}
});
