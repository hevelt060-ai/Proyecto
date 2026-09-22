import { describe, expect, it } from "vitest";

import { loadConfig } from "../../packages/config/src/index.js";

describe("foundation configuration", () => {
  it("defaults the API to the versioned route prefix", () => {
    expect(loadConfig().apiPrefix).toBe("/api/v1");
  });
});
