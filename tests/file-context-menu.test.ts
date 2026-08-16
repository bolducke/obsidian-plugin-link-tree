import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  App: class {},
  FuzzySuggestModal: class {},
  Menu: class {},
  Modal: class {},
  normalizePath: (path: string) => path,
  Notice: class {},
  Platform: { isDesktopApp: true },
  TFile: class {},
  TFolder: class {},
  WorkspaceLeaf: class {},
}));

import { createCopyPath, createObsidianUrl } from "../src/file-context-menu";

describe("file context menu helpers", () => {
  it("places the first copy beside the original file", () => {
    expect(
      createCopyPath(
        {
          basename: "Note",
          extension: "md",
          parent: { path: "Projects" } as never,
        },
        () => false,
      ),
    ).toBe("Projects/Note copy.md");
  });

  it("increments the copy suffix until an available path is found", () => {
    const existing = new Set(["Note copy.md", "Note copy 2.md"]);

    expect(
      createCopyPath(
        { basename: "Note", extension: "md", parent: null },
        (path) => existing.has(path),
      ),
    ).toBe("Note copy 3.md");
  });

  it("encodes vault and file names in Obsidian URLs", () => {
    expect(createObsidianUrl("My Vault", "Ideas/A & B.md")).toBe(
      "obsidian://open?vault=My%20Vault&file=Ideas%2FA%20%26%20B.md",
    );
  });
});
