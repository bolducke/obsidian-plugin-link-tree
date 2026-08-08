import {
  ItemView,
  Plugin,
  TFile,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";

import {
  DEFAULT_SETTINGS,
  LinkTreeSettingTab,
  type LinkTreeSettings,
} from "./settings";

export const VIEW_TYPE_LINK_TREE = "link-tree-view";

type Direction = "outgoing" | "backlinks";

interface TreeNode {
  file: TFile;
  direction: Direction;
  depth: number;
  ancestors: ReadonlySet<string>;
}

export default class LinkTreePlugin extends Plugin {
  settings: LinkTreeSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
    this.registerView(
      VIEW_TYPE_LINK_TREE,
      (leaf) => new LinkTreeView(leaf, this),
    );
    this.addSettingTab(new LinkTreeSettingTab(this.app, this));

    this.addRibbonIcon("git-fork", "Open Link Tree", () =>
      void this.activateView(),
    );
    this.addCommand({
      id: "open-link-tree",
      name: "Open Link Tree",
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "refresh-link-tree",
      name: "Refresh Link Tree",
      callback: () => this.refreshViews(),
    });

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        if (this.settings.followActiveNote) this.refreshViews();
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => this.refreshViews()),
    );
    this.registerEvent(this.app.vault.on("rename", () => this.refreshViews()));
    this.registerEvent(this.app.vault.on("delete", () => this.refreshViews()));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_LINK_TREE);
  }

  async updateSettings(update: Partial<LinkTreeSettings>): Promise<void> {
    this.settings = { ...this.settings, ...update };
    await this.saveData(this.settings);
    this.refreshViews();
  }

  async activateView(): Promise<void> {
    const leaf = this.app.workspace.getLeftLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE_LINK_TREE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_LINK_TREE)) {
      const view = leaf.view;
      if (view instanceof LinkTreeView) view.refresh();
    }
  }

  getActiveFile(): TFile | null {
    return this.app.workspace.getActiveFile();
  }

  getRelatedFiles(file: TFile, direction: Direction): TFile[] {
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    const relatedPaths =
      direction === "outgoing"
        ? Object.keys(resolvedLinks[file.path] ?? {})
        : Object.keys(resolvedLinks).filter(
            (sourcePath) => resolvedLinks[sourcePath]?.[file.path] !== undefined,
          );

    return relatedPaths
      .map((path) => this.app.vault.getAbstractFileByPath(path))
      .filter((entry): entry is TFile => entry instanceof TFile)
      .sort((left, right) => left.basename.localeCompare(right.basename));
  }
}

class LinkTreeView extends ItemView {
  private pinnedFile: TFile | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: LinkTreePlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_LINK_TREE;
  }

  getDisplayText(): string {
    return "Link Tree";
  }

  getIcon(): string {
    return "git-fork";
  }

  async onOpen(): Promise<void> {
    this.refresh();
  }

  refresh(): void {
    const root = this.pinnedFile ?? this.plugin.getActiveFile();
    this.contentEl.empty();
    this.contentEl.addClass("link-tree");
    this.renderHeader(root);

    if (root === null) {
      this.contentEl
        .createDiv({ cls: "link-tree-empty", text: "Open a note to browse its links." });
      return;
    }

    const rootEl = this.contentEl.createDiv({ cls: "link-tree-root" });
    this.renderFileLabel(rootEl, root, "file", false);

    if (this.plugin.settings.showOutgoingLinks) {
      this.renderBranch(root, "outgoing", "Links from this note", "corner-down-right");
    }
    if (this.plugin.settings.showBacklinks) {
      this.renderBranch(root, "backlinks", "Backlinks to this note", "corner-up-left");
    }
  }

  private renderHeader(root: TFile | null): void {
    const header = this.contentEl.createDiv({ cls: "link-tree-header" });
    header.createSpan({ cls: "link-tree-title", text: "Link Tree" });
    const actions = header.createDiv({ cls: "link-tree-actions" });

    this.createAction(actions, "refresh-cw", "Refresh tree", () => this.refresh());
    this.createAction(
      actions,
      this.pinnedFile === null ? "pin" : "pin-off",
      this.pinnedFile === null ? "Pin current note" : "Unpin tree root",
      () => {
        this.pinnedFile = this.pinnedFile === null ? root : null;
        this.refresh();
      },
    );
  }

  private createAction(
    container: HTMLElement,
    icon: string,
    label: string,
    action: () => void,
  ): void {
    const button = container.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
    setIcon(button, icon);
    button.addEventListener("click", action);
  }

  private renderBranch(
    root: TFile,
    direction: Direction,
    label: string,
    icon: string,
  ): void {
    const branch = this.contentEl.createDiv({ cls: "link-tree-branch" });
    const details = branch.createEl("details", { attr: { open: "" } });
    const summary = details.createEl("summary", { cls: "link-tree-branch-label" });
    const iconEl = summary.createSpan({ cls: "link-tree-icon" });
    setIcon(iconEl, icon);
    summary.createSpan({ text: label });
    const children = details.createDiv({ cls: "link-tree-children" });
    this.renderChildren(children, {
      file: root,
      direction,
      depth: 0,
      ancestors: new Set([root.path]),
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
      const canExpand = !isCycle && node.depth + 1 < this.plugin.settings.maxDepth;
      if (canExpand) {
        const details = nested.createEl("details");
        const summary = details.createEl("summary", { cls: "link-tree-row" });
        this.renderFileLabel(summary, file, "chevron-right", true);
        const childContainer = details.createDiv({ cls: "link-tree-children" });
        details.addEventListener("toggle", () => {
          if (details.open && childContainer.childElementCount === 0) {
            this.renderChildren(childContainer, {
              file,
              direction: node.direction,
              depth: node.depth + 1,
              ancestors: new Set([...node.ancestors, file.path]),
            });
          }
        });
      } else {
        const row = nested.createDiv({ cls: "link-tree-row" });
        this.renderFileLabel(row, file, isCycle ? "repeat-2" : "file", true);
      }
    }
  }

  private renderFileLabel(
    container: HTMLElement,
    file: TFile,
    icon: string,
    clickable: boolean,
  ): void {
    const iconEl = container.createSpan({ cls: "link-tree-icon" });
    setIcon(iconEl, icon);
    const label = container.createSpan({ cls: "link-tree-file-name", text: file.basename });
    label.setAttribute("title", file.path);
    if (clickable) {
      label.addClass("link-tree-clickable");
      label.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.app.workspace.getLeaf().openFile(file);
      });
    }
  }
}

