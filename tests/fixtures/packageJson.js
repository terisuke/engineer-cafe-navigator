// Test data fixtures for package.json testing

const validPackageJson = {
  name: 'test-package',
  version: '1.0.0',
  description: 'A test package for unit testing',
  main: 'index.js',
  scripts: {
    test: 'jest',
    start: 'node index.js',
    build: 'npm run compile'
  },
  dependencies: {
    lodash: '^4.17.21',
    express: '^4.18.2'
  },
  devDependencies: {
    jest: '^29.5.0',
    typescript: '^5.0.0'
  },
  keywords: ['test', 'package', 'npm'],
  author: 'Test Author',
  license: 'MIT'
};

const invalidPackageJson = {
  name: '',
  version: 'invalid-version',
  dependencies: 'not-an-object'
};

module.exports = {
  validPackageJson,
  invalidPackageJson
};