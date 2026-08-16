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
    let relatedPaths =
      direction === "outgoing"
        ? Object.keys(resolvedLinks[file.path] ?? {})
        : Object.keys(resolvedLinks).filter(
            (sourcePath) =>
              resolvedLinks[sourcePath]?.[file.path] !== undefined,
          );

    const preserveLinkOrder =
      direction === "outgoing" && this.getSettings().sortOrder === "link";
    if (preserveLinkOrder) {
      relatedPaths = this.orderOutgoingPathsByPosition(file, relatedPaths);
    }

    const relatedFiles = relatedPaths
      .map((path) => this.app.vault.getAbstractFileByPath(path))
      .filter((entry): entry is TFile => entry instanceof TFile)
      .map((relatedFile) => ({
        displayName:
          direction === "outgoing"
            ? this.getOutgoingDisplayName(file, relatedFile)
            : relatedFile.basename,
        file: relatedFile,
      }));

    return preserveLinkOrder
      ? relatedFiles
      : relatedFiles.sort((left, right) =>
          this.compareRelatedFiles(left, right),
        );
  }

  hasRelatedFiles(file: TFile, direction: LinkTreeDirection): boolean {
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    const relatedPaths =
      direction === "outgoing"
        ? Object.keys(resolvedLinks[file.path] ?? {})
        : Object.keys(resolvedLinks).filter(
            (sourcePath) =>
              resolvedLinks[sourcePath]?.[file.path] !== undefined,
          );

    return relatedPaths.some(
      (path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
    );
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
      case "link":
        return left.basename.localeCompare(right.basename) || byPath();
    }
  }

  private compareRelatedFiles(left: RelatedFile, right: RelatedFile): number {
    if (
      this.getSettings().sortOrder === "name" ||
      this.getSettings().sortOrder === "link"
    ) {
      return (
        left.displayName.localeCompare(right.displayName) ||
        left.file.path.localeCompare(right.file.path)
      );
    }

    return this.compareFiles(left.file, right.file);
  }

  private orderOutgoingPathsByPosition(
    source: TFile,
    resolvedPaths: readonly string[],
  ): string[] {
    const resolvedPathSet = new Set(resolvedPaths);
    const orderedPaths: string[] = [];
    const seen = new Set<string>();
    const cache = this.app.metadataCache.getFileCache(source);
    const references = [...(cache?.links ?? []), ...(cache?.embeds ?? [])].sort(
      (left, right) => left.position.start.offset - right.position.start.offset,
    );

    for (const reference of references) {
      const target = this.app.metadataCache.getFirstLinkpathDest(
        reference.link,
        source.path,
      );
      if (
        target !== null &&
        resolvedPathSet.has(target.path) &&
        !seen.has(target.path)
      ) {
        seen.add(target.path);
        orderedPaths.push(target.path);
      }
    }

    // Resolved metadata can contain entries not represented by the current
    // link cache during cache refreshes. Keep them visible and deterministic.
    orderedPaths.push(
      ...resolvedPaths
        .filter((path) => !seen.has(path))
        .sort((left, right) => left.localeCompare(right)),
    );
    return orderedPaths;
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
