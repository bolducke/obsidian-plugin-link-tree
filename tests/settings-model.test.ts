import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings-model";

describe("normalizeSettings", () => {
  it("uses defaults for absent or invalid persisted data", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([])).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        followActiveNote: "yes",
        maxDepth: Number.NaN,
        rootNotePath: 7,
        showBacklinks: null,
        showOutgoingLinks: "true",
        sortOrder: "size",
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("normalizes supported settings without changing valid values", () => {
    expect(
      normalizeSettings({
        followActiveNote: false,
        maxDepth: 5,
        rootNotePath: "Projects/Home.md",
        showBacklinks: false,
        showOutgoingLinks: false,
        sortOrder: "modified",
      }),
    ).toEqual({
      followActiveNote: false,
      maxDepth: 5,
      rootNotePath: "Projects/Home.md",
      showBacklinks: false,
      showOutgoingLinks: false,
      sortOrder: "modified",
    });
  });

  it("rounds and bounds a persisted maximum depth", () => {
    expect(normalizeSettings({ maxDepth: -2 }).maxDepth).toBe(1);
    expect(normalizeSettings({ maxDepth: 99 }).maxDepth).toBe(8);
    expect(normalizeSettings({ maxDepth: 3.6 }).maxDepth).toBe(4);
  });
});
