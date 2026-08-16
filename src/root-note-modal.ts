import { App, FuzzySuggestModal, TFile } from "obsidian";

export class RootNoteModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly onChoose: (file: TFile) => Promise<void>,
    private readonly excludedPaths: readonly string[] = [],
  ) {
    super(app);
    this.setPlaceholder("Choose a root note");
  }

  getItems(): TFile[] {
    const excludedPaths = new Set(this.excludedPaths);
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => !excludedPaths.has(file.path));
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    void this.onChoose(file);
  }
}
