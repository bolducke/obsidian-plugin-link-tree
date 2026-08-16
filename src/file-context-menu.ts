import {
  App,
  FuzzySuggestModal,
  Menu,
  Modal,
  normalizePath,
  Notice,
  type PaneType,
  Platform,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";

export interface RootMenuAction {
  readonly kind: "add" | "remove";
  readonly run: () => Promise<void>;
}

export function showFileContextMenu(
  app: App,
  leaf: WorkspaceLeaf,
  file: TFile,
  event: MouseEvent,
  openFromTree: (file: TFile, paneType: PaneType) => Promise<void>,
  rootAction?: RootMenuAction,
): void {
  const menu = Menu.forEvent(event);

  if (rootAction !== undefined) {
    menu.addItem((item) =>
      item
        .setTitle(
          rootAction.kind === "add" ? "Add to roots" : "Remove from roots",
        )
        .setIcon(rootAction.kind === "add" ? "pin" : "pin-off")
        .onClick(() => void rootAction.run()),
    );
    menu.addSeparator();
  }

  menu.addItem((item) =>
    item
      .setTitle("Open in new tab")
      .setIcon("file-plus")
      .onClick(() => void openFile(openFromTree, file, "tab")),
  );
  menu.addItem((item) =>
    item
      .setTitle("Open to the right")
      .setIcon("separator-vertical")
      .onClick(() => void openFile(openFromTree, file, "split")),
  );
  if (Platform.isDesktopApp) {
    menu.addItem((item) =>
      item
        .setTitle("Open in new window")
        .setIcon("panel-top-open")
        .onClick(() => void openFile(openFromTree, file, "window")),
    );
  }

  menu.addSeparator();
  menu.addItem((item) =>
    item
      .setTitle("Rename")
      .setIcon("pencil")
      .onClick(() => new RenameFileModal(app, file).open()),
  );
  menu.addItem((item) =>
    item
      .setTitle("Move file to…")
      .setIcon("folder-input")
      .onClick(() => new MoveFileModal(app, file).open()),
  );
  menu.addItem((item) =>
    item
      .setTitle("Make a copy")
      .setIcon("copy-plus")
      .onClick(() => void copyFile(app, file)),
  );

  menu.addSeparator();
  menu.addItem((item) =>
    item
      .setTitle("Copy path")
      .setIcon("copy")
      .onClick(() => void copyToClipboard(file.path, "Path copied")),
  );
  menu.addItem((item) =>
    item
      .setTitle("Copy Obsidian URL")
      .setIcon("link")
      .onClick(
        () =>
          void copyToClipboard(
            createObsidianUrl(app.vault.getName(), file.path),
            "Obsidian URL copied",
          ),
      ),
  );

  menu.addSeparator();
  menu.addItem((item) =>
    item
      .setTitle("Delete")
      .setIcon("trash-2")
      .setWarning(true)
      .onClick(() => void deleteFile(app, file)),
  );

  // Preserve the standard extension point used by Obsidian's file explorer so
  // other plugins can add their normal file actions to this menu.
  app.workspace.trigger("file-menu", menu, file, "link-tree", leaf);
  menu.showAtMouseEvent(event);
}

export function createCopyPath(
  file: Pick<TFile, "basename" | "extension" | "parent">,
  pathExists: (path: string) => boolean,
): string {
  const parentPath = file.parent?.path ?? "";
  const extension = file.extension.length > 0 ? `.${file.extension}` : "";

  for (let copyNumber = 1; ; copyNumber += 1) {
    const suffix = copyNumber === 1 ? " copy" : ` copy ${copyNumber}`;
    const name = `${file.basename}${suffix}${extension}`;
    const path = parentPath.length > 0 ? `${parentPath}/${name}` : name;
    if (!pathExists(path)) {
      return path;
    }
  }
}

export function createObsidianUrl(vaultName: string, filePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
}

async function openFile(
  openFromTree: (file: TFile, paneType: PaneType) => Promise<void>,
  file: TFile,
  paneType: PaneType,
): Promise<void> {
  try {
    await openFromTree(file, paneType);
  } catch (error) {
    showError("Could not open file", error);
  }
}

async function copyFile(app: App, file: TFile): Promise<void> {
  const copyPath = createCopyPath(
    file,
    (path) => app.vault.getAbstractFileByPath(path) !== null,
  );
  try {
    if (file.extension === "md") {
      await app.vault.create(copyPath, await app.vault.read(file));
    } else {
      await app.vault.createBinary(copyPath, await app.vault.readBinary(file));
    }
    new Notice(`Created ${copyPath}`);
  } catch (error) {
    showError("Could not copy file", error);
  }
}

async function deleteFile(app: App, file: TFile): Promise<void> {
  try {
    if (await app.fileManager.promptForDeletion(file)) {
      await app.fileManager.trashFile(file);
    }
  } catch (error) {
    showError("Could not delete file", error);
  }
}

async function copyToClipboard(
  value: string,
  successMessage: string,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    new Notice(successMessage);
  } catch (error) {
    showError("Could not copy to clipboard", error);
  }
}

