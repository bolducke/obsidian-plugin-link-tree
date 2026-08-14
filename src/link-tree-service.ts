import { App, TFile } from "obsidian";

import type { LinkTreeSettings } from "./settings-model";
import type { LinkTreeDirection } from "./types";

/**
 * Queries Obsidian metadata and applies the plugin's file-ordering policy.
 * Keeping it separate from the view makes rendering code only responsible for
 * presentation and interaction.
 */
export class LinkTreeService {
  constructor(
    private readonly app: App,
    private readonly getSettings: () => Readonly<LinkTreeSettings>,
  ) {}

  getFileAtPath(path: string | null): TFile | null {
    if (path === null) {
      return null;
    }

    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  getRelatedFiles(file: TFile, direction: LinkTreeDirection): TFile[] {
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    const relatedPaths =
      direction === "outgoing"
        ? Object.keys(resolvedLinks[file.path] ?? {})
        : Object.keys(resolvedLinks).filter(
            (sourcePath) =>
              resolvedLinks[sourcePath]?.[file.path] !== undefined,
          );

    return relatedPaths
      .map((path) => this.app.vault.getAbstractFileByPath(path))
      .filter((entry): entry is TFile => entry instanceof TFile)
      .sort((left, right) => this.compareFiles(left, right));
  }

  private compareFiles(left: TFile, right: TFile): number {
    const byPath = () => left.path.localeCompare(right.path);

    switch (this.getSettings().sortOrder) {
      case "modified":
        return right.stat.mtime - left.stat.mtime || byPath();
      case "created":
        return right.stat.ctime - left.stat.ctime || byPath();
      case "name":
        return left.basename.localeCompare(right.basename) || byPath();
    }
  }
}
