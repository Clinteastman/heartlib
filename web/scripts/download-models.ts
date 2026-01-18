#!/usr/bin/env bun
/**
 * Download HeartMuLa models from HuggingFace
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { $ } from "bun";

const CKPT_DIR = join(import.meta.dir, "../../ckpt");

const MODELS = [
  {
    name: "HeartMuLaGen (tokenizer + config)",
    repo: "HeartMuLa/HeartMuLaGen",
    localDir: CKPT_DIR,  // Downloads directly to ckpt/ root
  },
  {
    name: "HeartMuLa-oss-3B",
    repo: "HeartMuLa/HeartMuLa-oss-3B",
    localDir: join(CKPT_DIR, "HeartMuLa-oss-3B"),
  },
  {
    name: "HeartCodec-oss",
    repo: "HeartMuLa/HeartCodec-oss",
    localDir: join(CKPT_DIR, "HeartCodec-oss"),
  },
];

async function downloadModel(model: typeof MODELS[0]) {
  console.log(`\nDownloading ${model.name}...`);

  // For HeartMuLaGen, check if required files exist, not just directory
  if (model.repo === "HeartMuLa/HeartMuLaGen") {
    const tokenizerPath = join(CKPT_DIR, "tokenizer.json");
    const configPath = join(CKPT_DIR, "gen_config.json");
    if (existsSync(tokenizerPath) && existsSync(configPath)) {
      console.log(`  ${model.name} files already exist, skipping.`);
      return true;
    }
  } else if (existsSync(model.localDir)) {
    console.log(`  ${model.name} already exists, skipping.`);
    return true;
  }

  try {
    // Try using huggingface-cli
    await $`huggingface-cli download --local-dir ${model.localDir} ${model.repo}`.quiet();
    console.log(`  ✓ ${model.name} downloaded successfully!`);
    return true;
  } catch (e1) {
    // Try using hf command
    try {
      await $`hf download --local-dir ${model.localDir} ${model.repo}`.quiet();
      console.log(`  ✓ ${model.name} downloaded successfully!`);
      return true;
    } catch (e2) {
      console.error(`  ✗ Failed to download ${model.name}`);
      console.error("    Make sure huggingface-cli is installed: pip install huggingface_hub");
      return false;
    }
  }
}

async function main() {
  console.log("HeartMuLa Model Downloader");
  console.log("==========================");
  console.log(`\nCheckpoint directory: ${CKPT_DIR}`);

  // Ensure checkpoint directory exists
  if (!existsSync(CKPT_DIR)) {
    console.log(`Creating checkpoint directory...`);
    mkdirSync(CKPT_DIR, { recursive: true });
  }

  let success = true;

  for (const model of MODELS) {
    const result = await downloadModel(model);
    if (!result) success = false;
  }

  console.log("");

  if (success) {
    console.log("\x1b[32m✓ All models downloaded successfully!\x1b[0m");
    console.log("\nYou can now start the web UI with: bun run dev");
  } else {
    console.log("\x1b[31m✗ Some models failed to download.\x1b[0m");
    console.log("\nYou can download manually:");
    console.log("  huggingface-cli download --local-dir './ckpt' 'HeartMuLa/HeartMuLaGen'");
    console.log("  huggingface-cli download --local-dir './ckpt/HeartMuLa-oss-3B' 'HeartMuLa/HeartMuLa-oss-3B'");
    console.log("  huggingface-cli download --local-dir './ckpt/HeartCodec-oss' 'HeartMuLa/HeartCodec-oss'");
    process.exit(1);
  }
}

main();
