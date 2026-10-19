import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { MOCK_LLM: "1" },
    testTimeout: 20_000,
  },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
