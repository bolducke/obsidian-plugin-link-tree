import { ItemView, setIcon, TFile, WorkspaceLeaf } from "obsidian";

import type LinkTreePlugin from "./main";
import { TreeExpansionState } from "./tree-expansion-state";
import type { LinkTreeDirection, TreeNode } from "./types";

export class LinkTreeView extends ItemView {
  private displayedRootPath: string | null = null;
  private readonly expansionState = new TreeExpansionState();
  private hadConfiguredRoot = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: LinkTreePlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return "link-tree-view";
  }

  getDisplayText(): string {
    return "Link tree";
  }

  getIcon(): string {
    return "git-fork";
  }

  async onOpen(): Promise<void> {
    this.refresh();
  }

  followFile(file: TFile): void {
    this.displayedRootPath = file.path;
    this.refresh();
  }

  refresh(): void {
    const root = this.resolveRoot();
    this.expansionState.prepareForRoot(root?.path ?? null);
    const scrollTop = this.contentEl.scrollTop;
    this.contentEl.empty();
    this.contentEl.addClass("link-tree");
    this.renderHeader();

    if (root === null) {
      this.contentEl.createDiv({
        cls: "link-tree-empty",
        text: "Open a note to browse its links.",
      });
      return;
    }

    const rootEl = this.contentEl.createDiv({ cls: "link-tree-root" });
    this.renderFileLabel(rootEl, root, "file", false);

    if (this.plugin.settings.showOutgoingLinks) {
      this.renderBranch(
        root,
        "outgoing",
        "Links from this note",
        "corner-down-right",
      );
    }
    if (this.plugin.settings.showBacklinks) {
      this.renderBranch(
        root,
        "backlinks",
        "Backlinks to this note",
        "corner-up-left",
      );
    }

    this.contentEl.scrollTop = scrollTop;
  }

  private resolveRoot(): TFile | null {
    const configuredRoot = this.plugin.rootFile;
    if (configuredRoot !== null) {
      this.hadConfiguredRoot = true;
      this.displayedRootPath = configuredRoot.path;
      return configuredRoot;
    }

    if (this.hadConfiguredRoot) {
      this.hadConfiguredRoot = false;
      this.displayedRootPath = null;
    }

    if (this.displayedRootPath !== null) {
      const displayedRoot = this.app.vault.getAbstractFileByPath(
        this.displayedRootPath,
      );
      if (displayedRoot instanceof TFile) {
        return displayedRoot;
      }
    }

    const activeFile = this.plugin.getActiveFile();
    this.displayedRootPath = activeFile?.path ?? null;
    return activeFile;
  }

  private renderHeader(): void {
    const header = this.contentEl.createDiv({ cls: "link-tree-header" });
    header.createSpan({ cls: "link-tree-title", text: "Link Tree" });
    const actions = header.createDiv({ cls: "link-tree-actions" });

    this.createAction(actions, "refresh-cw", "Refresh tree", () =>
      this.refresh(),
    );
    if (this.plugin.rootFile === null && this.plugin.getActiveFile() !== null) {
      this.createAction(actions, "pin", "Set current note as root", () => {
        const activeFile = this.plugin.getActiveFile();
        if (activeFile !== null) {
          void this.plugin.setRootFile(activeFile);
        }
      });
    } else if (this.plugin.rootFile !== null) {
      this.createAction(actions, "pin-off", "Clear root note", () => {
        void this.plugin.clearRootFile();
      });
    }
  }

  private createAction(
    container: HTMLElement,
    icon: string,
    label: string,
    action: () => void,
  ): void {
    const button = container.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": label },
    });
    setIcon(button, icon);
    button.addEventListener("click", action);
  }

  private renderBranch(
    root: TFile,
    direction: LinkTreeDirection,
    label: string,
    icon: string,
  ): void {
    const branch = this.contentEl.createDiv({ cls: "link-tree-branch" });
    const details = branch.createEl("details");
    details.open = this.expansionState.isBranchExpanded(direction);
    details.addEventListener("toggle", () => {
      this.expansionState.setBranchExpanded(direction, details.open);
    });
    const summary = details.createEl("summary", {
      cls: "link-tree-branch-label",
    });
    const iconEl = summary.createSpan({ cls: "link-tree-icon" });
    setIcon(iconEl, icon);
    summary.createSpan({ text: label });

    const children = details.createDiv({ cls: "link-tree-children" });
    this.renderChildren(children, {
      ancestors: new Set([root.path]),
      depth: 0,
      direction,
      file: root,
    });
  }

  private renderChildren(container: HTMLElement, node: TreeNode): void {
    const related = this.plugin.getRelatedFiles(node.file, node.direction);
    if (related.length === 0) {
      container.createDiv({ cls: "link-tree-empty", text: "No related notes" });
      return;
    }

    for (const file of related) {
      const nested = container.createDiv({ cls: "link-tree-node" });
      const isCycle = node.ancestors.has(file.path);
      const canExpand =
        !isCycle && node.depth + 1 < this.plugin.settings.maxDepth;

      if (canExpand) {
        this.renderExpandableNode(nested, file, node);
      } else {
        const row = nested.createDiv({ cls: "link-tree-row" });
        this.renderFileLabel(row, file, isCycle ? "repeat-2" : "file", true);
      }
    }
  }

  private renderExpandableNode(
    container: HTMLElement,
    file: TFile,
    parent: TreeNode,
  ): void {
    const nodeKey = this.getNodeKey(parent, file.path);
    const details = container.createEl("details");
    const summary = details.createEl("summary", { cls: "link-tree-row" });
    this.renderFileLabel(summary, file, "chevron-right", true);

    const childContainer = details.createDiv({ cls: "link-tree-children" });
    if (this.expansionState.isNodeExpanded(nodeKey)) {
      details.open = true;
      this.renderNodeChildren(childContainer, file, parent);
    }

    details.addEventListener("toggle", () => {
      if (details.open) {
        this.expansionState.setNodeExpanded(nodeKey, true);
        if (childContainer.childElementCount === 0) {
          this.renderNodeChildren(childContainer, file, parent);
        }
      } else {
        this.expansionState.setNodeExpanded(nodeKey, false);
      }
    });
  }

  private renderNodeChildren(
    container: HTMLElement,
    file: TFile,
    parent: TreeNode,
  ): void {
    this.renderChildren(container, {
      ancestors: new Set([...parent.ancestors, file.path]),
      depth: parent.depth + 1,
      direction: parent.direction,
      file,
    });
  }

  private getNodeKey(parent: TreeNode, filePath: string): string {
    return JSON.stringify([parent.direction, ...parent.ancestors, filePath]);
  }

  private renderFileLabel(
    container: HTMLElement,
    file: TFile,
    icon: string,
    clickable: boolean,
  ): void {
    const iconEl = container.createSpan({ cls: "link-tree-icon" });
    setIcon(iconEl, icon);

    const label = container.createSpan({
      cls: "link-tree-file-name",
      text: file.basename,
    });
    label.setAttribute("title", file.path);
    if (!clickable) {
      return;
    }

    label.addClass("link-tree-clickable");
    label.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.plugin.openFileFromTree(file);
    });
  }
}
