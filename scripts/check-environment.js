#!/usr/bin/env node

/**
 * Check Current Environment
 *
 * Displays current git branch and environment configuration.
 * Helps understand what mode you're in (dev vs production).
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

function checkEnvironment() {
  console.log("\n🔍 Current Environment Status\n");

  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
    const isProductionBranch = branch === "main" || branch === "release";

    console.log(`📍 Git Branch: ${branch}`);
    console.log(
      `   ${isProductionBranch ? "⚠️  PRODUCTION" : "✅ DEVELOPMENT"} branch\n`
    );

    // Check .env.local
    if (existsSync(".env.local")) {
      const envContent = readFileSync(".env.local", "utf8");
      const envMatch = envContent.match(/PUBLIC_ENVIRONMENT=(\w+)/);
      const environment = envMatch ? envMatch[1] : "unknown";

      console.log(`🔧 .env.local: ${environment}`);

      // Check module visibility
      const createEnabled = envContent.includes(
        "PUBLIC_ENABLE_CREATE_MODULE=true"
      );
      const learnEnabled = envContent.includes(
        "PUBLIC_ENABLE_LEARN_MODULE=true"
      );
      const libraryEnabled = envContent.includes(
        "PUBLIC_ENABLE_LIBRARY_MODULE=true"
      );

      console.log("\n📦 Module Visibility:");
      console.log(`   Create: ${createEnabled ? "✅" : "❌"}`);
      console.log(`   Learn: ${learnEnabled ? "✅" : "❌"}`);
      console.log(`   Library: ${libraryEnabled ? "✅" : "❌"}`);

      if (environment === "development" && learnEnabled) {
        console.log("\n✅ Development mode - All features enabled");
      } else if (environment === "production") {
        console.log("\n⚠️  Production mode - Only released features visible");
      }
    } else {
      console.log("⚠️  No .env.local found");
      console.log("   Run: node scripts/switch-environment.js dev\n");
    }

    // Recommendation
    if (isProductionBranch && existsSync(".env.local")) {
      const envContent = readFileSync(".env.local", "utf8");
      if (envContent.includes("PUBLIC_ENVIRONMENT=development")) {
        console.log(
          "\n⚠️  WARNING: You're on a production branch but have development environment!"
        );
        console.log(
          "   Consider running: node scripts/switch-environment.js prod\n"
        );
      }
    }
  } catch (error) {
    console.error("❌ Error checking environment:", error.message);
    process.exit(1);
  }
}

checkEnvironment();
