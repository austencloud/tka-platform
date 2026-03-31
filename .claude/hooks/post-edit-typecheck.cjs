#!/usr/bin/env node
// PostToolUse hook: run svelte-check after editing .svelte/.ts files
// Catches type errors immediately after edits, before they compound.

const { execSync } = require("child_process");
const path = require("path");

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
	const input = JSON.parse(data);
	const filePath =
		input.tool_input?.file_path || input.tool_response?.filePath || "";

	// Only check .svelte and .ts files in src/
	if (!/\.(svelte|ts)$/.test(filePath)) process.exit(0);
	if (!/[/\\]src[/\\]/.test(filePath)) process.exit(0);

	try {
		execSync("npx svelte-check --tsconfig ./tsconfig.json --threshold error --compiler-warnings state_referenced_locally:ignore", {
			cwd: "E:/tka-platform",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 60000,
		});
		// Pass silently on success
	} catch (err) {
		const stderr = err.stderr?.toString() || "";
		const stdout = err.stdout?.toString() || "";
		const errors = (stdout + stderr)
			.split("\n")
			.filter((l) => /Error:/.test(l))
			.slice(0, 10)
			.join("\n");

		const result = {
			hookSpecificOutput: {
				hookEventName: "PostToolUse",
				additionalContext: `svelte-check found type errors after editing ${path.basename(filePath)}:\n${errors}\n\nFix these before continuing.`,
			},
		};
		console.log(JSON.stringify(result));
		process.exit(2); // exit 2 = rewake the model to fix errors
	}
});
