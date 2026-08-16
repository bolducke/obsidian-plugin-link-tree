export type LinkTreeSortOrder = "name" | "modified" | "created";

export interface LinkTreeSettings {
  followActiveNote: boolean;
  maxDepth: number;
  rootNotePaths: string[];
  showBacklinks: boolean;
  showOutgoingLinks: boolean;
  sortOrder: LinkTreeSortOrder;
}

export const DEFAULT_SETTINGS: LinkTreeSettings = {
  followActiveNote: true,
  maxDepth: 3,
  rootNotePaths: [],
  showBacklinks: true,
  showOutgoingLinks: true,
  sortOrder: "name",
};

const MIN_TREE_DEPTH = 1;
const MAX_TREE_DEPTH = 8;

/**
 * Stored plugin data can outlive a settings schema. Normalize it before the UI
 * or tree renderer consumes it so an edited or older data file stays safe.
 */
export function normalizeSettings(value: unknown): LinkTreeSettings {
  const stored = isRecord(value) ? value : {};

  return {
    followActiveNote: readBoolean(
      stored.followActiveNote,
      DEFAULT_SETTINGS.followActiveNote,
    ),
    maxDepth: readDepth(stored.maxDepth),
    rootNotePaths: readRootNotePaths(stored),
    showBacklinks: readBoolean(
      stored.showBacklinks,
      DEFAULT_SETTINGS.showBacklinks,
    ),
    showOutgoingLinks: readBoolean(
      stored.showOutgoingLinks,
      DEFAULT_SETTINGS.showOutgoingLinks,
    ),
    sortOrder: readSortOrder(stored.sortOrder),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readDepth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.maxDepth;
  }

  return Math.min(MAX_TREE_DEPTH, Math.max(MIN_TREE_DEPTH, Math.round(value)));
}

function readRootNotePaths(stored: Record<string, unknown>): string[] {
  if (Array.isArray(stored.rootNotePaths)) {
    return [
      ...new Set(
        stored.rootNotePaths.filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        ),
      ),
    ];
  }

  // Migrate settings written by versions that supported one configured root.
  return typeof stored.rootNotePath === "string" &&
    stored.rootNotePath.length > 0
    ? [stored.rootNotePath]
    : [];
}

function readSortOrder(value: unknown): LinkTreeSortOrder {
  return value === "modified" || value === "created" || value === "name"
    ? value
    : DEFAULT_SETTINGS.sortOrder;
}
