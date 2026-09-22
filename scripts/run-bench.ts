import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createJevClientFromEnv } from "../src/lib/jev/client";
import { runBench, writeBenchReport } from "../src/lib/jev-bench/optimize";
import { BENCH_SEED } from "../src/lib/jev-bench/seed";

async function main() {
  const client = createJevClientFromEnv();
  console.log(`Running JevBench on ${BENCH_SEED.length} cases...`);
  const report = await runBench(client, BENCH_SEED);
  const out = writeBenchReport(report);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
  console.log(
    `ECE ${report.before.ece.toFixed(3)} → ${report.after.ece.toFixed(3)} | cost $${report.totalCostUsd.toFixed(6)}`,
  );
  console.log(
    `Recommended speculativeFire=${report.recommendedThresholds.speculativeFire}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
