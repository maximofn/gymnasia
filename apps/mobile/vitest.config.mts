import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "agent/**/*.test.ts",
      "backup/**/*.test.ts",
      "persistence/**/*.test.ts",
      "storage/**/*.test.ts",
    ],
    mockReset: true,
    restoreMocks: true,
  },
});
