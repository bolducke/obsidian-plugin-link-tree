import type { LinkTreeDirection } from "./types";

export class TreeExpansionState {
  private readonly collapsedBranches = new Set<LinkTreeDirection>();
  private readonly expandedNodes = new Set<string>();
  private rootPath: string | null = null;

  prepareForRoot(rootPath: string | null): void {
    if (rootPath === this.rootPath) {
      return;
    }

    this.rootPath = rootPath;
    this.collapsedBranches.clear();
    this.expandedNodes.clear();
  }

  isBranchExpanded(direction: LinkTreeDirection): boolean {
    return !this.collapsedBranches.has(direction);
  }

  setBranchExpanded(direction: LinkTreeDirection, expanded: boolean): void {
    if (expanded) {
      this.collapsedBranches.delete(direction);
    } else {
      this.collapsedBranches.add(direction);
    }
  }

  isNodeExpanded(key: string): boolean {
    return this.expandedNodes.has(key);
  }

  setNodeExpanded(key: string, expanded: boolean): void {
    if (expanded) {
      this.expandedNodes.add(key);
    } else {
      this.expandedNodes.delete(key);
    }
  }
}
