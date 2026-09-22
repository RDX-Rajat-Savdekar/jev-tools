import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import type { Answer, DecideUsage } from "@/lib/jev/types";
import type { RoutingStatus } from "@/lib/jev/routing";
import { signalStrength } from "@/lib/jev/routing";

export type LedgerRow = {
  id: string;
  timestamp: string;
  context_hash: string;
  query_type: string;
  raw_context: string;
  verdict: string;
  confidence_score: number;
  status: RoutingStatus | "overridden" | "rolled_back";
  reviewer_id: string | null;
  reviewer_override: string | null;
  model_version: string | null;
  input_tokens: number | null;
  cost_usd: number | null;
  speculative: number;
  rolled_back: number;
  intent: string | null;
  partial_transcript: string | null;
  t_saved_ms: number | null;
  answers_json: string | null;
};

function dbPath() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "jev-audit.sqlite");
}

declare global {
  var __jevAuditDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!global.__jevAuditDb) {
    const db = new Database(dbPath());
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS jev_audit_ledger (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT (datetime('now')),
        context_hash TEXT NOT NULL,
        query_type TEXT NOT NULL,
        raw_context TEXT NOT NULL,
        verdict TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        status TEXT DEFAULT 'auto_approved',
        reviewer_id TEXT,
        reviewer_override TEXT,
        model_version TEXT,
        input_tokens INTEGER,
        cost_usd REAL,
        speculative INTEGER DEFAULT 0,
        rolled_back INTEGER DEFAULT 0,
        intent TEXT,
        partial_transcript TEXT,
        t_saved_ms INTEGER,
        answers_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_confidence ON jev_audit_ledger(confidence_score);
      CREATE INDEX IF NOT EXISTS idx_status ON jev_audit_ledger(status);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON jev_audit_ledger(timestamp);
    `);
    global.__jevAuditDb = db;
  }
  return global.__jevAuditDb;
}

function hashContext(context: string): string {
  return createHash("sha256").update(context).digest("hex");
}

export type AppendLedgerInput = {
  context: string;
  queryType: string;
  verdict: string;
  confidenceScore: number;
  status: RoutingStatus | "overridden" | "rolled_back";
  modelVersion?: string;
  usage?: DecideUsage;
  speculative?: boolean;
  rolledBack?: boolean;
  intent?: string;
  partialTranscript?: string;
  tSavedMs?: number | null;
  answers?: Record<string, Answer>;
};

export function appendLedger(input: AppendLedgerInput): LedgerRow {
  const db = getDb();
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO jev_audit_ledger (
      id, context_hash, query_type, raw_context, verdict, confidence_score,
      status, model_version, input_tokens, cost_usd, speculative, rolled_back,
      intent, partial_transcript, t_saved_ms, answers_json
    ) VALUES (
      @id, @context_hash, @query_type, @raw_context, @verdict, @confidence_score,
      @status, @model_version, @input_tokens, @cost_usd, @speculative, @rolled_back,
      @intent, @partial_transcript, @t_saved_ms, @answers_json
    )
  `);

  stmt.run({
    id,
    context_hash: hashContext(input.context),
    query_type: input.queryType,
    raw_context: input.context,
    verdict: input.verdict,
    confidence_score: input.confidenceScore,
    status: input.status,
    model_version: input.modelVersion ?? null,
    input_tokens: input.usage?.input_tokens ?? null,
    cost_usd: input.usage?.cost_usd ?? null,
    speculative: input.speculative ? 1 : 0,
    rolled_back: input.rolledBack ? 1 : 0,
    intent: input.intent ?? null,
    partial_transcript: input.partialTranscript ?? null,
    t_saved_ms: input.tSavedMs ?? null,
    answers_json: input.answers ? JSON.stringify(input.answers) : null,
  });

  return getLedgerById(id)!;
}

export function getLedgerById(id: string): LedgerRow | null {
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM jev_audit_ledger WHERE id = ?").get(id) as
      | LedgerRow
      | undefined) ?? null
  );
}

export function listLedger(limit = 100): LedgerRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM jev_audit_ledger ORDER BY timestamp DESC, rowid DESC LIMIT ?",
    )
    .all(limit) as LedgerRow[];
}

export function listNeedsReview(): LedgerRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM jev_audit_ledger WHERE status = 'needs_review' ORDER BY timestamp DESC",
    )
    .all() as LedgerRow[];
}

export function overrideLedger(
  id: string,
  override: string,
  reviewerId = "demo-reviewer",
): LedgerRow | null {
  const db = getDb();
  db.prepare(
    `UPDATE jev_audit_ledger
     SET status = 'overridden',
         reviewer_id = ?,
         reviewer_override = ?
     WHERE id = ?`,
  ).run(reviewerId, override, id);
  return getLedgerById(id);
}

export function markRolledBack(id: string): LedgerRow | null {
  const db = getDb();
  db.prepare(
    `UPDATE jev_audit_ledger SET rolled_back = 1, status = 'rolled_back' WHERE id = ?`,
  ).run(id);
  return getLedgerById(id);
}

export function totalCostUsd(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM jev_audit_ledger")
    .get() as { total: number };
  return row.total;
}

export function confidenceFromAnswers(
  answers: Record<string, Answer>,
  primary: "intent" | "block" | "risk" = "intent",
): number {
  const answer = answers[primary];
  if (!answer) return 0;
  return signalStrength(answer);
}
