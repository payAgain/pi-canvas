# Restricted TypeScript compiler

PI Canvas retains TypeScript 5.9.3 semantic checking, the real checker, and upstream JSX/CommonJS transpilation. Generated React still executes only in the script-only Canvas iframe, never in Node.

## Reproducible input

The npm dependency remains pinned. [The build recipe](../scripts/typescript-compiler.mjs) reads, but never modifies, the installed TypeScript distribution and refuses any source/hash or expected section/AST-shape mismatch.

- TypeScript: 5.9.3, Apache-2.0, Microsoft copyright preserved.
- Upstream commit: c63de15a992d37f0d6cec03ac7631872838602cb.
- npm lib/typescript.js SHA-256: 3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675.

Only compiler sections, services/transpile and its two original helpers (default compiler options and option cloning) contribute to the private runtime API. Language services, server/plugin discovery, completions and their registration code are not selected. Full npm TypeScript is still used by the development type checker and build-time declaration generation, not bundled into the plugin backend.

## Explicit modifications

1. Replace only the Node sys initializer with undefined, preserving shared compiler enums/utilities from that section. No sys, default filesystem host, CLI or language-service API is exported; Canvas supplies a closed virtual CompilerHost.
2. Remove the Node perf_hooks branch while retaining the global performance fallback. Disable trace-file writing; tracing is not exported.
3. Preserve the Apache notice and mark the derived compiler as modified. There is no runtime download, dynamic import, evaluator, worker or separate compiler process.
4. Preserve every original diagnostic descriptor and message verbatim as vendor/typescript-diagnostics.json. It is ordinary readable JSON, parsed as data and passed to the compiler factory; it is never evaluated or loaded as code. This separates messages mentioning import/require syntax from executable compiler code. No message is reworded, encoded, split or hidden.
5. Use compiler node-position utilities, Identifier.escapedText and Symbol.escapedName instead of language-service object convenience methods. The source policy, default-export check and semantic diagnostics remain enforced.

The generated vendor/assets.json records the source pin, API allowlist, selected sections, modifications, diagnostic table hash and compiler byte/hash/audit evidence. Build-time AST inspection rejects executable module-loading/evaluation calls; browser-target bundling must report zero external imports. This is a bounded compiler distribution, not a claim that all unrelated host code is sandboxed.

## Verification and evidence limits

[Compiler regressions](../tests/compiler.test.mjs) check the API boundary, exact diagnostic-table equality, AST audit behavior, fail-closed source pinning and exact output/diagnostic parity against full TypeScript for repository examples and boundary inputs. Data and derived bundles remain in a marked session-owned temporary directory. Generated React is not executed by these checks.

The regular core, host and bridge regressions continue to cover compilation, failed-build retention, versions, scoped files, bindings and appearance behavior. Builds/tests do not establish native installation or visual acceptance. Marketplace clearance is recorded from the actual center response in [the release task](tasks/P3-MARKET-RELEASE.md), not inferred from this local audit. A remaining platform false positive must be reported, not bypassed.
