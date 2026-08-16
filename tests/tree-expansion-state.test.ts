import { describe, expect, it } from "vitest";

import { TreeExpansionState } from "../src/tree-expansion-state";

describe("TreeExpansionState", () => {
  it("preserves branch and node state when the same root is refreshed", () => {
    const state = new TreeExpansionState();
    state.prepareForRoot("Notes/Root.md");
    state.setBranchExpanded("backlinks", false);
    state.setNodeExpanded("outgoing/Notes/Child.md", true);

    state.prepareForRoot("Notes/Root.md");

    expect(state.isBranchExpanded("backlinks")).toBe(false);
    expect(state.isNodeExpanded("outgoing/Notes/Child.md")).toBe(true);
  });

  it("starts fresh when the displayed root changes", () => {
    const state = new TreeExpansionState();
    state.prepareForRoot("Notes/First.md");
    state.setBranchExpanded("outgoing", false);
    state.setNodeExpanded("outgoing/Notes/Child.md", true);

    state.prepareForRoot("Notes/Second.md");

    expect(state.isBranchExpanded("outgoing")).toBe(true);
    expect(state.isNodeExpanded("outgoing/Notes/Child.md")).toBe(false);
  });
});
