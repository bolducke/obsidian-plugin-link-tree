import { ItemView, setIcon, TFile, WorkspaceLeaf } from "obsidian";

import type LinkTreePlugin from "./main";
import { RootNoteModal } from "./root-note-modal";
import { TreeExpansionState } from "./tree-expansion-state";
import type { LinkTreeDirection, TreeNode } from "./types";

export class LinkTreeView extends ItemView {
  private displayedRootPath: string | null = null;
  private readonly expansionState = new TreeExpansionState();
  private hadConfiguredRoots = false;

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
    const roots = this.resolveRoots();
    this.expansionState.prepareForRoots(
      this.plugin.hasConfiguredRoots
        ? this.plugin.settings.rootNotePaths
        : roots.map((root) => root.path),
    );
    const scrollTop = this.contentEl.scrollTop;
    this.contentEl.empty();
    this.contentEl.addClass("link-tree");
    this.renderHeader();

    if (roots.length === 0 && !this.plugin.hasConfiguredRoots) {
      this.contentEl.createDiv({
        cls: "link-tree-empty",
        text: "Open a note to browse its links.",
      });
      return;
    }

    if (roots.length === 0) {
      this.contentEl.createDiv({
        cls: "link-tree-empty",
        text: "The configured root notes could not be found.",
      });
    }

    for (const root of roots) {
      this.renderRoot(root);
    }

    if (this.plugin.hasConfiguredRoots) {
      this.renderUnlinkedSection(roots);
    }

