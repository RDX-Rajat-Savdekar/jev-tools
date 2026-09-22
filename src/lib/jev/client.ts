import { PINNED_MODEL } from "@/lib/config/thresholds";
import type { DecideRequest, DecideResponse } from "./types";
import { JevApiError } from "./types";
import { mockDecide } from "./mock";

const DEFAULT_ENDPOINT = "https://jevtypesafeai.com/api/v1/decide";

export type JevClientOptions = {
  apiKey: string;
  endpoint?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JevClient {
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(options: JevClientOptions) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.model = options.model ?? PINNED_MODEL;
    this.maxRetries = options.maxRetries ?? 2;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async decide(
    request: Omit<DecideRequest, "model"> & { model?: string },
    init?: { signal?: AbortSignal },
  ): Promise<DecideResponse> {
    if (this.apiKey === "mock" || this.apiKey === "MOCK") {
      if (init?.signal?.aborted) {
        throw new JevApiError("aborted", 499, "aborted");
      }
      // Simulate network latency for realistic t_saved demos
      await sleep(120 + Math.floor(Math.random() * 80));
      return mockDecide({
        model: request.model ?? this.model,
        state: request.state,
        questions: request.questions,
      });
    }

    const body: DecideRequest = {
      model: request.model ?? this.model,
      state: request.state,
      questions: request.questions,
    };

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        return await this.once(body, init?.signal);
      } catch (err) {
        lastError = err;
        if (err instanceof JevApiError) {
          if (err.status === 402) throw err;
          if (err.status === 401 || err.status === 403 || err.status === 400) {
            throw err;
          }
          if (err.status !== 502 && err.status < 500) throw err;
        }
        if (init?.signal?.aborted) throw err;
        if (attempt >= this.maxRetries) break;
        await sleep(200 * 2 ** attempt);
        attempt += 1;
      }
    }

    throw lastError;
  }

  private async once(
    body: DecideRequest,
    signal?: AbortSignal,
  ): Promise<DecideResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!res.ok) {
        const code =
          typeof json.code === "string"
            ? json.code
            : typeof json.error === "string"
              ? json.error
              : undefined;
        throw new JevApiError(
          typeof json.error === "string"
            ? json.error
            : `Jev API error ${res.status}`,
          res.status,
          code,
          json,
        );
      }

      return json as unknown as DecideResponse;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

export function createJevClientFromEnv(): JevClient {
  const apiKey = process.env.JEV_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[jev] JEV_API_KEY missing — using mock client. Set jv_live_… for production.",
    );
    return new JevClient({ apiKey: "mock" });
  }
  return new JevClient({ apiKey });
}
