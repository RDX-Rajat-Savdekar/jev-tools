/**
 * Record LinkedIn demo clips of the three Jev Tools surfaces.
 * Run: npx --yes playwright@1.49.1 test --config scripts/record-demo.config.ts
 * Or:  node scripts/record-demos.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "../../GitHub/rdx-dev-creator-lab/projects/jev-tools/output/demos",
);
const BASE = process.env.DEMO_URL ?? "http://localhost:3000";
const VIEWPORT = { width: 1920, height: 1080 };

fs.mkdirSync(OUT, { recursive: true });

async function recordClip(name, run) {
  const dir = path.join(OUT, `_raw_${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir, size: VIEWPORT },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  console.log(`[${name}] start`);
  await run(page);
  console.log(`[${name}] done`);

  await context.close();
  await browser.close();

  // Playwright writes a single webm in dir
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".webm"));
  if (!files.length) throw new Error(`No video for ${name}`);
  const src = path.join(dir, files[0]);
  const dest = path.join(OUT, `${name}.webm`);
  fs.renameSync(src, dest);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`[${name}] → ${dest}`);
  return dest;
}

async function recordStream(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      const select = page.locator('select[aria-label="Demo utterance"]');
      await select.selectOption({ index: i });
      await page.waitForTimeout(350);
    }
    await page.getByRole("button", { name: /play utterance/i }).click();

    // Wait for scripted utterance to finish, then a short result hold
    await page.waitForTimeout(i === 2 ? 8500 : 9200);

    // On the review case, approve on camera so the clip resolves
    if (i === 2) {
      const approve = page.getByRole("button", { name: /approve on camera/i });
      if (await approve.isVisible().catch(() => false)) {
        await approve.click();
        await page.waitForTimeout(1200);
      }
    } else {
      await page.waitForTimeout(900);
    }
  }
  await page.waitForTimeout(700);
}

async function recordBench(page) {
  await page.goto(`${BASE}/bench`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // Click explicitly — more reliable than auto-play under React Strict Mode
  const btn = page.getByRole("button", { name: /run sweep|replay sweep/i });
  await btn.click();
  await page.waitForTimeout(5200);

  // Replay so ECE drop is obvious
  const replay = page.getByRole("button", { name: /replay sweep|run sweep/i });
  if (await replay.isEnabled()) {
    await replay.click();
    await page.waitForTimeout(4800);
  }
  await page.waitForTimeout(1000);
}

async function recordAudit(page) {
  await page.goto(`${BASE}/audit`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Approve a review card on camera if one appears
  for (let i = 0; i < 4; i++) {
    const approve = page.getByRole("button", { name: /approve on camera/i });
    if (await approve.isVisible().catch(() => false)) {
      await approve.click();
      await page.waitForTimeout(1800);
      break;
    }
    await page.waitForTimeout(1600);
  }

  // Keep watching the live stream cycle fire / block / review
  await page.waitForTimeout(14000);
}

async function main() {
  const only = (process.env.RECORD_ONLY ?? "").toLowerCase();
  if (!only || only === "stream") await recordClip("stream", recordStream);
  if (!only || only === "bench") await recordClip("bench", recordBench);
  if (!only || only === "audit") await recordClip("audit", recordAudit);
  console.log("Demos recorded.", only ? `(only=${only})` : "(all)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
