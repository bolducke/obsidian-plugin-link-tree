import { describe, expect, it } from "vitest";

import { resolveDisplayName } from "../src/display-name";

describe("resolveDisplayName", () => {
  it("uses the link display text when it is a non-empty string", () => {
    expect(resolveDisplayName("filename", "Display name")).toBe("Display name");
  });

  it("trims surrounding whitespace from the link display text", () => {
    expect(resolveDisplayName("filename", "  Display name  ")).toBe(
      "Display name",
    );
  });

  it.each([undefined, null, "", "   ", 42, ["Display name"]])(
    "falls back to the basename for %j",
    (display) => {
      expect(resolveDisplayName("filename", display)).toBe("filename");
    },
  );
});
