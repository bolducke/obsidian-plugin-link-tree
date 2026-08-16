import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  App: class {},
  TFile: class {
    basename: string;
    path: string;
    stat = { ctime: 0, mtime: 0 };

    constructor(path = "") {
      this.path = path;
      const pathParts = path.replace(/\.md$/, "").split("/");
      this.basename = pathParts[pathParts.length - 1] ?? path;
    }
  },
}));

import { TFile } from "obsidian";

import { LinkTreeService } from "../src/link-tree-service";
import type { LinkTreeSortOrder } from "../src/settings-model";

describe("LinkTreeService link labels", () => {
  let files: Map<string, TFile>;

  beforeEach(() => {
    files = new Map();
  });

  function file(path: string): TFile {
    const pathParts = path.replace(/\.md$/, "").split("/");
    const note = Object.assign(new TFile(), {
      basename: pathParts[pathParts.length - 1] ?? path,
      path,
    });
    files.set(path, note);
    return note;
  }

  function service(
    resolvedLinks: Record<string, Record<string, number>>,
    linksBySource: Record<
      string,
      {
        link: string;
        displayText?: string;
        position?: { start: { offset: number } };
      }[]
    > = {},
    sortOrder: LinkTreeSortOrder = "name",
  ): LinkTreeService {
    const app = {
      metadataCache: {
        getFileCache: (source: TFile) => ({
          links: linksBySource[source.path] ?? [],
          embeds: [],
        }),
        getFirstLinkpathDest: (linkPath: string) =>
          [...files.values()].find(
            (candidate) =>
              candidate.basename === linkPath || candidate.path === linkPath,
          ) ?? null,
        resolvedLinks,
      },
      vault: {
        getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      },
    };

    return new LinkTreeService(app as never, () => ({
      followActiveNote: true,
      maxDepth: 4,
      rootNotePaths: [],
      sortOrder,
    }));
  }

  it("uses an outgoing wikilink's display text", () => {
    const root = file("Root.md");
    const target = file("Notes/Target.md");
    const tree = service(
      { "Root.md": { "Notes/Target.md": 1 } },
      {
        "Root.md": [
          { link: "Target" },
          { link: "Target", displayText: "  Display name  " },
        ],
      },
    );

    expect(tree.getRelatedFiles(root, "outgoing")).toEqual([
      { displayName: "Display name", file: target },
    ]);
  });

  it("falls back to the target filename for an unaliased outgoing link", () => {
    const root = file("Root.md");
    const target = file("Target.md");
    const tree = service(
      { "Root.md": { "Target.md": 1 } },
      { "Root.md": [{ link: "Target" }] },
    );

    expect(tree.getRelatedFiles(root, "outgoing")).toEqual([
      { displayName: "Target", file: target },
    ]);
  });

  it("only treats resolved internal files as children", () => {
    const leaf = file("Leaf.md");
    const parent = file("Parent.md");
    file("Child.md");
    const tree = service(
      { "Parent.md": { "Child.md": 1 } },
      {
        "Leaf.md": [{ link: "https://example.com" }],
        "Parent.md": [{ link: "Child" }],
      },
    );

    expect(tree.hasRelatedFiles(leaf, "outgoing")).toBe(false);
    expect(tree.hasRelatedFiles(parent, "outgoing")).toBe(true);
  });

  it("uses the source filename for backlinks", () => {
    const root = file("Root.md");
    const source = file("Source.md");
    const tree = service(
      { "Source.md": { "Root.md": 1 } },
      { "Source.md": [{ link: "Root", displayText: "Root display name" }] },
    );

    expect(tree.getRelatedFiles(root, "backlinks")).toEqual([
      { displayName: "Source", file: source },
    ]);
  });

  it("preserves the first occurrence of each outgoing link", () => {
    const root = file("Root.md");
    const alpha = file("Alpha.md");
    const beta = file("Beta.md");
    const tree = service(
      { "Root.md": { "Alpha.md": 1, "Beta.md": 2 } },
      {
        "Root.md": [
          { link: "Beta", position: { start: { offset: 5 } } },
          { link: "Alpha", position: { start: { offset: 20 } } },
          { link: "Beta", position: { start: { offset: 40 } } },
        ],
      },
      "link",
    );

    expect(tree.getRelatedFiles(root, "outgoing")).toEqual([
      { displayName: "Beta", file: beta },
      { displayName: "Alpha", file: alpha },
    ]);
  });
});