    this.contentEl.scrollTop = scrollTop;
  }

  private resolveRoots(): TFile[] {
    if (this.plugin.hasConfiguredRoots) {
      this.hadConfiguredRoots = true;
      this.displayedRootPath = null;
      return this.plugin.rootFiles;
    }

    if (this.hadConfiguredRoots) {
      this.hadConfiguredRoots = false;
      this.displayedRootPath = null;
    }

    if (this.displayedRootPath !== null) {
      const displayedRoot = this.app.vault.getAbstractFileByPath(
        this.displayedRootPath,
      );
      if (displayedRoot instanceof TFile && displayedRoot.extension === "md") {
        return [displayedRoot];
      }
    }

    const activeFile = this.plugin.getActiveFile();
    if (activeFile?.extension !== "md") {
      this.displayedRootPath = null;
      return [];
    }

    this.displayedRootPath = activeFile.path;
    return [activeFile];
  }

  private renderHeader(): void {
    const header = this.contentEl.createDiv({ cls: "link-tree-header" });
    header.createSpan({ cls: "link-tree-title", text: "Link Tree" });
    const actions = header.createDiv({ cls: "link-tree-actions" });

    this.createAction(actions, "search", "Add root note", () => {
      new RootNoteModal(
        this.app,
        (file) => this.plugin.addRootFile(file),
        this.plugin.settings.rootNotePaths,
      ).open();
    });
    this.createAction(actions, "refresh-cw", "Refresh tree", () =>
      this.refresh(),
    );
    const activeFile = this.plugin.getActiveFile();
    if (
      activeFile?.extension === "md" &&
      !this.plugin.settings.rootNotePaths.includes(activeFile.path)
    ) {
      this.createAction(actions, "pin", "Add current note as root", () => {
        void this.plugin.addRootFile(activeFile);
      });
    }
    if (this.plugin.hasConfiguredRoots) {
      this.createAction(actions, "pin-off", "Clear all root notes", () => {
        void this.plugin.clearRootFiles();
      });
    }
  }

  private renderRoot(root: TFile): void {
    const rootNode = this.contentEl.createDiv({ cls: "link-tree-root-node" });
    const rootEl = rootNode.createDiv({ cls: "link-tree-root" });
    this.renderFileLabel(rootEl, root, root.basename, "file", true);
    if (this.plugin.hasConfiguredRoots) {
      this.createAction(
        rootEl,
        "x",
        `Remove ${root.basename} from roots`,
        () => {
          void this.plugin.removeRootFile(root.path);
        },
      );
    }

    if (this.plugin.settings.showOutgoingLinks) {
      this.renderBranch(
        rootNode,
        root,
        "outgoing",
        "Links from this note",
        "corner-down-right",
      );
    }
    if (this.plugin.settings.showBacklinks) {
      this.renderBranch(
        rootNode,
        root,
        "backlinks",
        "Backlinks to this note",
        "corner-up-left",
      );
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
    container: HTMLElement,
    root: TFile,
    direction: LinkTreeDirection,
    label: string,
    icon: string,
  ): void {
    const branchKey = JSON.stringify(["root", root.path, direction]);
    const branch = container.createDiv({ cls: "link-tree-branch" });
    const details = branch.createEl("details");
    details.open = this.expansionState.isBranchExpanded(branchKey);
    details.addEventListener("toggle", () => {
      this.expansionState.setBranchExpanded(branchKey, details.open);
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

  private renderUnlinkedSection(roots: readonly TFile[]): void {
    const files = this.plugin.getUnlinkedFiles(roots);
    const branchKey = "unlinked";
    const branch = this.contentEl.createDiv({
      cls: "link-tree-branch link-tree-unlinked",
    });
    const details = branch.createEl("details");
    details.open = this.expansionState.isBranchExpanded(branchKey, false);

    const summary = details.createEl("summary", {
      cls: "link-tree-branch-label",
    });
    const iconEl = summary.createSpan({ cls: "link-tree-icon" });
    setIcon(iconEl, "unlink");
    summary.createSpan({ text: `Unlinked notes (${files.length})` });

    const children = details.createDiv({ cls: "link-tree-children" });
    if (details.open) {
      this.renderUnlinkedFiles(children, files);
    }

    details.addEventListener("toggle", () => {
      this.expansionState.setBranchExpanded(branchKey, details.open);
      if (details.open && children.childElementCount === 0) {
        this.renderUnlinkedFiles(children, files);
      }
    });
  }

  private renderUnlinkedFiles(
    container: HTMLElement,
    files: readonly TFile[],
  ): void {
    if (files.length === 0) {
      container.createDiv({
        cls: "link-tree-empty",
        text: "Every note is linked to a root.",
      });
      return;
    }

    for (const file of files) {
      const row = container.createDiv({ cls: "link-tree-row" });
      this.renderFileLabel(row, file, file.basename, "file", true);
    }
  }

  private renderChildren(container: HTMLElement, node: TreeNode): void {
    const related = this.plugin.getRelatedFiles(node.file, node.direction);
    if (related.length === 0) {
      container.createDiv({ cls: "link-tree-empty", text: "No related notes" });
      return;
    }

    for (const { displayName, file } of related) {
      const nested = container.createDiv({ cls: "link-tree-node" });
      const isCycle = node.ancestors.has(file.path);
      const canExpand =
        !isCycle && node.depth + 1 < this.plugin.settings.maxDepth;

      if (canExpand) {
        this.renderExpandableNode(nested, file, displayName, node);
      } else {
        const row = nested.createDiv({ cls: "link-tree-row" });
        this.renderFileLabel(
          row,
          file,
          displayName,
          isCycle ? "repeat-2" : "file",
          true,
        );
      }
    }
  }

  private renderExpandableNode(
    container: HTMLElement,
    file: TFile,
    displayName: string,
    parent: TreeNode,
  ): void {
    const nodeKey = this.getNodeKey(parent, file.path);
    const details = container.createEl("details");
    const summary = details.createEl("summary", { cls: "link-tree-row" });
    this.renderFileLabel(summary, file, displayName, "chevron-right", true);

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
    displayName: string,
    icon: string,
    clickable: boolean,
  ): void {
    const iconEl = container.createSpan({ cls: "link-tree-icon" });
    setIcon(iconEl, icon);

    const label = container.createSpan({
      cls: "link-tree-file-name",
      text: displayName,
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
