import { App, PluginSettingTab, Setting } from "obsidian";

import type LinkTreePlugin from "./main";
import type { LinkTreeSortOrder } from "./settings-model";

export class LinkTreeSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: LinkTreePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Follow active note")
      .setDesc(
        "Update the tree whenever you open another note when no root notes are set.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.followActiveNote)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ followActiveNote: value });
          }),
      );

    new Setting(containerEl)
      .setName("Maximum depth")
      .setDesc("How many levels of related notes to show below each branch.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 8, 1)
          .setValue(this.plugin.settings.maxDepth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            await this.plugin.updateSettings({ maxDepth: value });
          }),
      );

    new Setting(containerEl)
      .setName("Sort related notes")
      .setDesc("Choose how notes are ordered within each branch.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("name", "File name (a–z)")
          .addOption("modified", "Modified time (newest first)")
          .addOption("created", "Created time (newest first)")
          .setValue(this.plugin.settings.sortOrder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              sortOrder: value as LinkTreeSortOrder,
            });
          }),
      );

    new Setting(containerEl)
      .setName("Show outgoing links")
      .setDesc("Show notes linked from the selected note.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showOutgoingLinks)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ showOutgoingLinks: value });
          }),
      );

    new Setting(containerEl)
      .setName("Show backlinks")
      .setDesc("Show notes that link to the selected note.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showBacklinks)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ showBacklinks: value });
          }),
      );
  }
}
