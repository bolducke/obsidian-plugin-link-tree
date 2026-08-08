# Link Tree

Link Tree is an Obsidian community-plugin project that presents note links as a familiar, filesystem-like hierarchy in the left sidebar.

The tree starts at the active note by default. You can choose any note as a persistent root from the plugin settings, the sidebar's pin action, or the **Set current note as Link Tree root** command. It then has two expandable branches:

- **Links from this note**: notes linked by the root note and their linked descendants.
- **Backlinks to this note**: notes that link to the root note and their backlink descendants.

Repeated paths are detected and marked instead of being expanded forever. Clicking a note opens it in the current workspace.

## Development

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run build
```

The installable plugin files are written to `dist/link-tree/`. Copy that directory into your vault at `.obsidian/plugins/link-tree/`, then enable **Link Tree** in Obsidian's Community plugins settings.

For development, run `npm run dev` to watch the source. Reload Obsidian after changes.

## Current scope

The first version supplies the core browsing experience, a left-sidebar view, a persistent configurable root, refresh control, configurable depth, and independent toggles for outgoing links and backlinks. Future enhancements could add sorting, aliases/tags, and drag-and-drop relationships.
