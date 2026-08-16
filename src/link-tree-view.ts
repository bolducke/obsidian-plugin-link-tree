import { ItemView, Menu, setIcon, TFile, WorkspaceLeaf } from "obsidian";

import { showFileContextMenu } from "./file-context-menu";
import type LinkTreePlugin from "./main";
import { RootNoteModal } from "./root-note-modal";
import type { LinkTreeSortOrder } from "./settings-model";
import {
  createNodeExpansionKey,
  TreeExpansionState,
} from "./tree-expansion-state";
import type { LinkTreeDirection, TreeNode } from "./types";

export class LinkTreeView extends ItemView {
  private displayedRootPath: string | null = null;
  private readonly expansionState = new TreeExpansionState();
  private hadConfiguredRoots = false;
  private treeEl: HTMLElement | null = null;

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
    return "git-branch";
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
    const scrollTop = this.treeEl?.scrollTop ?? 0;
    this.contentEl.empty();
    this.contentEl.addClass("link-tree");
    this.contentEl.removeClass("nav-files-container");
    this.renderNavHeader(roots);
    this.treeEl = this.contentEl.createDiv({
      cls: "nav-files-container node-insert-event link-tree-files",
    });

    if (roots.length === 0 && !this.plugin.hasConfiguredRoots) {
      this.treeEl.createDiv({
        cls: "link-tree-empty",
        text: "Open a note to browse its links.",
      });
      this.treeEl.scrollTop = scrollTop;
      return;
    }

    if (roots.length === 0) {
      this.treeEl.createDiv({
        cls: "link-tree-empty",
        text: "The configured root notes could not be found.",
      });
    }

    for (const root of roots) {
      this.renderRoot(this.treeEl, root);
    }

    if (this.plugin.hasConfiguredRoots) {
      this.renderUnlinkedSection(this.treeEl, roots);
    }

    this.treeEl.scrollTop = scrollTop;
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

  private renderNavHeader(roots: readonly TFile[]): void {
    const header = this.contentEl.createDiv({ cls: "nav-header" });
    const actions = header.createDiv({ cls: "nav-buttons-container" });

    this.createNavAction(actions, "git-branch-plus", "Add root note", () => {
      new RootNoteModal(
        this.app,
        (file) => this.plugin.addRootFile(file),
        this.plugin.settings.rootNotePaths,
      ).open();
    });
    this.createNavAction(actions, "sort-asc", "Change sort order", (event) =>
      this.showSortMenu(event),
    );
    const followAction = this.createNavAction(
      actions,
      "gallery-vertical",
      "Follow active note",
      () => {
        void this.plugin.updateSettings({
          followActiveNote: !this.plugin.settings.followActiveNote,
        });
      },
    );
    followAction.toggleClass(
      "is-active",
      this.plugin.settings.followActiveNote,
    );
    this.createNavAction(actions, "chevrons-down-up", "Collapse all", () => {
      this.collapseAll(roots);
    });
  }

  private createNavAction(
    container: HTMLElement,
    icon: string,
    label: string,
    action: (event: MouseEvent) => void,
  ): HTMLElement {
    const button = container.createDiv({
      cls: "clickable-icon nav-action-button",
      attr: { "aria-label": label },
    });
    setIcon(button, icon);
    button.addEventListener("click", action);
    return button;
  }

  private showSortMenu(event: MouseEvent): void {
    const menu = Menu.forEvent(event);
    const options: readonly {
      label: string;
      value: LinkTreeSortOrder;
    }[] = [
      { label: "Link order (as written)", value: "link" },
      { label: "File name (A to Z)", value: "name" },
      {
        label: "Modified time (new to old)",
        value: "modified",
      },
      {
        label: "Created time (new to old)",
        value: "created",
      },
    ];

    for (const option of options) {
      menu.addItem((item) =>
        item
          .setTitle(option.label)
          .setChecked(this.plugin.settings.sortOrder === option.value)
          .onClick(() => {
            void this.plugin.updateSettings({ sortOrder: option.value });
          }),
      );
    }
    menu.showAtMouseEvent(event);
  }

  private collapseAll(roots: readonly TFile[]): void {
    const branchKeys = roots.map((root) => this.getBranchKey(root, "outgoing"));
    if (this.plugin.hasConfiguredRoots) {
      branchKeys.push("unlinked");
    }

    this.expansionState.collapseAll(branchKeys);
    this.refresh();
  }

  private getBranchKey(root: TFile, direction: LinkTreeDirection): string {
    return JSON.stringify(["root", root.path, direction]);
  }

