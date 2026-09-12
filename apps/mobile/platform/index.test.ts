import { describe, expect, it } from "vitest";

import type { AppPlatformServices } from "./index";

describe("AppPlatformServices", () => {
  it("keeps the platform contract injectable", () => {
    const requiredPorts = [
      "storage",
      "secureStorage",
      "crypto",
      "constants",
      "imagePicker",
      "audio",
      "notifications",
      "intentLauncher",
      "clipboard",
      "files",
      "sharing",
      "documentPicker",
      "network",
      "native",
    ] as const satisfies ReadonlyArray<keyof AppPlatformServices>;

    expect(requiredPorts).toHaveLength(14);
  });
});
