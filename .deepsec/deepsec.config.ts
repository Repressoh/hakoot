import { defineConfig } from "deepsec/config";

export default defineConfig({
  // Codex agent loop + gpt-5.5 (OpenAI API or AI Gateway). deepsec has no Cursor agent backend.
  defaultAgent: "codex",
  projects: [
    { id: "hakoot", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});
