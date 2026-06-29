import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "hakoot", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});
