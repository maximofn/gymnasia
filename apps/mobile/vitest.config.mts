import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "agent/**/*.test.ts",
      "backup/**/*.test.ts",
      "catalogs/**/*.test.ts",
      "diet/**/*.test.ts",
      "measurements/**/*.test.ts",
      "persistence/**/*.test.ts",
      "storage/**/*.test.ts",
      "training/**/*.test.ts",
    ],
    mockReset: true,
    restoreMocks: true,
  },
});
