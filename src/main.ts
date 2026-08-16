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
      name: "Set current note as root",
      checkCallback: (checking) => {
        const file = this.getActiveFile();
        if (file === null) {
          return false;
        }
        if (!checking) {
          void this.setRootFile(file);
        }
        return true;
      },
    });
    this.addCommand({
      id: "clear-root-note",
      name: "Clear root note",
      checkCallback: (checking) => {
        if (this.rootFile === null) {
          return false;
        }
        if (!checking) {
          void this.clearRootFile();
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
          this.rootFile === null &&
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
        if (file instanceof TFile && oldPath === this.settings.rootNotePath) {
          void this.updateSettings({ rootNotePath: file.path });
          return;
        }
        this.refreshViews();
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.path === this.settings.rootNotePath) {
          void this.clearRootFile();
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

  get rootFile(): TFile | null {
    return this.treeService.getFileAtPath(this.settings.rootNotePath);
  }

  async setRootFile(file: TFile): Promise<void> {
    await this.updateSettings({ rootNotePath: file.path });
  }

  async clearRootFile(): Promise<void> {
    await this.updateSettings({ rootNotePath: null });
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
}
