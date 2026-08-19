// Transpile the pure lib modules to a temp dir so the check scripts can import
// them directly. Shared by check-typeform-map.mjs and check-typeform-tags.mjs.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Compile lib/{names}.ts and return the module named by `entry`. */
export async function loadLib(names, entry) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-lib-"));
  for (const name of names) {
    const src = fs.readFileSync(path.join(root, "lib", `${name}.ts`), "utf8");
    const js = ts
      .transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      })
      .outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
    fs.writeFileSync(path.join(outDir, `${name}.mjs`), js);
  }
  return import(path.join(outDir, `${entry}.mjs`));
}
