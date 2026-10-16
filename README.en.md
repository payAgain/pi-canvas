# PI Canvas

English · [简体中文](README.md)

**Current version: 0.1.5 Preview. The restricted compiler, full regression chain and official package checks passed. Plugin-center preflight reports zero blockers and zero reviews; [GitHub Preview is published](https://github.com/payAgain/pi-canvas/releases/tag/v0.1.5); the [official plugin center](https://plugins.aiuo.net) confirms published on its stable channel. Native 0.1.5 installation remains unverified.** Published 0.1.3 and 0.1.4 artifacts remain immutable.

Interactive local canvases for the **right work panel in PI-Desktop**. PI Canvas reuses the Codex Canvas SDK, renderer and versioned store, with a separate native PI adapter. It is not an official PI-Desktop or OpenAI product.

## Install

Download [local.pi-canvas-0.1.5.piplug](https://github.com/payAgain/pi-canvas/releases/download/v0.1.5/local.pi-canvas-0.1.5.piplug) and verify its digest against [SHA256SUMS.txt](artifacts/SHA256SUMS.txt). In PI-Desktop choose **Plugins → Install plugin package**, review the permissions and reload. Open **PI Canvas** from the right work-panel view menu. canvas_list should report 0.1.5.

**No detached windows.** The public host SDK cannot automatically reveal or focus contributed views. Tool calls save/select a canvas and return presentation.opened=false with HOST_VIEW_REVEAL_UNAVAILABLE. An already-open visible view adopts the new selection when safe. Hidden views, unpublished source and active selections are not forcibly replaced. Open the view menu manually the first time.

The trusted workbench follows the host's English or Chinese language. Generated canvas content and compiler diagnostics remain authored content; they are not automatically translated.

## Features

- Single-file TSX/JSX, importing only @codex-canvas/sdk (compatibility name retained).
- Sandboxed React previews, persistent JSON state, source/published/state revisions and optimistic version checks.
- Last successful publication retained after compile failures; failed candidate renders do not replace the active iframe.
- Host-authorized project TSX/JSX import, optional following and conflict handling. Restarts do not silently reacquire external access.
- Themes, Design mode selection, versioned edit-context copying, recoverable deletion and title-confirmed permanent removal.
- canvas_status reports trusted-shell readiness separately from compilation and selection; fresh ready is not a screenshot or proof of visual quality.

## Permissions and safety

The trusted Node backend can access its private library and packaged resources. Project file input uses PI's scoped filesystem API. Generated code runs only in an iframe with sandbox=allow-scripts, without same-origin access, networking, forms or a host bridge. This is not a CPU/memory quota or an OS process sandbox.

The default package requests ui.view, agent.tool.register, agent.prompt.inject, fs.read and clipboard.write. It does not request desktop.control, read chat history, modify drafts or send messages. Clipboard writes require a deliberate user action. An optional sending build requires a separate explicit high-risk grant, settings opt-in and a user click bound to the host tool's source session. Do not enable it merely to test the plugin.

Back up the private library before uninstalling. No automatic Codex data migration is performed. External source files are never rewritten by the workbench. See [security boundaries](SECURITY.md).

## Development

Node.js 22+ and npm are required. From a clean checkout:

```powershell
npm ci
npm run build
$env:PI_SCRATCH_DIR = '<an existing session-owned temporary directory>'
npm test
```

Load plugin/ as a development plugin after building. The installed artifact is self-contained and does not run npm install. See [architecture](docs/ARCHITECTURE.md), [SDK](docs/SDK.md), [publishing](docs/PUBLISHING.md) and [release record](docs/tasks/P3-MARKET-RELEASE.md). GitHub release availability and official marketplace approval are distinct states.

## Evidence and limitations

0.1.5 passed 12 core cases, 12 host subcases, 3 bridge cases and 4 compiler cases, including exact parity with full TypeScript for all examples/boundary inputs. The actual center preflight returned readyToPublish=true with zero blockers/reviews. See [compiler design and provenance](docs/COMPILER.md); preflight is not marketplace approval.

0.1.2 was verified with real installed tools, a visible native view, compile-failure retention, runtime-error reporting/recovery and authorized file switching. The user confirmed a single right-side toolbar with no detached window. Do not treat that as native 0.1.3/0.1.4/0.1.5 or cross-platform evidence; see the current release record. Clipboard, real chat sending and all cross-platform combinations are not claimed as verified.

## License and credits

MIT. Preserve [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the [provenance record](docs/PROVENANCE.md). Based on [Codex Canvas](https://github.com/payAgain/codex-canvas). Author/maintainer: [payAgain](https://github.com/payAgain).
