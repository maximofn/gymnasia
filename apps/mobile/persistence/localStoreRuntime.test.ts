import { describe, expect, it } from "vitest";

import type { LocalStore } from "./localStoreModel";
import type { LocalStoreRuntime } from "./localStoreRuntime";

describe("LocalStoreRuntime contract", () => {
  it("keeps React updates and durable commits as separate operations", () => {
    const operations: string[] = [];
    const store = { version: 1 } as unknown as LocalStore;
    const runtime: LocalStoreRuntime = {
      store,
      isHydrated: true,
      update: () => operations.push("update"),
      commit: async () => {
        operations.push("commit");
      },
    };

    runtime.update((previous) => previous);
    void runtime.commit((previous) => previous);

    expect(operations).toEqual(["update", "commit"]);
  });
});
