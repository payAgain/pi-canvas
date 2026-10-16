# Publishing PI Canvas

## Source and identity

- Repository: https://github.com/payAgain/pi-canvas
- Plugin id: local.pi-canvas (keep stable for upgrades and data identity).
- Plugin directory: plugin/; build sources and lockfile live at repository root.
- Release version: 0.1.3; source ref: refs/tags/v0.1.3 once pushed.
- Ordinary packages do not install dependencies at runtime. Never include user libraries, tokens or external project files.

## Build and package

1. Use Node.js 22+, npm ci and npm run build from a clean source checkout.
2. Run requested verification in a session-owned temporary directory with PI_SCRATCH_DIR set, and complete the publisher's en/zh-CN i18n gate.
3. Run official PluginCheck and PluginPack against plugin/. If the checkout is an additional root, scripts/stage.mjs can copy the allowlisted build to a dedicated current-workspace plugin directory before these tools. Do not shell-create .piplug archives.
4. Record SHA-256 and retain upstream license notices. Install/reload the exact package for native evidence; a mock browser or build is not native acceptance.

## GitHub release

Commit only source and publication metadata, with no node_modules, generated plugin assets, local data or credentials. Keep a clean working tree, create v0.1.3 on the commit that built the package, push source/tag and attach the official .piplug plus SHA256SUMS.txt and release notes. Artifacts live on Releases, not in source history.

## Official plugin center

The official entry is https://plugins.aiuo.net. Sources stay in the author's repository; do not submit source PRs to the distribution mirror.

Console: My Plugins → Create plugin → package upload → GitHub App repository binding → source ref/version/release notes → submit once. The source plugin subdirectory is plugin/. Later releases use the existing plugin page.

The live publishing guide is https://plugins.aiuo.net/skill.md and MCP is https://plugins.aiuo.net/mcp. For MCP, obtain the center's own authorization (GitHub CLI login is not a plugin-center credential). Store a token only in the documented private token file, never Git/chat/scratch/logs. Send the entire manifest contract, including contributes, activationEvents, fs and i18n; omitting fields changes the installed plugin. Runtime files exclude manifest.json because the center rebuilds it from submitted metadata. Bind the repository first and use a tag/commit already on GitHub. Do not resubmit a waiting version.

The public command/settings API accepts plain-string titles, so manifest command/settings titles use an English fallback; the runtime command is localized through pi.app.getLocale. View title and marketplace display blocks ship en and zh-CN. Generated canvas content and third-party/compiler diagnostics are not translated.

## Evidence and outcome

Record source commit, artifact digest, performed checks, native/mock boundaries and the exact returned review/submission status in [the release task](tasks/P3-MARKET-RELEASE.md). Do not claim approval or market visibility from a successful upload or GitHub release. A missing repo grant or operator review is a real remaining blocker, not a reason to bypass the center.
