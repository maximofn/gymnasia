import { describe, expect, it } from "vitest";

import { createPlatformFetch } from "./network";

describe("createPlatformFetch", () => {
  it("preserves the browser receiver when fetch is injected as a platform port", async () => {
    let receiver: unknown = null;
    const response = { ok: true } as Response;
    const target: Pick<typeof globalThis, "fetch"> = {
      fetch: function (this: unknown) {
        receiver = this;
        return Promise.resolve(response);
      } as typeof fetch,
    };

    const platformFetch = createPlatformFetch(target);

    await expect(platformFetch("https://example.test/catalog.json")).resolves.toBe(response);
    expect(receiver).toBe(target);
  });
});
