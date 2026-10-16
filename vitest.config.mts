import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // convex-test runs Convex functions in the same runtime as production.
    // Tests outside convex/ opt into Node with a @vitest-environment docblock.
    environment: "edge-runtime",
    include: [
      "convex/**/*.test.ts",
      "i18n/**/*.test.ts",
      "lib/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    server: { deps: { inline: ["convex-test"] } },
  },
});
