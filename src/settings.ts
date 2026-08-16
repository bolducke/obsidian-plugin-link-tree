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
      .setName("Maximum recursion depth")
      .setDesc(
        "How many repeated links to an ancestor can be expanded in one path.",
      )
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
          .addOption("link", "Link order (as written)")
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
  }
}
