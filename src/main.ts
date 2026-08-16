import { Plugin, TFile } from "obsidian";

import { LinkTreeService } from "./link-tree-service";
import { LinkTreeView } from "./link-tree-view";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type LinkTreeSettings,
} from "./settings-model";
import { LinkTreeSettingTab } from "./settings";
import { TreeNavigationTracker } from "./tree-navigation-tracker";
import type { LinkTreeDirection } from "./types";

export const VIEW_TYPE_LINK_TREE = "link-tree-view";

export default class LinkTreePlugin extends Plugin {
  settings: LinkTreeSettings = DEFAULT_SETTINGS;
  private treeService!: LinkTreeService;
  private readonly treeNavigation = new TreeNavigationTracker();

  async onload(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
    this.treeService = new LinkTreeService(this.app, () => this.settings);

    this.registerView(
      VIEW_TYPE_LINK_TREE,
      (leaf) => new LinkTreeView(leaf, this),
    );
    this.addSettingTab(new LinkTreeSettingTab(this.app, this));

    this.addRibbonIcon(
      "git-fork",
      "Open link tree",
      () => void this.activateView(),
    );
    this.addCommand({
      id: "open",
      name: "Open sidebar",
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "refresh",
      name: "Refresh tree",
      callback: () => this.refreshViews(),
    });
    this.addCommand({
      id: "set-current-note-as-root",
      name: "Add current note as root",
      checkCallback: (checking) => {
        const file = this.getActiveFile();
        if (
          file === null ||
          file.extension !== "md" ||
          this.settings.rootNotePaths.includes(file.path)
        ) {
          return false;
        }
        if (!checking) {
          void this.addRootFile(file);
        }
        return true;
      },
    });
    this.addCommand({
      id: "clear-root-note",
      name: "Clear all root notes",
      checkCallback: (checking) => {
        if (!this.hasConfiguredRoots) {
          return false;
        }
        if (!checking) {
          void this.clearRootFiles();
        }
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (this.treeNavigation.consume(file?.path ?? null)) {
          return;
        }

        if (
          file !== null &&
          file.extension === "md" &&
          !this.hasConfiguredRoots &&
          this.settings.followActiveNote
        ) {
          this.followFileInViews(file);
        }
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => this.refreshViews()),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (
          file instanceof TFile &&
          this.settings.rootNotePaths.includes(oldPath)
        ) {
          void this.updateSettings({
            rootNotePaths:
              file.extension === "md"
                ? this.settings.rootNotePaths.map((path) =>
                    path === oldPath ? file.path : path,
                  )
                : this.settings.rootNotePaths.filter(
                    (path) => path !== oldPath,
                  ),
          });
          return;
        }
        this.refreshViews();
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (
          file instanceof TFile &&
          this.settings.rootNotePaths.includes(file.path)
        ) {
          void this.removeRootFile(file.path);
          return;
        }
        this.refreshViews();
      }),
    );
  }

  async updateSettings(update: Partial<LinkTreeSettings>): Promise<void> {
    this.settings = normalizeSettings({ ...this.settings, ...update });
    await this.saveData(this.settings);
    this.refreshViews();
  }

  get rootFiles(): TFile[] {
    return this.treeService
      .getFilesAtPaths(this.settings.rootNotePaths)
      .filter((file) => file.extension === "md");
  }

  get hasConfiguredRoots(): boolean {
    return this.settings.rootNotePaths.length > 0;
  }

  async addRootFile(file: TFile): Promise<void> {
    if (
      file.extension !== "md" ||
      this.settings.rootNotePaths.includes(file.path)
    ) {
      return;
    }

    await this.updateSettings({
      rootNotePaths: [...this.settings.rootNotePaths, file.path],
    });
  }

  async removeRootFile(path: string): Promise<void> {
    await this.updateSettings({
      rootNotePaths: this.settings.rootNotePaths.filter(
        (rootPath) => rootPath !== path,
      ),
    });
  }

  async clearRootFiles(): Promise<void> {
    await this.updateSettings({ rootNotePaths: [] });
  }

  async activateView(): Promise<void> {
    const leaf = this.app.workspace.getLeftLeaf(false);
    if (leaf === null) {
      return;
    }

    await leaf.setViewState({ type: VIEW_TYPE_LINK_TREE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openFileFromTree(file: TFile): Promise<void> {
    const token = this.treeNavigation.begin(file.path);

    try {
      await this.app.workspace.getLeaf().openFile(file);
    } finally {
      this.treeNavigation.finish(token);
    }
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(
      VIEW_TYPE_LINK_TREE,
    )) {
      const view = leaf.view;
      if (view instanceof LinkTreeView) {
        view.refresh();
      }
    }
  }

  private followFileInViews(file: TFile): void {
    for (const leaf of this.app.workspace.getLeavesOfType(
      VIEW_TYPE_LINK_TREE,
    )) {
      const view = leaf.view;
      if (view instanceof LinkTreeView) {
        view.followFile(file);
      }
    }
  }

  getActiveFile(): TFile | null {
    return this.app.workspace.getActiveFile();
  }

  getRelatedFiles(file: TFile, direction: LinkTreeDirection): TFile[] {
    return this.treeService.getRelatedFiles(file, direction);
  }

  getUnlinkedFiles(roots: readonly TFile[]): TFile[] {
    return this.treeService.getUnlinkedFiles(roots);
  }
}
