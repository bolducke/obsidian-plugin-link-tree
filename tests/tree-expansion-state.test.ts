import { describe, expect, it } from "vitest";

import {
  createNodeExpansionKey,
  TreeExpansionState,
} from "../src/tree-expansion-state";

describe("TreeExpansionState", () => {
  it("preserves branch and node state when the same roots are refreshed", () => {
    const state = new TreeExpansionState();
    state.prepareForRoots(["Notes/First.md", "Notes/Second.md"]);
    state.setBranchExpanded("Notes/First.md/backlinks", false);
    state.setNodeExpanded("outgoing/Notes/Child.md", true);

    state.prepareForRoots(["Notes/First.md", "Notes/Second.md"]);

    expect(state.isBranchExpanded("Notes/First.md/backlinks")).toBe(false);
    expect(state.isNodeExpanded("outgoing/Notes/Child.md")).toBe(true);
  });

  it("starts fresh when the displayed root set changes", () => {
    const state = new TreeExpansionState();
    state.prepareForRoots(["Notes/First.md"]);
    state.setBranchExpanded("Notes/First.md/outgoing", false);
    state.setNodeExpanded("outgoing/Notes/Child.md", true);

    state.prepareForRoots(["Notes/First.md", "Notes/Second.md"]);

    expect(state.isBranchExpanded("Notes/First.md/outgoing")).toBe(true);
    expect(state.isNodeExpanded("outgoing/Notes/Child.md")).toBe(false);
  });

  it("supports sections that are collapsed by default", () => {
    const state = new TreeExpansionState();

    expect(state.isBranchExpanded("unlinked", false)).toBe(false);
    state.setBranchExpanded("unlinked", true);
    expect(state.isBranchExpanded("unlinked", false)).toBe(true);
  });

  it("keeps repeated occurrences on a recursive path independent", () => {
    const firstOccurrence = createNodeExpansionKey(
      "outgoing",
      ["A.md", "B.md"],
      "A.md",
    );
    const laterOccurrence = createNodeExpansionKey(
      "outgoing",
      ["A.md", "B.md", "A.md", "B.md"],
      "A.md",
    );
    const state = new TreeExpansionState();

    state.setNodeExpanded(firstOccurrence, true);

    expect(state.isNodeExpanded(firstOccurrence)).toBe(true);
    expect(state.isNodeExpanded(laterOccurrence)).toBe(false);
  });

  it("collapses every visible branch and expanded node", () => {
    const state = new TreeExpansionState();
    state.setBranchExpanded("outgoing", true);
    state.setBranchExpanded("backlinks", true);
    state.setNodeExpanded("outgoing/A.md", true);

    state.collapseAll(["outgoing", "backlinks", "unlinked"]);

    expect(state.isBranchExpanded("outgoing")).toBe(false);
    expect(state.isBranchExpanded("backlinks")).toBe(false);
    expect(state.isBranchExpanded("unlinked")).toBe(false);
    expect(state.isNodeExpanded("outgoing/A.md")).toBe(false);
  });
});