  private renderRoot(container: HTMLElement, root: TFile): void {
    const branchKey = this.getBranchKey(root, "outgoing");
    const rootNode = container.createEl("details", {
      cls: "tree-item nav-folder link-tree-root-node",
    });
    rootNode.open = this.expansionState.isBranchExpanded(branchKey);
    rootNode.toggleClass("is-collapsed", !rootNode.open);

    const rootEl = rootNode.createEl("summary", {
      cls: "tree-item-self is-clickable nav-file-title link-tree-root",
      attr: { "data-path": root.path },
    });
    const collapseIcon = this.renderFileLabel(
      rootEl,
      root,
      root.basename,
      "chevron-down",
      true,
    );
    collapseIcon?.addClass("nav-folder-collapse-indicator");
    this.prepareDisclosureIcon(collapseIcon, rootNode.open);

    const rootChildren = rootNode.createDiv({
      cls: "tree-item-children nav-folder-children link-tree-root-children",
    });
    this.renderChildren(rootChildren, {
      ancestorPaths: [root.path],
      recursionDepth: 0,
      direction: "outgoing",
      file: root,
    });

    rootNode.addEventListener("toggle", () => {
      this.expansionState.setBranchExpanded(branchKey, rootNode.open);
      rootNode.toggleClass("is-collapsed", !rootNode.open);
      collapseIcon?.toggleClass("is-collapsed", !rootNode.open);
    });
  }

  private renderUnlinkedSection(
    container: HTMLElement,
    roots: readonly TFile[],
  ): void {
    const files = this.plugin.getUnlinkedFiles(roots);
    const branchKey = "unlinked";
    const details = container.createEl("details", {
      cls: "tree-item nav-folder link-tree-branch link-tree-unlinked",
    });
    details.open = this.expansionState.isBranchExpanded(branchKey, false);
    details.toggleClass("is-collapsed", !details.open);

    const summary = details.createEl("summary", {
      cls: "tree-item-self is-clickable nav-folder-title link-tree-branch-label",
    });
    const collapseIcon = summary.createSpan({
      cls: "tree-item-icon collapse-icon nav-folder-collapse-indicator",
    });
    setIcon(collapseIcon, "chevron-down");
    this.prepareDisclosureIcon(collapseIcon, details.open);
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
      collapseIcon.toggleClass("is-collapsed", !details.open);
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
      const isRecursive = node.ancestorPaths.includes(file.path);
      const canExpand =
        file.extension === "md" &&
        this.plugin.hasRelatedFiles(file, node.direction) &&
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
    const isExpanded = this.expansionState.isNodeExpanded(nodeKey);
    details.open = isExpanded;
    const summary = details.createEl("summary", {
      cls: "tree-item-self is-clickable nav-file-title link-tree-row",
      attr: { "data-path": file.path },
    });
    const collapseIcon = this.renderFileLabel(
      summary,
      file,
      displayName,
      "chevron-down",
      true,
      isRecursive,
    );
    this.prepareDisclosureIcon(collapseIcon, isExpanded);

    const childContainer = details.createDiv({
      cls: "tree-item-children nav-folder-children link-tree-children",
    });
    if (isExpanded) {
      this.renderNodeChildren(childContainer, file, parent, isRecursive);
    }
    details.toggleClass("is-collapsed", !details.open);

    details.addEventListener("toggle", () => {
      details.toggleClass("is-collapsed", !details.open);
      collapseIcon?.toggleClass("is-collapsed", !details.open);
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
      ancestorPaths: [...parent.ancestorPaths, file.path],
      recursionDepth: parent.recursionDepth + (isRecursive ? 1 : 0),
      direction: parent.direction,
      file,
    });
  }

  private getNodeKey(parent: TreeNode, filePath: string): string {
    return createNodeExpansionKey(
      parent.direction,
      parent.ancestorPaths,
      filePath,
    );
  }

  private prepareDisclosureIcon(icon: HTMLElement | null, open: boolean): void {
    if (icon === null) {
      return;
    }

    icon.toggleClass("is-collapsed", !open);
    icon.ownerDocument.defaultView?.requestAnimationFrame(() => {
      if (icon.isConnected) {
        icon.addClass("link-tree-disclosure-ready");
      }
    });
  }

  private renderFileLabel(
    container: HTMLElement,
    file: TFile,
    displayName: string,
    icon: string | null,
    clickable: boolean,
    isRecursive = false,
  ): HTMLElement | null {
    let iconEl: HTMLElement | null = null;
    if (icon !== null) {
      iconEl = container.createSpan({
        cls: "tree-item-icon collapse-icon",
      });
      setIcon(iconEl, icon);
    }

    const label = container.createSpan({
      cls: "tree-item-inner nav-file-title-content link-tree-file-name",
      text: displayName,
    });
    const extensionTag =
      file.extension === "md"
        ? null
        : container.createDiv({
            cls: "nav-file-tag",
            text: file.extension,
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
        file.extension === "md"
          ? {
              kind: this.plugin.settings.rootNotePaths.includes(file.path)
                ? "remove"
                : "add",
              run: () =>
                this.plugin.settings.rootNotePaths.includes(file.path)
                  ? this.plugin.removeRootFile(file.path)
                  : this.plugin.addRootFile(file),
            }
          : undefined,
      );
    });

    if (isRecursive) {
      const flair = container.createSpan({ cls: "tree-item-flair-outer" });
      const recursiveIcon = flair.createSpan({
        cls: "tree-item-flair link-tree-recursive-icon",
        attr: {
          "aria-label": "Links to a note already on this branch",
          title: "Links to a note already on this branch",
        },
      });
      setIcon(recursiveIcon, "repeat-2");
    }
    if (!clickable) {
      return iconEl;
    }

    label.addClass("link-tree-clickable");
    label.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.plugin.openFileFromTree(file);
    });
    extensionTag?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.plugin.openFileFromTree(file);
    });
    return iconEl;
  }
}
