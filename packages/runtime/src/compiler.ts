import ts from 'typescript';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Diagnostic } from './contracts.js';

interface TypeAssets {
  schemaVersion: 1;
  typescriptVersion: string;
  sdk: string;
  files: Record<string, string>;
}
interface Assets { types: TypeAssets; runtime: string; css: string; }
const assetsByRoot = new Map<string, Promise<Assets>>();

// root is the plugin directory, in development AND after PluginPack deployment.
// No node_modules, source checkout, native compiler, or cwd lookup is used here.
function loadAssets(root: string): Promise<Assets> {
  let pending = assetsByRoot.get(root);
  if (!pending) {
    pending = Promise.all([
      readFile(path.join(root, 'vendor/types.json'), 'utf8'),
      readFile(path.join(root, 'vendor/canvas-runtime.js'), 'utf8'),
      readFile(path.join(root, 'vendor/canvas-runtime.css'), 'utf8'),
    ]).then(([json, runtime, css]) => {
      const types = JSON.parse(json) as TypeAssets;
      if (types.schemaVersion !== 1 || types.typescriptVersion !== ts.version || !types.files[types.sdk]) {
        throw new Error('Canvas compiler assets are missing or incompatible; rebuild the plugin.');
      }
      return { types, runtime, css };
    }).catch((error: unknown) => { assetsByRoot.delete(root); throw error; });
    assetsByRoot.set(root, pending);
  }
  return pending;
}

export async function compile(source: string, root: string) {
  root = path.resolve(root);
  const virtualRoot = path.join(root, 'vendor/types');
  const filename = path.join(virtualRoot, '__canvas__.tsx');
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const diagnostics: Diagnostic[] = [];
  const report = (node: ts.Node, message: string) => {
    const pos = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    diagnostics.push({ phase: 'policy', message, file: 'canvas.tsx', line: pos.line + 1, column: pos.character + 1 });
  };
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (!ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== '@codex-canvas/sdk') report(node, '只允许从 @codex-canvas/sdk 导入。');
    }
    if (ts.isImportEqualsDeclaration(node) || ts.isImportTypeNode(node) ||
        ((ts.isCallExpression(node) || ts.isNewExpression(node)) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && ['require', 'eval', 'Function'].includes(node.expression.text))))) {
      report(node, '不允许动态导入、require 或动态代码执行。');
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (tree.referencedFiles.length || tree.typeReferenceDirectives.length || tree.libReferenceDirectives.length) report(tree, '不允许 triple-slash 引用。');
  if (diagnostics.length) return { diagnostics };

  try {
    const assets = await loadAssets(root);
    // A closed, read-only virtual filesystem: TypeScript can only see the
    // shipped declaration closure and this one user source file.
    const normalize = (file: string) => path.resolve(file).replaceAll('\\', '/');
    const files = new Map(Object.entries(assets.types.files).map(([name, text]) => [normalize(path.join(virtualRoot, name)), text]));
    files.set(normalize(filename), source);
    const directories = new Set<string>();
    const children = new Map<string, Set<string>>();
    for (const file of files.keys()) {
      let directory = path.dirname(file);
      while (!directories.has(normalize(directory))) {
        directories.add(normalize(directory));
        const parent = path.dirname(directory);
        if (parent === directory) break;
        const siblings = children.get(normalize(parent)) ?? new Set<string>();
        siblings.add(path.basename(directory));
        children.set(normalize(parent), siblings);
        directory = parent;
      }
    }
    const libDirectory = path.join(virtualRoot, 'node_modules/typescript/lib');
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX, strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true,
      types: ['react'], typeRoots: [path.join(virtualRoot, 'node_modules/@types')],
      paths: { '@codex-canvas/sdk': [path.join(virtualRoot, assets.types.sdk)] },
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    };
    const host: ts.CompilerHost = {
      getSourceFile(file, language) {
        if (normalize(file) === normalize(filename)) return tree;
        const text = files.get(normalize(file));
        return text === undefined ? undefined : ts.createSourceFile(file, text, language, true);
      },
      getDefaultLibFileName: () => path.join(libDirectory, 'lib.d.ts'),
      getDefaultLibLocation: () => libDirectory,
      getCurrentDirectory: () => virtualRoot,
      getCanonicalFileName: file => file,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: file => files.has(normalize(file)),
      readFile: file => files.get(normalize(file)),
      directoryExists: directory => directories.has(normalize(directory)),
      getDirectories: directory => [...(children.get(normalize(directory)) ?? [])],
      realpath: file => file,
      writeFile: () => { throw new Error('Canvas typechecking must not write files.'); },
    };
    const program = ts.createProgram([filename], options, host);
    const addDiagnostic = (item: ts.Diagnostic) => {
      const pos = item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start) : undefined;
      diagnostics.push({ phase: 'typecheck', message: ts.flattenDiagnosticMessageText(item.messageText, '\n'),
        file: item.file && normalize(item.file.fileName) === normalize(filename) ? 'canvas.tsx' : path.relative(virtualRoot, item.file?.fileName ?? filename).replaceAll('\\', '/'),
        ...(pos ? { line: pos.line + 1, column: pos.character + 1 } : {}) });
    };
    for (const item of ts.getPreEmitDiagnostics(program).slice(0, 30)) addDiagnostic(item);
    if (diagnostics.length) return { diagnostics };
    const checker = program.getTypeChecker();
    const moduleSymbol = checker.getSymbolAtLocation(tree);
    if (!moduleSymbol || !checker.getExportsOfModule(moduleSymbol).some(symbol => symbol.name === 'default')) {
      return { diagnostics: [{ phase: 'bundle', file: 'canvas.tsx', message: '画布必须默认导出 React 组件。' } satisfies Diagnostic] };
    }

    const compiled = ts.transpileModule(source, {
      fileName: 'canvas.tsx', reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, sourceMap: false, inlineSourceMap: false },
    });
    for (const item of (compiled.diagnostics ?? []).slice(0, 30)) addDiagnostic(item);
    if (diagnostics.length) return { diagnostics };

    // These are JS TEXT assets, not evaluated in Node. The only require here
    // is a lexical browser-local allowlist, never Node's module loader.
    const bundle = `(function(){\n"use strict";\n${assets.runtime}\n` +
      `const runtime = PiCanvasRuntime;\n` +
      `const modules = Object.freeze(Object.assign(Object.create(null), {` +
      `"@codex-canvas/sdk":runtime.sdk,"react":runtime.react,` +
      `"react/jsx-runtime":runtime.jsxRuntime,"react/jsx-dev-runtime":runtime.jsxDevRuntime}));\n` +
      `const require = (id) => { if (!Object.prototype.hasOwnProperty.call(modules,id)) throw new Error("Disallowed canvas module: " + id); return modules[id]; };\n` +
      `const module = {exports:{}};\n(function(require,module,exports){\n${compiled.outputText}\n})(require,module,module.exports);\n` +
      `if (typeof module.exports.default !== "function") throw new Error("Canvas must default-export a React component.");\n` +
      `runtime.mount(module.exports.default);\n})();`;
    const css = assets.css;
    const buildHash = createHash('sha256').update(bundle).update(css).digest('hex');
    return { diagnostics, bundle, css, buildHash };
  } catch (error: unknown) {
    return { diagnostics: [{ phase: 'bundle', file: 'canvas.tsx', message: error instanceof Error ? error.message : String(error) } satisfies Diagnostic] };
  }
}
