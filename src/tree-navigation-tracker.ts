/**
 * Distinguishes notes opened from the tree from ordinary workspace navigation.
 * Obsidian emits `file-open` while `openFile` is still in flight, so a token is
 * kept until either that event consumes it or the navigation finishes.
 */
export class TreeNavigationTracker {
  private readonly pending = new Map<symbol, string>();

  begin(path: string): symbol {
    const token = Symbol(path);
    this.pending.set(token, path);
    return token;
  }

  finish(token: symbol): void {
    this.pending.delete(token);
  }

  consume(path: string | null): boolean {
    if (path === null) {
      return false;
    }

    for (const [token, pendingPath] of this.pending) {
      if (pendingPath === path) {
        this.pending.delete(token);
        return true;
      }
    }

    return false;
  }
}
