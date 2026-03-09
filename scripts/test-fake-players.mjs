/**
 * Test script: simulates multiple fake players joining a session via Convex.
 *
 * Usage:
 *   node scripts/test-fake-players.mjs <CONVEX_URL> <INVITE_CODE> [PLAYER_COUNT]
 *
 * Example:
 *   node scripts/test-fake-players.mjs https://your-project.convex.cloud ABCDEF 5
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const NAMES = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Eve",
  "Frank",
  "Grace",
  "Hank",
  "Ivy",
  "Jack",
];

const convexUrl = process.argv[2];
const inviteCode = process.argv[3];
const count = Math.min(Number(process.argv[4]) || 5, NAMES.length);

if (!(convexUrl && inviteCode)) {
  console.error(
    "Usage: node scripts/test-fake-players.mjs <CONVEX_URL> <INVITE_CODE> [PLAYER_COUNT]"
  );
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

async function run() {
  console.log(`\nLooking up invite code "${inviteCode}"...`);
  const session = await client.query(api.sessions.getByInviteCode, {
    code: inviteCode,
  });
  if (!session) {
    console.error("Session not found for code:", inviteCode);
    process.exit(1);
  }
  console.log(`Session ID: ${session.sessionId}\n`);

  console.log(`Joining ${count} fake players with 1s delay each...\n`);

  const results = [];
  for (let i = 0; i < count; i++) {
    const name = NAMES[i];
    try {
      const result = await client.mutation(api.sessions.joinByCode, {
        inviteCode,
        name,
      });
      results.push({ name, ...result });
      console.log(
        `  [JOIN] ${name} -> sessionId=${result.sessionId}, token=${result.participantToken.slice(0, 8)}...`
      );
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n--- Summary ---");
  console.log(`Players joined: ${results.length}/${count}`);

  const uniqueTokens = new Set(results.map((r) => r.participantToken));
  console.log(`Unique tokens: ${uniqueTokens.size}`);

  if (uniqueTokens.size === results.length) {
    console.log("\n✅ All tests passed! Each player has a unique token.");
  } else {
    console.error("\n❌ BUG: Duplicate tokens in join responses.");
  }

  console.log("");
  process.exit(uniqueTokens.size === results.length ? 0 : 1);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
