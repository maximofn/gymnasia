import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["agent/**/*.test.ts"],
    mockReset: true,
    restoreMocks: true,
  },
});
