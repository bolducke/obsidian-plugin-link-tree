import { describe, expect, it } from "vitest";

import { TreeNavigationTracker } from "../src/tree-navigation-tracker";

describe("TreeNavigationTracker", () => {
  it("consumes the file-open event caused by a tree click once", () => {
    const tracker = new TreeNavigationTracker();
    const token = tracker.begin("Notes/Child.md");

    expect(tracker.consume("Notes/Child.md")).toBe(true);
    expect(tracker.consume("Notes/Child.md")).toBe(false);

    tracker.finish(token);
  });

  it("does not consume unrelated workspace navigation", () => {
    const tracker = new TreeNavigationTracker();
    const token = tracker.begin("Notes/Child.md");

    expect(tracker.consume("Notes/Other.md")).toBe(false);
    expect(tracker.consume(null)).toBe(false);

    tracker.finish(token);
    expect(tracker.consume("Notes/Child.md")).toBe(false);
  });

  it("tracks concurrent tree navigations independently", () => {
    const tracker = new TreeNavigationTracker();
    tracker.begin("Notes/First.md");
    tracker.begin("Notes/Second.md");

    expect(tracker.consume("Notes/Second.md")).toBe(true);
    expect(tracker.consume("Notes/First.md")).toBe(true);
  });
});
