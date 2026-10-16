# P3: public releases and official-marketplace submission

Current: 0.1.5 fixes the SEC003 compiler boundary. Build, isolated regressions, official packaging and actual center preflight passed (0 blockers, 0 reviews, readyToPublish=true). GitHub 0.1.5 Preview is published and its remote artifact verified. The official center confirms active / published / stable with zero blockers and reviews. Native 0.1.5 evidence is not claimed.

Historical 0.1.3/0.1.4: GitHub source, tag and preview release are published and the remote package was downloaded and verified. The public repository is [payAgain/pi-canvas](https://github.com/payAgain/pi-canvas), with [v0.1.3 Preview](https://github.com/payAgain/pi-canvas/releases/tag/v0.1.3). Publisher device authorization and GitHub App access to payAgain/pi-canvas now succeeded. The center refused 0.1.3 before registration because main must be exactly main.js. The user approved a separate 0.1.4 Preview compatibility release. Its build, entry-load, official package and i18n checks passed; center dry-run returned readyToPublish=false with seven SEC003 blockers. GitHub 0.1.4 Preview is now published and its remote package was downloaded and verified; no center 0.1.4 version has been submitted. GitHub login is not plugin-center authorization.

## Identity and scope

- Plugin id: local.pi-canvas; current version: 0.1.5; historical published versions: 0.1.3/0.1.4; repository plugin directory: plugin/.
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

Exact 0.1.3/0.1.4/0.1.5 native installation/reload, real clipboard interaction, chat sending and cross-platform operation are not claimed. First automatic reveal/focus still lacks a public host API, with no popup/browser fallback. [0.1.2 native evidence](P1-RIGHT-VIEW.md) remains separate.

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
- GitHub Preview: https://github.com/payAgain/pi-canvas/releases/tag/v0.1.4 ; draft=false, prerelease=true. Source/tag commit: a7389805246ba09098c3043d290ee76860f8d7b9. The annotated v0.1.4 tag stays fixed; later documentation commits do not move it.
- Remote local.pi-canvas-0.1.4.piplug and SHA256SUMS.txt were downloaded again; the 8,802,000-byte package, GitHub asset digest and checksum entry all match 7fad1e742b50f721c035e179a80483fce6143333ace6d9433f5fbc832ed0c40b. The published 0.1.3 package/tag remain unchanged.
- The backend, browser runtime and CSS match 0.1.3 byte-for-byte. Type assets differ only in their virtual package.json version (0.1.3 → 0.1.4), not declarations or dependency versions.
- Final plugin_status was queried once and returned an ownership refusal: this account does not own local.pi-canvas. Together with the earlier empty owned-plugin list, no owned plugin or waiting release was obtained in this attempt. This does not establish whether that id exists globally.
- No full regression suite was rerun, and no native 0.1.4 installation evidence is claimed. Center publication remains blocked on SEC003 treatment/operator review; do not report the GitHub release as marketplace approval.

## SEC003 resolution / 0.1.5

Status: implementation/verification passed; GitHub Preview published and center version published on the stable channel. The user explicitly authorized isolated regression and boundary verification. The 0.1.4 source/tag/package remain immutable.

The fix projects the pinned TypeScript npm distribution into a compiler-only API, removes Node system initialization and Node instrumentation, excludes language/server services, and retains the unchanged full diagnostic table as readable JSON data. No executable code is moved behind a different extension, dynamically loaded, encoded or evaluated. See [compiler design/provenance](../COMPILER.md). Native 0.1.5 installation is not yet verified; center clearance will be recorded from the actual response.

- npm run build passed. Regressions: 12 core, 12 host subcases (13 including parent), 3 bridge and 4 compiler cases; all passed, no skips. Compiler parity covers all 11 examples plus 7 boundary inputs, comparing complete output/diagnostics to full TypeScript. The 0.1.4 test-fixture manifest path was corrected to exercise the real main.js entry.
- One bounded static review found no concrete in-scope defect; no second review was started. All generated-code inputs remained unexecuted in Node; no real user library or real chat send was used.
- Official PluginCheck/PluginPack passed: 27 files, 7,778,946 bytes, SHA-256 bd8df7ca6337794c8ef7b84783469b1beddeabe3525499fea9315d4dd1e0458c. Four known installer permission warnings remain; permissions were not expanded. i18n: 0 fail, 7 explained review notes.
- Actual center pack_plugin: readable=true, readyToPublish=true, blockers=0, reviews=0, findings=[]. The rebuilt preview is 7,779,471 bytes with SHA-256 8fddac21ff72cf33800627a65676d1ff175d946a0582ae59bd22bdbd0ee665ce. Every runtime file and key host-manifest block was verified against the local official package; diagnostics remain unchanged JSON data.
- Publisher payagain and payAgain/pi-canvas authorization were refreshed; owned plugins and pending reviews were zero before submission. Source v0.1.5 was pushed before the single create_plugin request. The response confirmed bound=true, plugin active and release approved, with zero blockers/reviews.
- Final plugin_status was queried once: local.pi-canvas active; 0.1.5 status=published, channel=stable, sourceRef=v0.1.5, sourceCommit=19455e4a5ce8755d1394db53b6b09bb4199c4689, publishedAt=2026-10-16T07:31:53Z, blockers=0, reviews=0, findings=[]. The center artifact matches the verified rebuilt preview (8fddac21ff72cf33800627a65676d1ff175d946a0582ae59bd22bdbd0ee665ce, 7779471 bytes). No pending version was replaced or resubmitted.
- GitHub: https://github.com/payAgain/pi-canvas/releases/tag/v0.1.5 ; draft=false, prerelease=true. Both official package and SHA256SUMS.txt were downloaded again; local/remote package and checksum entry match bd8df7ca6337794c8ef7b84783469b1beddeabe3525499fea9315d4dd1e0458c. The center calls its published channel stable; the GitHub release remains Preview because native 0.1.5 acceptance has not been performed.
- Release tags and packages for 0.1.3/0.1.4 remain unchanged. Later documentation commits do not move v0.1.5. The original Codex project and real user canvas library were not modified. The SEC003 publishing blocker is resolved; native/visual/cross-platform evidence remains a separate limitation.
