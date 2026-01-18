#!/usr/bin/env bun
/**
 * Check if HeartMuLa models are downloaded
 */

import { existsSync } from "fs";
import { join } from "path";

const CKPT_DIR = join(import.meta.dir, "../../ckpt");

const REQUIRED_MODELS = [
  { name: "HeartCodec-oss", path: join(CKPT_DIR, "HeartCodec-oss") },
  { name: "HeartMuLa-oss-3B", path: join(CKPT_DIR, "HeartMuLa-oss-3B") },
  { name: "tokenizer.json", path: join(CKPT_DIR, "tokenizer.json") },
  { name: "gen_config.json", path: join(CKPT_DIR, "gen_config.json") },
];

console.log("Checking HeartMuLa models...\n");
console.log(`Checkpoint directory: ${CKPT_DIR}\n`);

let allPresent = true;
const missing: string[] = [];

for (const model of REQUIRED_MODELS) {
  const exists = existsSync(model.path);
  const status = exists ? "✓" : "✗";
  const color = exists ? "\x1b[32m" : "\x1b[31m";
  console.log(`${color}${status}\x1b[0m ${model.name}`);

  if (!exists) {
    allPresent = false;
    missing.push(model.name);
  }
}

console.log("");

if (allPresent) {
  console.log("\x1b[32m✓ All models are present!\x1b[0m");
  process.exit(0);
} else {
  console.log("\x1b[33m⚠ Missing models:\x1b[0m");
  missing.forEach(m => console.log(`  - ${m}`));
  console.log("\nRun 'bun run download:models' to download missing models.");
  console.log("Or download manually from HuggingFace:");
  console.log("  hf download --local-dir './ckpt' 'HeartMuLa/HeartMuLaGen'");
  console.log("  hf download --local-dir './ckpt/HeartMuLa-oss-3B' 'HeartMuLa/HeartMuLa-oss-3B'");
  console.log("  hf download --local-dir './ckpt/HeartCodec-oss' 'HeartMuLa/HeartCodec-oss'");
  process.exit(1);
}
