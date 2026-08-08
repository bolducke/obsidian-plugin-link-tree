import { App, PluginSettingTab, Setting } from "obsidian";

import type LinkTreePlugin from "./main";

export interface LinkTreeSettings {
  followActiveNote: boolean;
  maxDepth: number;
  showBacklinks: boolean;
  showOutgoingLinks: boolean;
}

export const DEFAULT_SETTINGS: LinkTreeSettings = {
  followActiveNote: true,
  maxDepth: 3,
  showBacklinks: true,
  showOutgoingLinks: true,
};

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
      .setDesc("Update the tree whenever you open another note.")
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

