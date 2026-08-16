export type ResolvedLinks = Readonly<
  Record<string, Readonly<Record<string, number>>>
>;

/**
 * Returns notes outside every root's weakly connected component. A resolved
 * link connects two notes regardless of which note contains the link.
 */
export function findUnlinkedNotePaths(
  notePaths: readonly string[],
  resolvedLinks: ResolvedLinks,
  rootPaths: readonly string[],
): string[] {
  const knownPaths = new Set(notePaths);
  const adjacency = new Map<string, Set<string>>();

  for (const path of notePaths) {
    adjacency.set(path, new Set());
  }

  for (const sourcePath of notePaths) {
    for (const targetPath of Object.keys(resolvedLinks[sourcePath] ?? {})) {
      if (!knownPaths.has(targetPath)) {
        continue;
      }

      adjacency.get(sourcePath)?.add(targetPath);
      adjacency.get(targetPath)?.add(sourcePath);
    }
  }

  const linkedPaths = new Set<string>();
  const pending = rootPaths.filter((path) => knownPaths.has(path));

  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || linkedPaths.has(path)) {
      continue;
    }

    linkedPaths.add(path);
    for (const relatedPath of adjacency.get(path) ?? []) {
      if (!linkedPaths.has(relatedPath)) {
        pending.push(relatedPath);
      }
    }
  }

  return notePaths.filter((path) => !linkedPaths.has(path));
}
