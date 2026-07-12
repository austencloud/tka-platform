#!/usr/bin/env node

/**
 * Setup Release Workflow
 *
 * One-time setup script to initialize the automated release workflow.
 * Run this after cloning the repo to configure your local environment.
 *
 * Usage:
 *   node scripts/setup-release-workflow.js
 */

import { copyFileSync, existsSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function setup() {
  console.log("\n🚀 Flow Arts Composer - Release Workflow Setup\n");
  console.log(
    "This will configure your local environment for the automated release workflow.\n"
  );

  // Check if .env.local already exists
  if (existsSync(".env.local")) {
    console.log("✅ .env.local already exists\n");
    const overwrite = await question("   Do you want to overwrite it? (y/n): ");
    if (overwrite.toLowerCase() !== "y") {
      console.log("\n✅ Keeping existing .env.local\n");
    } else {
      await createEnvLocal();
    }
  } else {
    await createEnvLocal();
  }

  // Check if husky is installed
  console.log("\n🔧 Checking git hooks...\n");
  if (existsSync(".husky/_")) {
    console.log("✅ Husky is installed\n");
  } else {
    console.log("⚠️  Husky not installed. Installing...\n");
    try {
      execSync("npm install", { stdio: "inherit" });
      console.log("\n✅ Husky installed\n");
    } catch (error) {
      console.error("❌ Error installing husky:", error.message);
      console.log("   Run: npm install\n");
    }
  }

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("✅ Setup Complete!\n");
  console.log("📚 Resources:\n");
  console.log("   • Full Guide: docs/PRODUCTION-RELEASE-WORKFLOW.md");
  console.log("   • Quick Reference: docs/RELEASE-QUICK-REFERENCE.md");
  console.log("   • AI Workflow: docs/AI-ASSISTED-WORKFLOW.md\n");
  console.log("🎯 Quick Start:\n");
  console.log("   1. Start dev server: npm run dev");
  console.log("   2. All features enabled in development");
  console.log("   3. Type /release to AI assistant when ready to go live\n");
  console.log("💡 Commands:\n");
  console.log("   • npm run env:check    - Check environment status");
  console.log("   • npm run release:prod - Release to production");
  console.log("   • /release in AI chat  - Trigger release workflow\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  rl.close();
}

async function createEnvLocal() {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf8",
  }).trim();
  const isProductionBranch = branch === "main" || branch === "release";

  const mode = await question(
    "   Choose mode:\n   1) Development (all features)\n   2) Production (released features only)\n   Choice (1 or 2): "
  );

  const isDev = mode.trim() !== "2";
  const sourceFile = isDev ? ".env.development" : ".env.production";

  if (!existsSync(sourceFile)) {
    console.error(`\n❌ Source file not found: ${sourceFile}`);
    console.log("   Creating from template...\n");

    if (isDev) {
      writeFileSync(
        ".env.local",
        `# Development Environment
PUBLIC_ENVIRONMENT=development
PUBLIC_ENABLE_CREATE_MODULE=true
PUBLIC_ENABLE_DISCOVER_MODULE=true
PUBLIC_ENABLE_FEEDBACK_MODULE=true
PUBLIC_ENABLE_LEARN_MODULE=true
PUBLIC_ENABLE_LIBRARY_MODULE=true
PUBLIC_ENABLE_COMPOSE_MODULE=true
PUBLIC_ENABLE_TRAIN_MODULE=true
PUBLIC_ENABLE_ML_TRAINING_MODULE=true
PUBLIC_ENABLE_ADMIN_MODULE=true
PUBLIC_ENABLE_DEBUG_TOOLS=true
PUBLIC_ENABLE_ROLE_OVERRIDE=true
PUBLIC_ENABLE_ANALYTICS=true
`
      );
    } else {
      writeFileSync(
        ".env.local",
        `# Production Environment Simulation
PUBLIC_ENVIRONMENT=production
PUBLIC_ENABLE_CREATE_MODULE=true
PUBLIC_ENABLE_DISCOVER_MODULE=true
PUBLIC_ENABLE_FEEDBACK_MODULE=true
PUBLIC_ENABLE_LEARN_MODULE=false
PUBLIC_ENABLE_LIBRARY_MODULE=false
PUBLIC_ENABLE_COMPOSE_MODULE=false
PUBLIC_ENABLE_TRAIN_MODULE=false
PUBLIC_ENABLE_ML_TRAINING_MODULE=false
PUBLIC_ENABLE_ADMIN_MODULE=false
PUBLIC_ENABLE_DEBUG_TOOLS=false
PUBLIC_ENABLE_ROLE_OVERRIDE=false
PUBLIC_ENABLE_ANALYTICS=true
`
      );
    }
    console.log("✅ Created .env.local from template\n");
  } else {
    copyFileSync(sourceFile, ".env.local");
    console.log(`\n✅ Created .env.local from ${sourceFile}\n`);
  }

  if (isDev) {
    console.log("🔧 Development mode:");
    console.log("   • All modules visible");
    console.log("   • Debug tools enabled");
  } else {
    console.log("📦 Production mode:");
    console.log("   • Only released modules visible");
    console.log("   • Matches production deployment");
  }

  if (isProductionBranch && isDev) {
    console.log(
      "\n⚠️  Note: You're on a production branch with development environment"
    );
    console.log("   This is fine for testing locally.");
  }
}

setup().catch((error) => {
  console.error("❌ Setup error:", error);
  rl.close();
  process.exit(1);
});
