import { ItemView, setIcon, TFile, WorkspaceLeaf } from "obsidian";

import { showFileContextMenu } from "./file-context-menu";
import type LinkTreePlugin from "./main";
import { RootNoteModal } from "./root-note-modal";
import { RootNotesModal } from "./root-notes-modal";
import { TreeExpansionState } from "./tree-expansion-state";
import type { LinkTreeDirection, TreeNode } from "./types";

export class LinkTreeView extends ItemView {
  private displayedRootPath: string | null = null;
  private readonly expansionState = new TreeExpansionState();
  private hadConfiguredRoots = false;
  private headerActionsInitialized = false;

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
    return "git-fork-plus";
  }

  async onOpen(): Promise<void> {
    this.initializeHeaderActions();
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
    this.contentEl.addClass("nav-files-container");

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

  private initializeHeaderActions(): void {
    if (this.headerActionsInitialized) {
      return;
    }
    this.headerActionsInitialized = true;

    this.addAction("search", "Add root note", () => {
      new RootNoteModal(
        this.app,
        (file) => this.plugin.addRootFile(file),
        this.plugin.settings.rootNotePaths,
      ).open();
    });
    this.addAction("git-fork-plus", "Manage root notes", () => {
      new RootNotesModal(this.app, this.plugin).open();
    });
    this.addAction("refresh-cw", "Refresh tree", () => this.refresh());
  }

  private renderRoot(root: TFile): void {
    const rootNode = this.contentEl.createDiv({
      cls: "tree-item nav-folder link-tree-root-node",
    });
    const rootEl = rootNode.createDiv({
      cls: "tree-item-self is-clickable nav-file-title link-tree-root",
      attr: { "data-path": root.path },
    });
    this.renderFileLabel(rootEl, root, root.basename, null, true);
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

    const rootChildren = rootNode.createDiv({
      cls: "tree-item-children nav-folder-children link-tree-root-children",
    });
    if (this.plugin.settings.showOutgoingLinks) {
      this.renderBranch(
        rootChildren,
        root,
        "outgoing",
        "Links from this note",
        "corner-down-right",
      );
    }
    if (this.plugin.settings.showBacklinks) {
      this.renderBranch(
        rootChildren,
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
    const details = container.createEl("details", {
      cls: "tree-item nav-folder link-tree-branch",
    });
    details.open = this.expansionState.isBranchExpanded(branchKey);
    details.toggleClass("is-collapsed", !details.open);
    details.addEventListener("toggle", () => {
      this.expansionState.setBranchExpanded(branchKey, details.open);
      details.toggleClass("is-collapsed", !details.open);
    });
    const summary = details.createEl("summary", {
      cls: "tree-item-self is-clickable nav-folder-title link-tree-branch-label",
    });
    const collapseIcon = summary.createSpan({
      cls: "tree-item-icon collapse-icon nav-folder-collapse-indicator link-tree-collapse-icon",
    });
    setIcon(collapseIcon, "chevron-right");
    const directionIcon = summary.createSpan({ cls: "link-tree-branch-icon" });
    setIcon(directionIcon, icon);
    summary.createSpan({
      cls: "tree-item-inner nav-folder-title-content",
      text: label,
    });

    const children = details.createDiv({
      cls: "tree-item-children nav-folder-children link-tree-children",
    });
    this.renderChildren(children, {
      ancestors: new Set([root.path]),
      recursionDepth: 0,
      direction,
      file: root,
    });
  }

  private renderUnlinkedSection(roots: readonly TFile[]): void {
    const files = this.plugin.getUnlinkedFiles(roots);
    const branchKey = "unlinked";
    const details = this.contentEl.createEl("details", {
      cls: "tree-item nav-folder link-tree-branch link-tree-unlinked",
    });
    details.open = this.expansionState.isBranchExpanded(branchKey, false);
    details.toggleClass("is-collapsed", !details.open);

    const summary = details.createEl("summary", {
      cls: "tree-item-self is-clickable nav-folder-title link-tree-branch-label",
    });
    const collapseIcon = summary.createSpan({
      cls: "tree-item-icon collapse-icon nav-folder-collapse-indicator link-tree-collapse-icon",
    });
    setIcon(collapseIcon, "chevron-right");
    const iconEl = summary.createSpan({ cls: "link-tree-branch-icon" });
    setIcon(iconEl, "unlink");
    summary.createSpan({
      cls: "tree-item-inner nav-folder-title-content",
      text: `Unlinked notes (${files.length})`,
    });

    const children = details.createDiv({
      cls: "tree-item-children nav-folder-children link-tree-children",
    });
    if (details.open) {
      this.renderUnlinkedFiles(children, files);
    }

    details.addEventListener("toggle", () => {
      this.expansionState.setBranchExpanded(branchKey, details.open);
      details.toggleClass("is-collapsed", !details.open);
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
      const node = container.createDiv({ cls: "tree-item nav-file" });
      const row = node.createDiv({
        cls: "tree-item-self is-clickable nav-file-title link-tree-row",
        attr: { "data-path": file.path },
      });
      this.renderFileLabel(row, file, file.basename, null, true);
    }
  }

  private renderChildren(container: HTMLElement, node: TreeNode): void {
    const related = this.plugin.getRelatedFiles(node.file, node.direction);
    if (related.length === 0) {
      container.createDiv({ cls: "link-tree-empty", text: "No related notes" });
      return;
    }

    for (const { displayName, file } of related) {
      const isRecursive = node.ancestors.has(file.path);
      const canExpand =
        file.extension === "md" &&
        (!isRecursive || node.recursionDepth < this.plugin.settings.maxDepth);

      if (canExpand) {
        this.renderExpandableNode(
          container,
          file,
          displayName,
          node,
          isRecursive,
        );
      } else {
        const nested = container.createDiv({
          cls: "tree-item nav-file link-tree-node",
        });
        const row = nested.createDiv({ cls: "link-tree-row" });
        row.addClasses(["tree-item-self", "is-clickable", "nav-file-title"]);
        row.dataset.path = file.path;
        this.renderFileLabel(row, file, displayName, null, true, isRecursive);
      }
    }
  }

  private renderExpandableNode(
    container: HTMLElement,
    file: TFile,
    displayName: string,
    parent: TreeNode,
    isRecursive: boolean,
  ): void {
    const nodeKey = this.getNodeKey(parent, file.path);
    const details = container.createEl("details", {
      cls: "tree-item nav-file link-tree-node",
    });
    const summary = details.createEl("summary", {
      cls: "tree-item-self is-clickable nav-file-title link-tree-row",
      attr: { "data-path": file.path },
    });
    this.renderFileLabel(
      summary,
      file,
      displayName,
      "chevron-right",
      true,
      isRecursive,
    );

    const childContainer = details.createDiv({
      cls: "tree-item-children nav-folder-children link-tree-children",
    });
    if (this.expansionState.isNodeExpanded(nodeKey)) {
      details.open = true;
      this.renderNodeChildren(childContainer, file, parent, isRecursive);
    }
    details.toggleClass("is-collapsed", !details.open);

    details.addEventListener("toggle", () => {
      details.toggleClass("is-collapsed", !details.open);
      if (details.open) {
        this.expansionState.setNodeExpanded(nodeKey, true);
        if (childContainer.childElementCount === 0) {
          this.renderNodeChildren(childContainer, file, parent, isRecursive);
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
    isRecursive: boolean,
  ): void {
    this.renderChildren(container, {
      ancestors: new Set([...parent.ancestors, file.path]),
      recursionDepth: parent.recursionDepth + (isRecursive ? 1 : 0),
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
    icon: string | null,
    clickable: boolean,
    isRecursive = false,
  ): void {
    if (icon !== null) {
      const iconEl = container.createSpan({
        cls: "tree-item-icon collapse-icon link-tree-collapse-icon",
      });
      setIcon(iconEl, icon);
    }

    const label = container.createSpan({
      cls: "tree-item-inner nav-file-title-content link-tree-file-name",
      text: displayName,
    });
    label.setAttribute("title", file.path);
    container.toggleClass(
      "is-active",
      this.plugin.getActiveFile()?.path === file.path,
    );
    container.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showFileContextMenu(
        this.app,
        this.leaf,
        file,
        event,
        (target, paneType) => this.plugin.openFileFromTree(target, paneType),
      );
    });

    if (isRecursive) {
      const recursiveIcon = container.createSpan({
        cls: "link-tree-recursive-icon",
        attr: {
          "aria-label": "Links to a note already on this branch",
          title: "Links to a note already on this branch",
        },
      });
      setIcon(recursiveIcon, "repeat-2");
    }
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
