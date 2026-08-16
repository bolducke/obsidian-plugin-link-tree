import { App, Modal, Setting, TFile } from "obsidian";

import type LinkTreePlugin from "./main";
import { RootNoteModal } from "./root-note-modal";

export class RootNotesModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: LinkTreePlugin,
  ) {
    super(app);
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Manage root notes" });

    const activeFile = this.plugin.getActiveFile();
    const canAddActiveFile =
      activeFile?.extension === "md" &&
      !this.plugin.settings.rootNotePaths.includes(activeFile.path);

    new Setting(contentEl)
      .setName("Add current note as root")
      .setDesc(this.getActiveFileDescription(activeFile, canAddActiveFile))
      .addButton((button) => {
        button
          .setButtonText("Add")
          .setIcon("pin")
          .setDisabled(!canAddActiveFile)
          .onClick(() => {
            if (canAddActiveFile) {
              void this.plugin
                .addRootFile(activeFile)
                .then(() => this.render());
            }
          });
      });

    new Setting(contentEl)
      .setName("Choose another root note")
      .setDesc("Search all Markdown notes in the vault.")
      .addButton((button) => {
        button.setButtonText("Choose note").onClick(() => {
          this.close();
          new RootNoteModal(
            this.app,
            (file) => this.plugin.addRootFile(file),
            this.plugin.settings.rootNotePaths,
          ).open();
        });
      });

    contentEl.createEl("h3", { text: "Current roots" });
    if (!this.plugin.hasConfiguredRoots) {
      contentEl.createDiv({
        cls: "link-tree-modal-empty",
        text: "No persistent root notes are configured.",
      });
      return;
    }

    for (const path of this.plugin.settings.rootNotePaths) {
      new Setting(contentEl).setName(path).addExtraButton((button) => {
        button
          .setIcon("x")
          .setTooltip(`Remove ${path} from roots`)
          .onClick(() => {
            void this.plugin.removeRootFile(path).then(() => this.render());
          });
      });
    }

    new Setting(contentEl)
      .setName("Clear root notes")
      .setDesc("Remove every persistent root note.")
      .addButton((button) => {
        button
          .setButtonText("Clear all")
          .setClass("mod-warning")
          .onClick(() => {
            void this.plugin.clearRootFiles().then(() => this.render());
          });
      });
  }

  private getActiveFileDescription(
    activeFile: TFile | null,
    canAddActiveFile: boolean,
  ): string {
    if (activeFile?.extension !== "md") {
      return "Open a Markdown note to add it as a persistent root.";
    }
    if (!canAddActiveFile) {
      return `${activeFile.path} is already a root note.`;
    }
    return activeFile.path;
  }
}
