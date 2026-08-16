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
}
