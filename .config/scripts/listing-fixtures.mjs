import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireWebsite, websiteRoot } from './paths.cjs';

const { compile } = requireWebsite('svelte/compiler');

const { render } = requireWebsite('svelte/server');

const root = resolve(websiteRoot, '.svelte-kit');

await mkdir(root, {
  recursive: true,
});

const output = await mkdtemp(join(root, 'listing-fixtures-'));

const modules = new Map();

async function compileComponent(path) {
  if (modules.has(path)) {
    return modules.get(path);
  }

  const target = join(output, `${modules.size}.mjs`);

  modules.set(path, target);

  let code = compile(await readFile(path, 'utf8'), {
    filename: path,
    generate: 'server',
  }).js.code;

  const imports = [
    ...code.matchAll(/from (['"])(\.[^'"]+)\1/g),
  ];

  for (const match of imports) {
    const dependency = resolve(dirname(path), match[2]);

    let url = pathToFileURL(dependency).href;

    if (dependency.endsWith('.svelte')) {
      url = pathToFileURL(await compileComponent(dependency)).href;
    }

    let replacement = `from ${JSON.stringify(url)}`;

    if (dependency.endsWith('.json')) {
      replacement += ' with { type: "json" }';
    }

    code = code.replace(match[0], replacement);
  }

  await writeFile(target, code);

  return target;
}

export async function renderListingFixture(component, props) {
  const path = await compileComponent(
    resolve(websiteRoot, 'src/lib', component),
  );

  const module = await import(pathToFileURL(path).href);

  return render(module.default, {
    props,
  }).body;
}
