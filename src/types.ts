import type { TFile } from "obsidian";

export type LinkTreeDirection = "outgoing" | "backlinks";

export interface RelatedFile {
  readonly displayName: string;
  readonly file: TFile;
}

export interface TreeNode {
  readonly ancestors: ReadonlySet<string>;
  /** Number of repeated ancestors expanded on the current path. */
  readonly recursionDepth: number;
  readonly direction: LinkTreeDirection;
  readonly file: TFile;
}
