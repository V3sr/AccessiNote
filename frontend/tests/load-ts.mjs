// Loads a TypeScript module from src/ for node:test without any extra package.
// It transpiles the file with the project's own `typescript` devDependency to CommonJS,
// then runs it in this Node context. Works on Node 22 (no built-in type stripping needed).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
export const SRC_ROOT = resolve(here, "..", "src");
const nodeRequire = createRequire(import.meta.url);
const cache = new Map();

function resolveLocal(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) {
    base = resolve(SRC_ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null;
  }
  return base.endsWith(".ts") ? base : `${base}.ts`;
}

function loadFile(file) {
  if (cache.has(file)) {
    return cache.get(file).exports;
  }
  const source = readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      sourceMap: false,
    },
  });
  if (result.diagnostics && result.diagnostics.length > 0) {
    const text = ts.formatDiagnostics(result.diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => SRC_ROOT,
      getNewLine: () => "\n",
    });
    throw new Error(`Could not transpile ${file}:\n${text}`);
  }

  const cjsModule = { exports: {} };
  cache.set(file, cjsModule);
  const localRequire = (specifier) => {
    const local = resolveLocal(file, specifier);
    return local ? loadFile(local) : nodeRequire(specifier);
  };
  const wrapper = `(function (exports, require, module, __filename, __dirname) {\n${result.outputText}\n})`;
  const run = vm.runInThisContext(wrapper, { filename: file });
  run(cjsModule.exports, localRequire, cjsModule, file, dirname(file));
  return cjsModule.exports;
}

// relativePath is relative to frontend/src, for example "lib/messages.ts".
export function loadTs(relativePath) {
  return loadFile(resolve(SRC_ROOT, relativePath));
}

export function readSource(relativePath) {
  return readFileSync(resolve(SRC_ROOT, relativePath), "utf8");
}

const DASHES = /[\u2013\u2014]/;

export function hasDash(text) {
  return DASHES.test(text);
}
