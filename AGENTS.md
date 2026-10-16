# Project instructions

## Start here

Read README.md, docs/ROADMAP.md and the active task in docs/tasks/ before editing.

This is the PI-Desktop adaptation of Codex Canvas. Keep the upstream repository independent. Do not edit the original Codex project as part of PI development.

## Boundaries

- Keep generated-code SDK, renderer, compiler/store, trusted shell and host adapter separate.
- Generated TSX executes only in a sandbox iframe, never in Node, the trusted panel DOM or PI's renderer document.
- Third-party renderer APIs stay behind packages/renderer. Preserve upstream notices and pinned dependencies.
- The public compatibility import stays @codex-canvas/sdk for now.
- External source files go through PI's scoped filesystem API; raw Node fs is for plugin-private data and packaged resources only.
- Session identity comes from host tool context, never inferred active chat, project paths or Codex thread IDs.
- Only explicit user send actions may start turns. Filters, theme, file following and selections must not send messages.
- Preserve the last successful view after compile/render failures. Never automatically retry unknown-result message sends.

## Development and evidence

Use official PluginScaffold for a new plugin skeleton, PluginCheck before PluginPack, and PluginPack for .piplug. Do not shell-create .piplug archives.

Run builds and static plugin checks relevant to changes. Do not add or run tests unless the user explicitly requests testing or verification. Do not label builds or static checks as actual host UI evidence.

Keep roadmap/task statuses consistent. Record unsupported/unknown host capabilities rather than guessing APIs. Use relative links and paths in repository documentation. Do not automatically migrate or delete user libraries.
