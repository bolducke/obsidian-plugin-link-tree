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
        rootNotePaths: "Projects/Home.md",
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
        rootNotePaths: ["Projects/Home.md", "Areas/Work.md"],
        showBacklinks: false,
        showOutgoingLinks: false,
        sortOrder: "modified",
      }),
    ).toEqual({
      followActiveNote: false,
      maxDepth: 5,
      rootNotePaths: ["Projects/Home.md", "Areas/Work.md"],
      showBacklinks: false,
      showOutgoingLinks: false,
      sortOrder: "modified",
    });
  });

  it("deduplicates root paths and ignores invalid entries", () => {
    expect(
      normalizeSettings({
        rootNotePaths: [
          "Projects/Home.md",
          null,
          "",
          "Projects/Home.md",
          "Areas/Work.md",
        ],
      }).rootNotePaths,
    ).toEqual(["Projects/Home.md", "Areas/Work.md"]);
  });

  it("migrates the legacy single-root setting", () => {
    expect(
      normalizeSettings({ rootNotePath: "Projects/Home.md" }).rootNotePaths,
    ).toEqual(["Projects/Home.md"]);
  });

  it("rounds and bounds a persisted maximum depth", () => {
    expect(normalizeSettings({ maxDepth: -2 }).maxDepth).toBe(1);
    expect(normalizeSettings({ maxDepth: 99 }).maxDepth).toBe(8);
    expect(normalizeSettings({ maxDepth: 3.6 }).maxDepth).toBe(4);
  });
});
