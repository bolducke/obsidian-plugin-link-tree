import type { TFile } from "obsidian";

export type LinkTreeDirection = "outgoing" | "backlinks";

export interface RelatedFile {
  readonly displayName: string;
  readonly file: TFile;
}

export interface TreeNode {
  /** Ordered path to this node, retaining repeated files in recursive paths. */
  readonly ancestorPaths: readonly string[];
  /** Number of repeated ancestors expanded on the current path. */
  readonly recursionDepth: number;
  readonly direction: LinkTreeDirection;
  readonly file: TFile;
}
