const { createRequire } = require('node:module');
const { resolve } = require('node:path');

const repositoryRoot = resolve(__dirname, '../..');

const websiteRoot = resolve(repositoryRoot, 'website');

const requireWebsite = createRequire(resolve(websiteRoot, 'package.json'));

module.exports = { repositoryRoot, websiteRoot, requireWebsite };
