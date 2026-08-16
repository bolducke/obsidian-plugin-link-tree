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
      { link: string; displayText?: string }[]
    > = {},
  ): LinkTreeService {
    const app = {
      metadataCache: {
        getFileCache: (source: TFile) => ({
          links: linksBySource[source.path] ?? [],
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
      showBacklinks: true,
      showOutgoingLinks: true,
      sortOrder: "name",
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
});
