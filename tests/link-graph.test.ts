import { describe, expect, it } from "vitest";

import { findUnlinkedNotePaths } from "../src/link-graph";

describe("findUnlinkedNotePaths", () => {
  it("finds notes outside all root components in either link direction", () => {
    const notePaths = ["Root.md", "Child.md", "Parent.md", "Loose.md"];
    const resolvedLinks = {
      "Root.md": { "Child.md": 1 },
      "Parent.md": { "Child.md": 1 },
    };

    expect(
      findUnlinkedNotePaths(notePaths, resolvedLinks, ["Root.md"]),
    ).toEqual(["Loose.md"]);
  });

  it("combines the connected components of multiple roots", () => {
    const notePaths = ["First.md", "First child.md", "Second.md", "Loose.md"];
    const resolvedLinks = {
      "First.md": { "First child.md": 1 },
      "Loose.md": { "Second.md": 1 },
    };

    expect(
      findUnlinkedNotePaths(notePaths, resolvedLinks, [
        "First.md",
        "Second.md",
      ]),
    ).toEqual([]);
  });

  it("ignores links to files outside the Markdown note set", () => {
    expect(
      findUnlinkedNotePaths(
        ["Root.md", "Loose.md"],
        { "Root.md": { "image.png": 1 } },
        ["Root.md"],
      ),
    ).toEqual(["Loose.md"]);
  });
});
