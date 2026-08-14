import type { TFile } from "obsidian";

export type LinkTreeDirection = "outgoing" | "backlinks";

export interface TreeNode {
  readonly ancestors: ReadonlySet<string>;
  readonly depth: number;
  readonly direction: LinkTreeDirection;
  readonly file: TFile;
}
