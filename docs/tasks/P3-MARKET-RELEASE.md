# P3: public releases and official-marketplace submission

Status: GitHub source, tag and preview release are published and the remote package was downloaded and verified. The public repository is [payAgain/pi-canvas](https://github.com/payAgain/pi-canvas), with [v0.1.3 Preview](https://github.com/payAgain/pi-canvas/releases/tag/v0.1.3). Publisher device authorization and GitHub App access to payAgain/pi-canvas now succeeded. The center refused 0.1.3 before registration because main must be exactly main.js. The user approved a separate 0.1.4 Preview compatibility release. Its build, entry-load, official package and i18n checks passed; center dry-run returned readyToPublish=false with seven SEC003 blockers. GitHub publication is in progress; no center version has been submitted. GitHub login is not plugin-center authorization.

## Identity and scope

- Plugin id: local.pi-canvas; current compatibility version: 0.1.4; historical published version: 0.1.3; repository plugin directory: plugin/.
- SDK compatibility import remains @codex-canvas/sdk. No detached-window fallback, added desktop-control grant, automatic chat send or library migration.
- Published source tag: refs/tags/v0.1.3, commit 36be46e7e54a2bcef501c1daec50902de91eb20b. GitHub is a prerelease because the exact 0.1.3 artifact has not yet been installed/reloaded for native verification. Historical 0.1.2 native evidence is not claimed for 0.1.3.
- Runtime files and the official package contain no user library or publisher credentials. Binary artifacts are Release attachments, not source-history files.

## Historical 0.1.3 verification performed

- npm run build passed, including TypeScript checking and self-contained production generation.
- npm test passed: 12 core cases, 12 host-protocol subcases (Node reports 13 including their parent), and 3 trusted-bridge appearance-ordering tests. No failures or skips. Data remained in session-owned test directories; simulated sends did not reach real chats.
- The official publisher i18n gate passed with 0 fail and 7 review notes. The command title stays a string because the public manifest/command SDK requires it; the registered command is localized from pi.app.getLocale. Other notes concern intentional product/version/technical labels. View title and catalog display/safety metadata carry both en and zh-CN; workbench copy has 223 matching keys with typed named placeholders. Generated content and low-level diagnostics remain verbatim.
- Chromium ran the real built workbench and compiled view with a simulated bridge/library/visibility: English initial copy, live zh-CN/en switching, localized theme choices and context copying, retained unsaved source/title and the same iframe element across locale changes, sandbox=allow-scripts without same-origin access, one iframe, actual render-ready, zero send attempts and an empty console were observed. This is not native installation or focus evidence.
- One bounded read-only review identified a delayed initial appearance response overwriting a newer event. It was fixed; tests cover stale responses, failed initial reads after a newer event and locale-only changes not invoking theme rerender. No second broad review was started.
- Official PluginCheck / PluginPack passed. Package: local.pi-canvas-0.1.3.piplug, 24 files, 8,801,713 bytes. SHA-256: `b21f7b444dccc5d5634604b8220b1975288b0eb9f606acd639f485c744611e72`.
- Static warnings: agent.tool.register and agent.prompt.inject require explicit user grants; clipboard.write is used through the front-end bridge and is not visible to the backend-only unused-permission scan.
- Source/document links, version agreement and a GitHub-token/private-key signature scan passed before publication. Upstream MIT notices are preserved.

## Remaining evidence and limitations

Exact 0.1.3/0.1.4 native installation/reload, real clipboard interaction, chat sending and cross-platform operation are not claimed. First automatic reveal/focus still lacks a public host API, with no popup/browser fallback. [0.1.2 native evidence](P1-RIGHT-VIEW.md) remains separate.

The plugin center requires its own authorization and repository binding. No waiting version will be resubmitted, no token is committed/logged, and a GitHub release is not described as marketplace approval. The completed GitHub publication and the currently blocked center step are recorded below.

## Published GitHub result

- Source repository: https://github.com/payAgain/pi-canvas (public). Initial source commit: `36be46e7e54a2bcef501c1daec50902de91eb20b`; annotated tag `v0.1.3` resolves to that commit. The release tag is not moved by later documentation updates.
- Release: https://github.com/payAgain/pi-canvas/releases/tag/v0.1.3 ; draft=false, prerelease=true.
- Assets: local.pi-canvas-0.1.3.piplug (8,801,713 bytes) and SHA256SUMS.txt. GitHub's asset digest matches the official package digest. Both assets were downloaded again to the session test directory; the package hash and its checksum-file entry match `b21f7b444dccc5d5634604b8220b1975288b0eb9f606acd639f485c744611e72`.
- No npm dependency directory, generated plugin build tree, binary package, user library or credential is tracked in source history. The original Codex repository was not changed.

## Plugin-center compatibility / 0.1.4

- Official MCP whoami confirmed publisher payagain; list_repositories confirmed payAgain/pi-canvas after explicit GitHub App authorization. Credentials stay in the documented private credential file, never source or logs.
- The first create_plugin call for 0.1.3 returned: main must be exactly main.js. A subsequent list_plugins showed no plugin created, so no waiting version is being replaced.
- User approved 0.1.4 Preview. main.js forwards to the original backend/main.cjs; plugin/package.json declares CommonJS to isolate directory loading from ancestor ESM settings. Backend resource paths, permissions, UI and generated-code isolation are unchanged.
- npm run build passed (TypeScript and self-contained generation). Entry-load verification confirmed main.js returns the exact backend export object with onLoad/onUnload/onPanelInvoke; no host APIs or user library were invoked. Version consistency passed.
- Official PluginCheck / PluginPack passed: 26 files, 8,802,000 bytes, SHA-256 7fad1e742b50f721c035e179a80483fce6143333ace6d9433f5fbc832ed0c40b. The i18n gate passed with 0 fail and 7 review notes, with the same intentional technical/product strings and command-title limitation as 0.1.3.
- Four installer warnings: high-risk agent grants; the entry-only scanner cannot see agent registration or scoped filesystem calls behind the CommonJS bridge, nor clipboard calls in the trusted front-end. Permissions were not increased.
- Center pack_plugin dry-run returned readable=true, readyToPublish=false, blockers=7, reviews=0. All seven are SEC003 (dynamic module loading) in bundled backend/main.cjs, at lines 19 (four findings), 390, 393 and 398. Its rebuilt preview digest is ab06639f87bf2e1ddf2c9f1230850d9266c4ce032c034d8688892d9e6726d318 (8,802,505 bytes), not the local official artifact digest.
- Bounded inspection found TypeScript diagnostic/completion strings mixed with its real Node module-loading and plugin-service code. The Canvas compiler uses a closed virtual filesystem, but that does not justify declaring every finding a false positive. No obfuscation, string-hiding or audit bypass was applied. Addressing/removing unused loader functionality or obtaining an operator decision is separate work.
- No create_plugin call for 0.1.4 was sent after this blocking dry-run; no pending center version is replaced. Publisher/repository authorization is complete; the remaining blocker is audit, not authentication.
- GitHub Preview publication is in progress. No full regression suite was rerun, and no native 0.1.4 installation evidence is claimed.
