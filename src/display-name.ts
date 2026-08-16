export function resolveDisplayName(
  basename: string,
  displayText: unknown,
): string {
  if (typeof displayText !== "string") {
    return basename;
  }

  const displayName = displayText.trim();
  return displayName.length > 0 ? displayName : basename;
}
