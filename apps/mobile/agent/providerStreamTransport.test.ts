import { describe, expect, it } from "vitest";

import { extractProviderErrorMessage } from "./providerStreamTransport";

describe("provider stream transport", () => {
  it("prioriza el mensaje normalizado de proveedor", () => {
    expect(extractProviderErrorMessage({ error: { message: "provider" } }, "fallback"))
      .toBe("provider");
    expect(extractProviderErrorMessage({ detail: "proxy" }, "fallback")).toBe("proxy");
    expect(extractProviderErrorMessage({ message: "direct" }, "fallback")).toBe("direct");
  });

  it("usa el fallback ante cuerpos no estructurados", () => {
    expect(extractProviderErrorMessage(null, "fallback")).toBe("fallback");
    expect(extractProviderErrorMessage("raw", "fallback")).toBe("fallback");
  });
});
