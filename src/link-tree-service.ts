import { App, TFile } from "obsidian";

import { resolveDisplayName } from "./display-name";
import { findUnlinkedNotePaths } from "./link-graph";
import type { LinkTreeSettings } from "./settings-model";
import type { LinkTreeDirection, RelatedFile } from "./types";

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

  getFilesAtPaths(paths: readonly string[]): TFile[] {
    return paths
      .map((path) => this.getFileAtPath(path))
      .filter((file): file is TFile => file !== null);
  }

  getRelatedFiles(file: TFile, direction: LinkTreeDirection): RelatedFile[] {
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
      .map((relatedFile) => ({
        displayName:
          direction === "outgoing"
            ? this.getOutgoingDisplayName(file, relatedFile)
            : relatedFile.basename,
        file: relatedFile,
      }))
      .sort((left, right) => this.compareRelatedFiles(left, right));
  }

  getUnlinkedFiles(roots: readonly TFile[]): TFile[] {
    const markdownFiles = this.app.vault.getMarkdownFiles();
    const unlinkedPaths = new Set(
      findUnlinkedNotePaths(
        markdownFiles.map((file) => file.path),
        this.app.metadataCache.resolvedLinks,
        roots.map((file) => file.path),
      ),
    );

    return markdownFiles
      .filter((file) => unlinkedPaths.has(file.path))
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

  private compareRelatedFiles(left: RelatedFile, right: RelatedFile): number {
    if (this.getSettings().sortOrder === "name") {
      return (
        left.displayName.localeCompare(right.displayName) ||
        left.file.path.localeCompare(right.file.path)
      );
    }

    return this.compareFiles(left.file, right.file);
  }

  private getOutgoingDisplayName(source: TFile, target: TFile): string {
    const matchingLinks =
      this.app.metadataCache
        .getFileCache(source)
        ?.links?.filter(
          (link) =>
            this.app.metadataCache.getFirstLinkpathDest(link.link, source.path)
              ?.path === target.path,
        ) ?? [];

    const aliasedLink = matchingLinks.find(
      (link) =>
        typeof link.displayText === "string" &&
        link.displayText.trim().length > 0,
    );
    return resolveDisplayName(target.basename, aliasedLink?.displayText);
  }
}
