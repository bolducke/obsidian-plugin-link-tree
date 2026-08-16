# Link Tree

Link Tree is an Obsidian community-plugin project that presents note links as a familiar, filesystem-like hierarchy in the left sidebar.

The tree starts at the active note by default. You can add any number of persistent roots from the plugin settings, the sidebar's pin action, or the **Add current note as root** command. Each root has two expandable branches:

- **Links from this note**: notes linked by the root note and their linked descendants.
- **Backlinks to this note**: notes that link to the root note and their backlink descendants.

Repeated paths are detected and marked instead of being expanded forever. Clicking a note opens it in the current workspace without retargeting or collapsing the tree. When **Follow active note** is enabled, notes opened outside the tree still become its new root.

When persistent roots are configured, the collapsed **Unlinked notes** section lists Markdown notes outside every root's connected link component. Connectivity follows resolved links in either direction across the complete graph, regardless of the sidebar's maximum display depth.

## Development

Requirements: Node.js 24 and npm.

```sh
npm install
npm run build
```

The installable plugin files are written to `dist/link-tree/`. Copy that directory into your vault at `.obsidian/plugins/link-tree/`, then enable **Link Tree** in Obsidian's Community plugins settings.

For development, run `npm run dev` to watch the source. Reload Obsidian after changes.

## Architecture

The plugin keeps Obsidian integration small and assigns each responsibility to
one source module:

- `src/main.ts` — plugin lifecycle, commands, event subscriptions, and wiring
- `src/settings-model.ts` — persisted settings defaults and defensive loading
- `src/settings.ts` — settings UI and root-note picker
- `src/link-graph.ts` — root-component traversal and unlinked-note detection
- `src/link-tree-service.ts` — metadata queries and file ordering
- `src/link-tree-view.ts` — sidebar rendering and interactions
- `src/tree-expansion-state.ts` — expanded branch and node state
- `src/tree-navigation-tracker.ts` — navigation-origin tracking
- `src/types.ts` — shared tree-domain types

## Release

Forgejo is the release authority. It verifies and publishes the Forgejo release
first, then mirrors `main` and the release tag to GitHub. GitHub reacts to the
mirrored tag and creates its matching release. Both releases contain only the
installable `main.js`, `manifest.json`, and `styles.css` files from
`dist/link-tree`.

Before the first release, add a Forgejo repository Actions secret named
`GITHUB_PUSH_TOKEN`. Its value must be a GitHub fine-grained personal access
token restricted to `bolducke/obsidian-link-tree` with **Contents: Read and
write** permission.

To create a release, update the package, manifest, and compatibility map
together, then push the generated tag to Forgejo:

```sh
npm version patch
git push origin --follow-tags
```

You can also use **Forgejo Actions → Release plugin → Run workflow** and enter
a version tag matching `manifest.json` (with or without a leading `v`).

## Current scope

The plugin supplies the core browsing experience, a left-sidebar view, multiple persistent roots, an unlinked-notes section, refresh control, configurable depth, independent toggles for outgoing links and backlinks, and configurable branch sorting. Future enhancements could add aliases/tags and drag-and-drop relationships.
