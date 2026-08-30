import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["agent/**/*.test.ts", "backup/**/*.test.ts"],
    mockReset: true,
    restoreMocks: true,
  },
});
