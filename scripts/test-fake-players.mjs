/**
 * Test script: simulates multiple fake players joining a session via the API.
 *
 * Usage:
 *   node scripts/test-fake-players.mjs <INVITE_CODE> [PLAYER_COUNT]
 *
 * Each player uses a unique name and independent cookie jar to mimic
 * separate browsers. After joining, the script opens an SSE stream as
 * a "host" to verify participant_joined events are emitted.
 */

const BASE = "http://localhost:3000";
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

const inviteCode = process.argv[2];
const count = Math.min(Number(process.argv[3]) || 5, NAMES.length);

if (!inviteCode) {
  console.error(
    "Usage: node scripts/test-fake-players.mjs <INVITE_CODE> [PLAYER_COUNT]"
  );
  process.exit(1);
}

async function resolveSession(code) {
  const res = await fetch(`${BASE}/api/sessions/by-code?code=${code}`);
  if (!res.ok) {
    throw new Error(`Failed to resolve code "${code}": ${res.status}`);
  }
  return (await res.json()).id;
}

async function joinSession(sessionId, name) {
  const res = await fetch(`${BASE}/api/sessions/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Join failed for "${name}": ${err.error ?? res.status}`);
  }

  return res.json();
}

function listenForEvents(sessionId) {
  return new Promise((resolve) => {
    const events = [];
    const controller = new AbortController();

    fetch(`${BASE}/api/sessions/${sessionId}/stream`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          let eventType = null;
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              const data = JSON.parse(line.slice(6));
              events.push({ type: eventType, data });
              console.log(`  [SSE] ${eventType}: ${JSON.stringify(data)}`);
              eventType = null;
            }
          }
        }
      })
      .catch(() => {});

    resolve({ events, stop: () => controller.abort() });
  });
}

async function run() {
  console.log(`\nResolving invite code "${inviteCode}"...`);
  const sessionId = await resolveSession(inviteCode);
  console.log(`Session ID: ${sessionId}\n`);

  console.log("Opening SSE listener (as host would)...");
  const { events, stop } = await listenForEvents(sessionId);

  await new Promise((r) => setTimeout(r, 500));

  console.log(`\nJoining ${count} fake players with 1s delay each...\n`);

  const results = [];
  for (let i = 0; i < count; i++) {
    const name = NAMES[i];
    try {
      const data = await joinSession(sessionId, name);
      results.push(data);
      console.log(
        `  [JOIN] ${name} -> participantId=${data.participantId}, returned name="${data.name}"`
      );

      if (data.name !== name) {
        console.error(
          `  *** BUG: expected name "${name}" but got "${data.name}" ***`
        );
      }
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  await new Promise((r) => setTimeout(r, 1500));
  stop();

  console.log("\n--- Summary ---");
  console.log(`Players joined: ${results.length}/${count}`);
  console.log(`SSE events received: ${events.length}`);

  const uniqueNames = new Set(results.map((r) => r.name));
  console.log(`Unique names in responses: ${[...uniqueNames].join(", ")}`);

  const sseNames = events
    .filter((e) => e.type === "participant_joined")
    .map((e) => e.data.name);
  console.log(`SSE participant_joined names: ${sseNames.join(", ")}`);

  const allUnique = uniqueNames.size === results.length;
  const allSseReceived = sseNames.length === results.length;

  if (allUnique && allSseReceived) {
    console.log(
      "\n✅ All tests passed! Each player has a unique name and SSE events were received."
    );
  } else {
    if (!allUnique) {
      console.error(
        "\n❌ BUG: Duplicate names in join responses (cookie rejoin issue)."
      );
    }
    if (!allSseReceived) {
      console.error(
        `\n❌ BUG: Expected ${results.length} SSE events but got ${sseNames.length} (missing publish).`
      );
    }
  }

  console.log("");
  process.exit(allUnique && allSseReceived ? 0 : 1);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
