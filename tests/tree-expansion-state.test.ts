import { describe, expect, it } from "vitest";

import { TreeExpansionState } from "../src/tree-expansion-state";

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
});
