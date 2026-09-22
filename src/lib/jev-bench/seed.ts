import type { BenchCase } from "./optimize";

/** Seed cases for calibration — covers fire / block / review paths. */
export const BENCH_SEED: BenchCase[] = [
  {
    id: "deploy-full",
    context: "Deploy the staging branch to the preview environment",
    expectedIntent: "deploy_preview",
    expectedBlock: false,
  },
  {
    id: "deploy-partial",
    context: "Deploy the staging branch to the",
    expectedIntent: "deploy_preview",
    expectedBlock: false,
  },
  {
    id: "destroy-full",
    context: "Drop the production database and clear the backups",
    expectedIntent: "destroy_data",
    expectedBlock: true,
  },
  {
    id: "destroy-partial",
    context: "Drop the production database and",
    expectedIntent: "destroy_data",
    expectedBlock: true,
  },
  {
    id: "cleanup-full",
    context: "Clean up the old build stuff",
    expectedIntent: "cleanup_build",
    expectedBlock: false,
  },
  {
    id: "cleanup-partial",
    context: "Clean up the old",
    expectedIntent: "cleanup_build",
    expectedBlock: false,
  },
  {
    id: "unknown-hello",
    context: "Hey are you there",
    expectedIntent: "unknown",
    expectedBlock: false,
  },
  {
    id: "deploy-alt",
    context: "Push this branch to the preview environment please",
    expectedIntent: "deploy_preview",
    expectedBlock: false,
  },
  {
    id: "destroy-alt",
    context: "Wipe production and delete all backups now",
    expectedIntent: "destroy_data",
    expectedBlock: true,
  },
  {
    id: "cleanup-alt",
    context: "Remove leftover build artifacts from yesterday",
    expectedIntent: "cleanup_build",
    expectedBlock: false,
  },
];
