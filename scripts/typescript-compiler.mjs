// Build-time-only projection of the pinned Apache-2.0 TypeScript distribution.
// No dependency file is modified. See docs/COMPILER.md for modifications/provenance.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { build } from 'esbuild';

export const compilerVersion = '5.9.3';
export const compilerSourceSha256 = '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675';
export const compilerSourceCommit = 'c63de15a992d37f0d6cec03ac7631872838602cb';
export const compilerApi = Object.freeze([
  'version', 'createSourceFile', 'ScriptTarget', 'ScriptKind',
  'isImportDeclaration', 'isExportDeclaration', 'isStringLiteral',
  'isImportEqualsDeclaration', 'isImportTypeNode', 'isCallExpression',
  'isNewExpression', 'SyntaxKind', 'isIdentifier', 'forEachChild',
  'ModuleKind', 'ModuleResolutionKind', 'JsxEmit', 'createProgram',
  'getPreEmitDiagnostics', 'flattenDiagnosticMessageText', 'transpileModule',
  'getTokenPosOfNode', 'getLineAndCharacterOfPosition',
]);
const sha = text => createHash('sha256').update(text).digest('hex');
const parse = text => ts.createSourceFile('restricted-typescript.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/** AST audit: strings/comments are data, but executable loading/evaluation is forbidden. */
export function auditCompiler(code) {
  const source = parse(code);
  assert.equal(source.parseDiagnostics.length, 0, 'Projected compiler must parse as JavaScript');
  const findings = [];
  const forbidden = new Set(['require', '__require', 'createRequire', 'eval', 'Function']);
  function visit(node) {
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && (
      node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && forbidden.has(node.expression.text)) ||
      (ts.isPropertyAccessExpression(node.expression) && forbidden.has(node.expression.name.text)) ||
      (ts.isElementAccessExpression(node.expression) && ts.isStringLiteral(node.expression.argumentExpression) && forbidden.has(node.expression.argumentExpression.text))
    )) findings.push(node.getText(source).slice(0, 160));
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.deepEqual(findings, [], 'Restricted compiler contains executable module loading/evaluation');
}

