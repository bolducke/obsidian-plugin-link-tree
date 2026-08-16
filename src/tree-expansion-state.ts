import type { LinkTreeDirection } from "./types";

export function createNodeExpansionKey(
  direction: LinkTreeDirection,
  ancestorPaths: readonly string[],
  filePath: string,
): string {
  return JSON.stringify([direction, ...ancestorPaths, filePath]);
}

export class TreeExpansionState {
  private readonly branchStates = new Map<string, boolean>();
  private readonly expandedNodes = new Set<string>();
  private rootsKey = "[]";

  prepareForRoots(rootPaths: readonly string[]): void {
    const rootsKey = JSON.stringify(rootPaths);
    if (rootsKey === this.rootsKey) {
      return;
    }

    this.rootsKey = rootsKey;
    this.branchStates.clear();
    this.expandedNodes.clear();
  }

  isBranchExpanded(key: string, defaultExpanded = true): boolean {
    return this.branchStates.get(key) ?? defaultExpanded;
  }

  setBranchExpanded(key: string, expanded: boolean): void {
    this.branchStates.set(key, expanded);
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

  collapseAll(branchKeys: readonly string[]): void {
    for (const key of branchKeys) {
      this.branchStates.set(key, false);
    }
    this.expandedNodes.clear();
  }
}
