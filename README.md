# Jev Voice Command Console

One platform for **JevStream**, **JevBench**, and **JevAudit** — a voice-driven agent command console with a recordable LinkedIn demo.

## Setup

```bash
cp .env.local.example .env.local
# Option A (live): JEV_API_KEY=jv_live_...
# Option B (rehearsal): JEV_API_KEY=mock
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

See [DEMO.md](./DEMO.md) for the LinkedIn recording script and post draft.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the console |
| `npm run smoke` | One `/decide` call (mock or live) |
| `npm run bench` | Calibrate prompts → `data/bench-report.json` |

## Demo flow

1. **Scripted mode** → utterance 1 (deploy) → early fire + `t_saved`
2. Utterance 2 (destroy) → hard block interstitial
3. Utterance 3 (cleanup) → human review → approve
4. `/bench` → ECE before/after
5. `/audit` → append-only ledger

Mic mode uses Chrome Web Speech API (`interimResults`). Scripted mode is the reliable recording fallback.

## Layout

- `src/lib/jev` — typed Decision API client (+ mock)
- `src/lib/jev-stream` — speculative partial-transcript evaluator
- `src/lib/jev-bench` — calibration harness
- `src/lib/jev-audit` — SQLite ledger
