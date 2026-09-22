# LinkedIn demo post (draft)

Paste after you record. Replace bracketed numbers with the on-screen metrics from your take.

---

Most voice agents wait until you finish talking before they do anything.

I built a single console that doesn't.

**JevStream** evaluates partial transcripts mid-sentence and fires (or blocks) the action early.
**JevBench** calibrates the prompt until the confidence threshold is honest.
**JevAudit** writes every verdict to an append-only ledger — including the ones that need a human.

In the demo:
1. "Deploy the staging branch…" → action card fires **[~1589ms]** before I finish the sentence
2. "Drop the production database…" → hard-blocked mid-utterance (noul gate)
3. "Clean up the old build stuff…" → low confidence → human review → approve on camera

One platform. Three tools. Real decision API under the hood ([Jev](https://jevtypesafeai.com/docs)).

Repo: jev-tools
Stack: Next.js + typed `/v1/decide` client + SQLite audit ledger

If you ship agents that touch production, speculative intent + calibrated confidence + auditability should be table stakes.

#AI #Agents #VoiceAI #TypeSafe #BuildInPublic

---

## Recording checklist (60s)

1. Chrome, `npm run dev`, localhost:3000, zoom 110%
2. Scripted mode (reliable take) — or Mic if your room is quiet
3. One continuous take:
   - Play utterance 1 → wait for green `t_saved`
   - Play utterance 2 → show red hard-block → Dismiss
   - Play utterance 3 → click **Approve on camera**
   - Cut to `/bench` (ECE before/after)
   - Cut to `/audit` (ledger rows)
4. Export 1080p, captions on the three spoken lines

## Live API

Set `JEV_API_KEY=jv_live_…` in `.env.local`, then:

```bash
npm run smoke
npm run bench
```

Until then, `JEV_API_KEY=mock` drives a deterministic rehearsal path.
