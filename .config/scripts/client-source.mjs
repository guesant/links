import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireWebsite } from './paths.cjs';

const ts = requireWebsite('typescript');

export async function clientScript(name) {
  const source = await readFile(
    resolve('website/src/assets/js', `${name}.ts`),
    'utf8',
  );

  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}
