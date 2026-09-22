import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createJevClientFromEnv } from "../src/lib/jev/client";
import { COMMAND_QUESTIONS } from "../src/lib/jev/questions";
import { routeDecision } from "../src/lib/jev/routing";

async function main() {
  const client = createJevClientFromEnv();
  const transcript =
    process.argv.slice(2).join(" ") ||
    "Deploy the staging branch to the preview environment";

  console.log("Evaluating:", transcript);
  const started = Date.now();
  const response = await client.decide({
    state: {
      role: "agent_command_console",
      partial_transcript: transcript,
    },
    questions: COMMAND_QUESTIONS,
  });
  const ms = Date.now() - started;
  const decision = routeDecision(response);

  console.log(JSON.stringify({ ms, decision, response }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
