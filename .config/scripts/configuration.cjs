const fs = require('node:fs');
const { resolve } = require('node:path');
const { requireWebsite, websiteRoot } = require('./paths.cjs');

const { parse } = requireWebsite('yaml');

const configuration = require('../../website/src/lib/configuration.ts');

const readConfiguration = (
  path = resolve(websiteRoot, 'src/data/links.yaml'),
) => {
  return parse(fs.readFileSync(path, 'utf8'));
};

module.exports = { ...configuration, readConfiguration };
