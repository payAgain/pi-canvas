# P3: 0.1.3 public release and official-marketplace submission

Status: package checks completed; GitHub preview publication is being prepared. The public repository is [payAgain/pi-canvas](https://github.com/payAgain/pi-canvas). Official plugin-center submission has not occurred: its own publisher authorization and repository grant still need completion. GitHub login is not plugin-center authorization.

## Identity and scope

- Plugin id: local.pi-canvas; version: 0.1.3; repository plugin directory: plugin/.
- SDK compatibility import remains @codex-canvas/sdk. No detached-window fallback, added desktop-control grant, automatic chat send or library migration.
- Source tag planned: refs/tags/v0.1.3. GitHub will be a prerelease because the exact 0.1.3 artifact has not yet been installed/reloaded for native verification. Historical 0.1.2 native evidence is not claimed for 0.1.3.
- Runtime files and the official package contain no user library or publisher credentials. Binary artifacts are Release attachments, not source-history files.

## Verification performed

- npm run build passed, including TypeScript checking and self-contained production generation.
- npm test passed: 12 core cases, 12 host-protocol subcases (Node reports 13 including their parent), and 3 trusted-bridge appearance-ordering tests. No failures or skips. Data remained in session-owned test directories; simulated sends did not reach real chats.
- The official publisher i18n gate passed with 0 fail and 7 review notes. The command title stays a string because the public manifest/command SDK requires it; the registered command is localized from pi.app.getLocale. Other notes concern intentional product/version/technical labels. View title and catalog display/safety metadata carry both en and zh-CN; workbench copy has 223 matching keys with typed named placeholders. Generated content and low-level diagnostics remain verbatim.
- Chromium ran the real built workbench and compiled view with a simulated bridge/library/visibility: English initial copy, live zh-CN/en switching, localized theme choices and context copying, retained unsaved source/title and the same iframe element across locale changes, sandbox=allow-scripts without same-origin access, one iframe, actual render-ready, zero send attempts and an empty console were observed. This is not native installation or focus evidence.
- One bounded read-only review identified a delayed initial appearance response overwriting a newer event. It was fixed; tests cover stale responses, failed initial reads after a newer event and locale-only changes not invoking theme rerender. No second broad review was started.
- Official PluginCheck / PluginPack passed. Package: local.pi-canvas-0.1.3.piplug, 24 files, 8,801,713 bytes. SHA-256: `b21f7b444dccc5d5634604b8220b1975288b0eb9f606acd639f485c744611e72`.
- Static warnings: agent.tool.register and agent.prompt.inject require explicit user grants; clipboard.write is used through the front-end bridge and is not visible to the backend-only unused-permission scan.
- Source/document links, version agreement and a GitHub-token/private-key signature scan passed before publication. Upstream MIT notices are preserved.

## Remaining evidence and limitations

Exact 0.1.3 native installation/reload, real clipboard interaction, chat sending and cross-platform operation are not claimed. First automatic reveal/focus still lacks a public host API, with no popup/browser fallback. [0.1.2 native evidence](P1-RIGHT-VIEW.md) remains separate.

The plugin center requires its own authorization and repository binding. No waiting version will be resubmitted, no token is committed/logged, and a GitHub release is not described as marketplace approval. Final source commit, GitHub release URL and actual center status will be appended after the corresponding operations succeed.