class RenameFileModal extends Modal {
  private inputEl!: HTMLInputElement;

  constructor(
    app: App,
    private readonly file: TFile,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(`Rename ${this.file.basename}`);
    const form = this.contentEl.createEl("form", {
      cls: "link-tree-file-form",
    });
    form.createEl("label", { text: "File name" });
    this.inputEl = form.createEl("input", {
      attr: {
        autocomplete: "off",
        type: "text",
      },
      value: this.file.basename,
    });

    const buttons = form.createDiv({ cls: "modal-button-container" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const rename = buttons.createEl("button", {
      cls: "mod-cta",
      text: "Rename",
    });
    rename.type = "submit";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.rename();
    });
    this.inputEl.focus();
    this.inputEl.select();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async rename(): Promise<void> {
    const basename = this.inputEl.value.trim();
    if (basename.length === 0 || basename.includes("/")) {
      new Notice("Enter a file name without slashes");
      return;
    }

    const extension =
      this.file.extension.length > 0 ? `.${this.file.extension}` : "";
    const filename = basename.endsWith(extension)
      ? basename
      : `${basename}${extension}`;
    const parentPath = this.file.parent?.path ?? "";
    const newPath = normalizePath(
      parentPath.length > 0 ? `${parentPath}/${filename}` : filename,
    );
    if (newPath === this.file.path) {
      this.close();
      return;
    }
    if (this.app.vault.getAbstractFileByPath(newPath) !== null) {
      new Notice(`A file already exists at ${newPath}`);
      return;
    }

    try {
      await this.app.fileManager.renameFile(this.file, newPath);
      this.close();
    } catch (error) {
      showError("Could not rename file", error);
    }
  }
}

class MoveFileModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private readonly file: TFile,
  ) {
    super(app);
    this.setPlaceholder(`Move ${file.name} to…`);
  }

  getItems(): TFolder[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((entry): entry is TFolder => entry instanceof TFolder)
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  getItemText(folder: TFolder): string {
    return folder.isRoot() ? "/" : folder.path;
  }

  onChooseItem(folder: TFolder): void {
    const newPath = normalizePath(
      folder.isRoot() ? this.file.name : `${folder.path}/${this.file.name}`,
    );
    if (newPath === this.file.path) {
      return;
    }
    if (this.app.vault.getAbstractFileByPath(newPath) !== null) {
      new Notice(`A file already exists at ${newPath}`);
      return;
    }

    void this.app.fileManager
      .renameFile(this.file, newPath)
      .catch((error: unknown) => {
        showError("Could not move file", error);
      });
  }
}

function showError(message: string, error: unknown): void {
  const detail = error instanceof Error ? `: ${error.message}` : "";
  new Notice(`${message}${detail}`);
}