export async function restrictedTypeScript(root) {
  assert.equal(ts.version, compilerVersion, 'Re-audit compiler projection before changing TypeScript');
  const require = createRequire(path.join(root, 'package.json'));
  const source = await readFile(require.resolve('typescript'), 'utf8');
  assert.equal(sha(source), compilerSourceSha256, 'Pinned TypeScript source mismatch; refusing to project changed dependency bytes');
  const markers = [...source.matchAll(/^\/\/ (src\/[\w./-]+\.ts)\r?\n/gm)];
  const chunks = markers.map((match, index) => ({ name: match[1], text: source.slice(match.index, markers[index + 1]?.index ?? source.length) }));
  assert.equal(chunks.length, 267, 'Unexpected upstream section count');
  const duplicates = chunks.filter((chunk, index) => chunks.findIndex(first => first.name === chunk.name) !== index).map(chunk => chunk.name);
  assert.deepEqual(duplicates, ['src/typescript/typescript.ts'], 'Only the known upstream export wrapper may repeat');
  const selected = chunks.filter(chunk => chunk.name.startsWith('src/compiler/') || chunk.name === 'src/services/transpile.ts');
  assert.equal(selected.length, 77, 'Unexpected compiler section boundary');
  assert.equal(new Set(selected.map(chunk => chunk.name)).size, selected.length, 'Selected compiler sections must be unique');
  function section(name) {
    const matches = selected.filter(chunk => chunk.name === name);
    assert.equal(matches.length, 1, `Missing compiler section ${name}`);
    return matches[0];
  }
  function removeNodeSystem(text) {
    const ast = parse(text);
    const declaration = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]).find(node => ts.isIdentifier(node.name) && node.name.text === 'sys');
    assert.ok(declaration?.initializer, 'Missing sys initializer');
    assert.match(declaration.initializer.getText(ast), /require\(modulePath\)/, 'Node system boundary changed');
    return text.slice(0, declaration.initializer.getStart(ast)) + 'undefined' + text.slice(declaration.initializer.end);
  }
  function removeNodePerformance(text) {
    const ast = parse(text);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'tryGetPerformance');
    const branch = fn?.body.statements[0];
    assert.ok(branch && ts.isIfStatement(branch), 'Missing Node performance branch');
    assert.match(branch.getText(ast), /require\("perf_hooks"\)/);
    return text.slice(0, branch.getStart(ast)) + text.slice(branch.end);
  }
  function helper(name) {
    const matches = [];
    for (const chunk of chunks.filter(chunk => chunk.name.startsWith('src/services/'))) {
      const ast = parse(chunk.text);
      for (const node of ast.statements) if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node.getText(ast));
    }
    assert.equal(matches.length, 1, `Expected one pinned helper ${name}`);
    return matches[0];
  }
  section('src/compiler/sys.ts').text = removeNodeSystem(section('src/compiler/sys.ts').text);
  section('src/compiler/performanceCore.ts').text = removeNodePerformance(section('src/compiler/performanceCore.ts').text);
  section('src/compiler/tracing.ts').text = 'var tracing = undefined; var tracingEnabled = undefined; function startTracing(){ throw new Error("Compiler tracing is disabled"); } function dumpTracingLegend() {}';
  // Keep the ORIGINAL diagnostic table verbatim as readable JSON data. It is
  // passed into the compiler, never imported/evaluated as JavaScript.
  section('src/compiler/diagnosticInformationMap.generated.ts').text = 'var Diagnostics = compilerDiagnostics;';
  const headerEnd = source.indexOf('var ts = {};');
  const helperStart = source.indexOf('var __defProp =');
  const helperEnd = source.indexOf('// src/typescript/typescript.ts');
  assert.ok(headerEnd > 0 && helperStart > headerEnd && helperEnd > helperStart);
  const modifiedNotice = '/*! Restricted derivative of TypeScript 5.9.3: Node sys, Node instrumentation and language/server services removed; original diagnostics retained as JSON data. Recipe: scripts/typescript-compiler.mjs. */\n';
  const projected = source.slice(0, headerEnd) + modifiedNotice + '\nexport function createCompiler(compilerDiagnostics) {\n' + source.slice(helperStart, helperEnd) + selected.map(chunk => chunk.text).join('\n') + '\n' + helper('getDefaultCompilerOptions2') + '\n' + helper('cloneCompilerOptions') + '\nreturn { ' + compilerApi.join(', ') + ' };\n}\n';
  auditCompiler(projected);
  const generated = await build({ stdin: { contents: projected, sourcefile: 'restricted-typescript.js', resolveDir: root, loader: 'js' },
    bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022', treeShaking: true, minify: true,
    legalComments: 'eof', outfile: 'restricted-typescript.mjs', metafile: true, logLevel: 'silent' });
  assert.deepEqual(Object.values(generated.metafile.outputs).flatMap(output => output.imports), [], 'Compiler must have no external imports');
  const code = generated.outputFiles[0].text;
  auditCompiler(code);
  const diagnostics = JSON.stringify({ schemaVersion: 1, typescriptVersion: compilerVersion, messages: ts.Diagnostics });
  const manifest = { schemaVersion: 1, typescriptVersion: compilerVersion, sourceCommit: compilerSourceCommit,
    sourceSha256: compilerSourceSha256, api: compilerApi, sections: selected.map(chunk => chunk.name),
    modifications: ['Node sys initializer removed', 'Node performance branch removed', 'trace writer disabled', 'language/server services excluded except transpile and two original helpers', 'unaltered diagnostics separated into JSON data'],
    diagnostics: { file: 'typescript-diagnostics.json', sha256: sha(diagnostics), count: Object.keys(ts.Diagnostics).length },
    compiler: { sha256: sha(code), bytes: Buffer.byteLength(code), executableLoads: 0, externalImports: 0 } };
  const plugin = { name: 'restricted-typescript', setup(builder) {
    builder.onResolve({ filter: /compiler-assets[\/]typescript-api\.js$/ }, () => ({ path: 'typescript-5.9.3', namespace: 'pi-compiler' }));
    builder.onLoad({ filter: /.*/, namespace: 'pi-compiler' }, () => ({ contents: code, loader: 'js' }));
  } };
  return { code, diagnostics, manifest, plugin };
}
