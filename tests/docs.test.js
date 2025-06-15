const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

// Mock external dependencies
jest.mock('fs');
jest.mock('path');

// Import the docs module - adjust path based on actual location
const docs = require('../src/docs');

// Test constants
const MOCK_DOC_CONTENT = '# Test Documentation\n\nThis is test content.\n\n## Section 1\n\nSection content here.';
const MOCK_DOC_DATA = {
  title: 'Test Documentation',
  content: 'This is test content.',
  sections: [
    { title: 'Section 1', content: 'Section content here.' }
  ]
};

describe('Docs Module', () => {
  let mockFs, mockPath;
  
  beforeEach(() => {
    // Setup fresh mocks before each test
    mockFs = require('fs');
    mockPath = require('path');
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockFs.readFileSync = jest.fn();
    mockFs.writeFileSync = jest.fn();
    mockFs.existsSync = jest.fn();
    mockPath.join = jest.fn((...args) => args.join('/'));
    mockPath.resolve = jest.fn((p) => `/resolved/${p}`);
  });
  
  afterEach(() => {
    // Clean up after each test
    jest.restoreAllMocks();
  });

  describe('Core Documentation Functions', () => {
    describe('parseMarkdown', () => {
      it('should parse simple markdown content correctly', () => {
        const markdown = '# Title\n\nContent paragraph.\n\n## Subtitle\n\nMore content.';
        const result = docs.parseMarkdown(markdown);
        
        expect(result).toBeDefined();
        expect(result.title).toBe('Title');
        expect(result.sections).toHaveLength(1);
        expect(result.sections[0].title).toBe('Subtitle');
        expect(result.sections[0].content).toContain('More content');
      });
      
      it('should handle markdown with code blocks', () => {
        const markdownWithCode = '# API Reference\n\n```javascript\nconst api = require("api");\n```\n\nDescription here.';
        const result = docs.parseMarkdown(markdownWithCode);
        
        expect(result.title).toBe('API Reference');
        expect(result.content).toContain('```javascript');
        expect(result.content).toContain('const api = require("api");');
      });
      
      it('should parse markdown with multiple headers and nested content', () => {
        const complexMarkdown = `# Main Title
        
Main description.

## Section A
Content for section A.

### Subsection A.1
Nested content.

## Section B
Content for section B.`;
        
        const result = docs.parseMarkdown(complexMarkdown);
        
        expect(result.title).toBe('Main Title');
        expect(result.sections).toHaveLength(2);
        expect(result.sections[0].title).toBe('Section A');
        expect(result.sections[1].title).toBe('Section B');
      });
    });
    
    describe('generateDocumentation', () => {
      it('should generate documentation from valid input data', () => {
        const inputData = {
          title: 'API Documentation',
          description: 'Complete API reference',
          version: '1.0.0',
          sections: [
            { name: 'Authentication', content: 'Auth details' },
            { name: 'Endpoints', content: 'API endpoints' }
          ]
        };
        
        const result = docs.generateDocumentation(inputData);
        
        expect(result).toBeDefined();
        expect(result.title).toBe('API Documentation');
        expect(result.version).toBe('1.0.0');
        expect(result.sections).toHaveLength(2);
        expect(result.generatedAt).toBeDefined();
      });
      
      it('should apply default template when none provided', () => {
        const inputData = { title: 'Simple Doc', content: 'Simple content' };
        const result = docs.generateDocumentation(inputData);
        
        expect(result.template).toBe('default');
        expect(result.formatted).toContain('Simple Doc');
        expect(result.formatted).toContain('Simple content');
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    describe('Empty and Null Input Handling', () => {
      it('should handle empty string input gracefully', () => {
        const result = docs.parseMarkdown('');
        
        expect(result).toBeDefined();
        expect(result.title).toBe('');
        expect(result.content).toBe('');
        expect(result.sections).toEqual([]);
      });
      
      it('should handle null input without throwing', () => {
        expect(() => docs.parseMarkdown(null)).not.toThrow();
        expect(docs.parseMarkdown(null)).toEqual({
          title: '',
          content: '',
          sections: [],
          error: 'Invalid input: null or undefined'
        });
      });
      
      it('should handle undefined input gracefully', () => {
        expect(() => docs.parseMarkdown(undefined)).not.toThrow();
        const result = docs.parseMarkdown(undefined);
        expect(result.error).toContain('Invalid input');
      });
    });
    
    describe('Large Content Handling', () => {
      it('should handle very large markdown documents', () => {
        const largeContent = '# Large Doc\n\n' + 'Content line.\n'.repeat(10000);
        const result = docs.parseMarkdown(largeContent);
        
        expect(result.title).toBe('Large Doc');
        expect(result.content.split('\n')).toHaveLength(10001); // +1 for title line
      });
      
      it('should handle documents with many sections', () => {
        let manyHeadersContent = '# Main Title\n\n';
        for (let i = 1; i <= 100; i++) {
          manyHeadersContent += `## Section ${i}\nContent for section ${i}.\n\n`;
        }
        
        const result = docs.parseMarkdown(manyHeadersContent);
        
        expect(result.title).toBe('Main Title');
        expect(result.sections).toHaveLength(100);
        expect(result.sections[99].title).toBe('Section 100');
      });
    });
    
    describe('Special Character Handling', () => {
      it('should handle special characters in titles and content', () => {
        const specialChars = '# Title with Special chars: !@#$%^&*()[]{}|;:,.<>?\n\nContent with émojis 🚀 and ünïcödé.';
        const result = docs.parseMarkdown(specialChars);
        
        expect(result.title).toContain('!@#$%^&*()[]{}|;:,.<>?');
        expect(result.content).toContain('🚀');
        expect(result.content).toContain('ünïcödé');
      });
      
      it('should handle malformed markdown gracefully', () => {
        const malformedMarkdown = '# Incomplete\n\n[broken link](\n\n**bold without close\n\n```\ncode without close';
        
        expect(() => docs.parseMarkdown(malformedMarkdown)).not.toThrow();
        const result = docs.parseMarkdown(malformedMarkdown);
        expect(result.title).toBe('Incomplete');
      });
    });
  });

  describe('Error Handling and Failure Conditions', () => {
    describe('File System Operations', () => {
      it('should handle file not found errors gracefully', () => {
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });
        
        expect(() => {
          docs.loadDocumentationFromFile('nonexistent.md');
        }).toThrow('File not found');
      });
      
      it('should handle permission denied errors', () => {
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        });
        
        expect(() => {
          docs.loadDocumentationFromFile('restricted.md');
        }).toThrow('Permission denied');
      });
      
      it('should handle write operation failures', () => {
        mockFs.writeFileSync.mockImplementation(() => {
          throw new Error('ENOSPC: no space left on device');
        });
        
        const docData = { title: 'Test', content: 'Content' };
        
        expect(() => {
          docs.saveDocumentationToFile(docData, 'output.md');
        }).toThrow('Failed to save documentation');
      });
    });
    
    describe('Input Validation', () => {
      it('should validate required fields in documentation data', () => {
        const invalidData = { content: 'Content without title' };
        
        expect(() => {
          docs.validateDocumentationData(invalidData);
        }).toThrow('Title is required');
      });
      
      it('should validate content format', () => {
        const invalidFormat = { title: 'Valid Title', content: 123 };
        
        expect(() => {
          docs.validateDocumentationData(invalidFormat);
        }).toThrow('Content must be a string');
      });
      
      it('should handle circular references in nested data', () => {
        const circularData = { title: 'Test' };
        circularData.parent = circularData;
        
        expect(() => {
          docs.processNestedDocumentation(circularData);
        }).not.toThrow();
        
        const result = docs.processNestedDocumentation(circularData);
        expect(result.error).toContain('Circular reference detected');
      });
    });
    
    describe('Template Processing Errors', () => {
      it('should handle invalid template syntax', () => {
        const invalidTemplate = '{{unclosed template';
        const data = { title: 'Test', content: 'Content' };
        
        expect(() => {
          docs.renderWithTemplate(data, invalidTemplate);
        }).toThrow('Invalid template syntax');
      });
      
      it('should handle missing template variables', () => {
        const template = '{{title}} - {{missingVariable}}';
        const data = { title: 'Test Title' };
        
        const result = docs.renderWithTemplate(data, template);
        
        expect(result).toContain('Test Title');
        expect(result).toContain('{{missingVariable}}'); // Should leave placeholder
      });
    });
  });

  describe('External Dependencies and Async Operations', () => {
    describe('File System Integration', () => {
      it('should read documentation files with correct encoding', () => {
        const mockContent = '# Test Doc\n\nTest content with UTF-8: café';
        mockFs.readFileSync.mockReturnValue(mockContent);
        mockFs.existsSync.mockReturnValue(true);
        
        const result = docs.loadDocumentationFromFile('test.md');
        
        expect(mockFs.readFileSync).toHaveBeenCalledWith('test.md', 'utf8');
        expect(result.title).toBe('Test Doc');
        expect(result.content).toContain('café');
      });
      
      it('should save documentation with proper formatting', () => {
        const docData = {
          title: 'Generated Doc',
          content: 'Generated content',
          metadata: { author: 'Test Author', date: '2024-01-01' }
        };
        
        docs.saveDocumentationToFile(docData, 'output.md');
        
        expect(mockFs.writeFileSync).toHaveBeenCalled();
        const [filePath, content, options] = mockFs.writeFileSync.mock.calls[0];
        expect(filePath).toBe('output.md');
        expect(content).toContain('# Generated Doc');
        expect(content).toContain('Generated content');
        expect(options).toBe('utf8');
      });
    });
    
    describe('Remote Documentation Fetching', () => {
      beforeEach(() => {
        global.fetch = jest.fn();
      });
      
      it('should fetch remote documentation successfully', async () => {
        const mockResponse = {
          ok: true,
          text: () => Promise.resolve('# Remote Doc\n\nRemote content')
        };
        global.fetch.mockResolvedValue(mockResponse);
        
        const result = await docs.fetchRemoteDocumentation('https://example.com/docs.md');
        
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/docs.md');
        expect(result.title).toBe('Remote Doc');
        expect(result.content).toContain('Remote content');
      });
      
      it('should handle network errors gracefully', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));
        
        await expect(
          docs.fetchRemoteDocumentation('https://example.com/docs.md')
        ).rejects.toThrow('Failed to fetch remote documentation');
      });
      
      it('should handle HTTP error responses', async () => {
        const mockResponse = { ok: false, status: 404, statusText: 'Not Found' };
        global.fetch.mockResolvedValue(mockResponse);
        
        await expect(
          docs.fetchRemoteDocumentation('https://example.com/missing.md')
        ).rejects.toThrow('HTTP 404: Not Found');
      });
    });
  });

  describe('Performance and Integration Tests', () => {
    describe('Performance Benchmarks', () => {
      it('should process large documentation sets efficiently', () => {
        const largeDocs = Array.from({ length: 1000 }, (_, i) => ({
          title: `Document ${i}`,
          content: `Content for document ${i}`.repeat(100),
          sections: [
            { title: `Section ${i}.1`, content: `Section content ${i}` }
          ]
        }));
        
        const startTime = process.hrtime.bigint();
        const results = docs.processBatchDocumentation(largeDocs);
        const endTime = process.hrtime.bigint();
        
        const executionTime = Number(endTime - startTime) / 1e6; // Convert to milliseconds
        
        expect(results).toHaveLength(1000);
        expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
        expect(results.every(doc => doc.processed === true)).toBe(true);
      });
      
      it('should handle concurrent documentation processing', async () => {
        const docs1 = { title: 'Doc 1', content: 'Content 1' };
        const docs2 = { title: 'Doc 2', content: 'Content 2' };
        const docs3 = { title: 'Doc 3', content: 'Content 3' };
        
        const promises = [
          docs.processDocumentationAsync(docs1),
          docs.processDocumentationAsync(docs2),
          docs.processDocumentationAsync(docs3)
        ];
        
        const results = await Promise.all(promises);
        
        expect(results).toHaveLength(3);
        expect(results[0].title).toBe('Doc 1');
        expect(results[1].title).toBe('Doc 2');
        expect(results[2].title).toBe('Doc 3');
      });
    });
    
    describe('Integration with Templates and Themes', () => {
      it('should integrate with custom template systems', () => {
        const customTemplate = {
          header: '<header>{{title}}</header>',
          body: '<main>{{content}}</main>',
          footer: '<footer>Generated: {{date}}</footer>'
        };
        
        const docData = {
          title: 'Integration Test',
          content: 'Test content for integration',
          date: '2024-01-01'
        };
        
        const result = docs.renderWithCustomTemplate(docData, customTemplate);
        
        expect(result).toContain('<header>Integration Test</header>');
        expect(result).toContain('<main>Test content for integration</main>');
        expect(result).toContain('<footer>Generated: 2024-01-01</footer>');
      });
      
      it('should apply consistent formatting across different input types', () => {
        const inputs = [
          { type: 'markdown', data: '# MD Title\n\nMD Content' },
          { type: 'json', data: { title: 'JSON Title', content: 'JSON Content' } },
          { type: 'yaml', data: 'title: YAML Title\ncontent: YAML Content' }
        ];
        
        const results = inputs.map(input => docs.normalizeDocumentation(input));
        
        results.forEach(result => {
          expect(result).toHaveProperty('title');
          expect(result).toHaveProperty('content');
          expect(result).toHaveProperty('metadata');
          expect(result).toHaveProperty('normalized', true);
          expect(typeof result.title).toBe('string');
          expect(typeof result.content).toBe('string');
        });
      });
    });
    
    describe('Utility Functions', () => {
      it('should generate table of contents correctly', () => {
        const docContent = `# Main Title
        
## Section 1
Content 1

### Subsection 1.1
Content 1.1

## Section 2
Content 2

### Subsection 2.1
Content 2.1

### Subsection 2.2
Content 2.2`;
        
        const toc = docs.generateTableOfContents(docContent);
        
        expect(toc).toHaveLength(5); // 2 sections + 3 subsections
        expect(toc[0]).toEqual({ level: 2, title: 'Section 1', anchor: 'section-1' });
        expect(toc[1]).toEqual({ level: 3, title: 'Subsection 1.1', anchor: 'subsection-1-1' });
        expect(toc[4]).toEqual({ level: 3, title: 'Subsection 2.2', anchor: 'subsection-2-2' });
      });
      
      it('should extract metadata from documentation', () => {
        const docWithMetadata = `---
author: John Doe
date: 2024-01-01
tags: [documentation, testing]
version: 1.0.0
---

# Documentation Title

Content here.`;
        
        const metadata = docs.extractMetadata(docWithMetadata);
        
        expect(metadata.author).toBe('John Doe');
        expect(metadata.date).toBe('2024-01-01');
        expect(metadata.tags).toEqual(['documentation', 'testing']);
        expect(metadata.version).toBe('1.0.0');
      });
      
      it('should validate documentation structure', () => {
        const validDoc = {
          title: 'Valid Document',
          content: 'Valid content',
          sections: [
            { title: 'Section 1', content: 'Section content' }
          ],
          metadata: { author: 'Test Author' }
        };
        
        const validationResult = docs.validateDocumentStructure(validDoc);
        
        expect(validationResult.isValid).toBe(true);
        expect(validationResult.errors).toEqual([]);
      });
      
      it('should detect invalid documentation structure', () => {
        const invalidDoc = {
          title: '', // Empty title
          content: null, // Invalid content type
          sections: 'not an array', // Invalid sections type
          metadata: { /* missing required fields */ }
        };
        
        const validationResult = docs.validateDocumentStructure(invalidDoc);
        
        expect(validationResult.isValid).toBe(false);
        expect(validationResult.errors).toContain('Title cannot be empty');
        expect(validationResult.errors).toContain('Content must be a string');
        expect(validationResult.errors).toContain('Sections must be an array');
      });
    });
  });
});