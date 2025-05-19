import { Marp } from '@marp-team/marp-core';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export interface MarpSlide {
  slideNumber: number;
  title?: string;
  content: string;
  notes?: string;
  backgroundImage?: string;
  directives?: Record<string, any>;
}

export interface MarpMetadata {
  title?: string;
  description?: string;
  author?: string;
  keywords?: string[];
  theme?: string;
  paginate?: boolean;
  backgroundColor?: string;
  backgroundImage?: string;
  footer?: string;
  header?: string;
  size?: string;
  [key: string]: any;
}

export interface ProcessedMarp {
  html: string;
  css: string;
  slides: MarpSlide[];
  metadata: MarpMetadata;
  themeCSS?: string;
}

export class MarpProcessor {
  private marp: Marp;
  private themes: Map<string, string> = new Map();

  constructor() {
    this.marp = new Marp({
      html: true,
      emoji: {
        shortcode: true,
        unicode: true,
      },
      math: 'mathjax',
    });

    // Load built-in themes
    this.loadBuiltinThemes();
  }

  private loadBuiltinThemes(): void {
    // Load Marp core themes
    const coreThemes = ['default', 'gaia', 'uncover'];
    coreThemes.forEach(themeName => {
      try {
        // Note: In a real implementation, you'd load the actual theme CSS
        this.themes.set(themeName, `/* ${themeName} theme */`);
      } catch (error) {
        console.warn(`Failed to load theme: ${themeName}`);
      }
    });
  }

  async loadCustomTheme(themeName: string, themePath: string): Promise<void> {
    try {
      const themeCSS = await fs.readFile(themePath, 'utf-8');
      this.themes.set(themeName, themeCSS);
      
      // Register the theme with Marp
      this.marp.themeSet.add(themeCSS);
    } catch (error) {
      throw new Error(`Failed to load custom theme ${themeName}: ${error}`);
    }
  }

  async processMarkdownFile(filePath: string): Promise<ProcessedMarp> {
    try {
      const markdownContent = await fs.readFile(filePath, 'utf-8');
      return this.processMarkdown(markdownContent);
    } catch (error) {
      throw new Error(`Failed to process markdown file: ${error}`);
    }
  }

  processMarkdown(markdown: string): ProcessedMarp {
    try {
      // Parse frontmatter
      const { data: frontmatter, content } = matter(markdown);

      // Apply theme if specified
      const theme = frontmatter.theme;
      if (theme && this.themes.has(theme)) {
        const themeCSS = this.themes.get(theme)!;
        this.marp.themeSet.add(themeCSS);
      }

      // Configure Marp options based on frontmatter
      this.configureFromFrontmatter(frontmatter);

      // Render the markdown
      const { html, css } = this.marp.render(content);

      // Parse slides
      const slides = this.parseSlides(content);

      // Extract metadata
      const metadata = this.extractMetadata(frontmatter);

      return {
        html,
        css,
        slides,
        metadata,
        themeCSS: theme ? this.themes.get(theme) : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to process markdown: ${error}`);
    }
  }

  private configureFromFrontmatter(frontmatter: any): void {
    // Configure Marp instance based on frontmatter
    if (frontmatter.size) {
      // Note: Size configuration would be handled here
    }

    if (frontmatter.theme) {
      // Theme is handled in processMarkdown
    }

    // Add other configuration as needed
  }

  private parseSlides(content: string): MarpSlide[] {
    const slides: MarpSlide[] = [];
    
    // Split by slide separators (---)
    const slideContents = content.split(/^---$/m).filter(slide => slide.trim());

    slideContents.forEach((slideContent, index) => {
      const slideNumber = index + 1;
      const trimmedContent = slideContent.trim();

      // Extract title (first heading)
      const titleMatch = trimmedContent.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : undefined;

      // Extract speaker notes (HTML comments)
      const notesMatch = trimmedContent.match(/<!--\s*(.*?)\s*-->/s);
      const notes = notesMatch ? notesMatch[1].trim() : undefined;

      // Extract background image
      const bgMatch = trimmedContent.match(/!\[bg.*?\]\((.+?)\)/);
      const backgroundImage = bgMatch ? bgMatch[1] : undefined;

      // Extract slide directives
      const directives = this.extractSlideDirectives(trimmedContent);

      slides.push({
        slideNumber,
        title,
        content: trimmedContent,
        notes,
        backgroundImage,
        directives,
      });
    });

    return slides;
  }

  private extractSlideDirectives(content: string): Record<string, any> {
    const directives: Record<string, any> = {};

    // Extract class directive
    const classMatch = content.match(/<!--\s*_class:\s*(.+?)\s*-->/);
    if (classMatch) {
      directives.class = classMatch[1].trim();
    }

    // Extract background directive
    const bgColorMatch = content.match(/<!--\s*_backgroundColor:\s*(.+?)\s*-->/);
    if (bgColorMatch) {
      directives.backgroundColor = bgColorMatch[1].trim();
    }

    // Extract other custom directives
    const customDirectiveMatches = content.matchAll(/<!--\s*_(\w+):\s*(.+?)\s*-->/g);
    for (const match of customDirectiveMatches) {
      const [, key, value] = match;
      if (key !== 'class' && key !== 'backgroundColor') {
        directives[key] = value.trim();
      }
    }

    return directives;
  }

  private extractMetadata(frontmatter: any): MarpMetadata {
    return {
      title: frontmatter.title,
      description: frontmatter.description,
      author: frontmatter.author,
      keywords: frontmatter.keywords,
      theme: frontmatter.theme,
      paginate: frontmatter.paginate,
      backgroundColor: frontmatter.backgroundColor,
      backgroundImage: frontmatter.backgroundImage,
      footer: frontmatter.footer,
      header: frontmatter.header,
      size: frontmatter.size,
      ...frontmatter,
    };
  }

  async renderToHTML(
    markdown: string,
    options: {
      includeCSS?: boolean;
      wrapInDocument?: boolean;
      title?: string;
      customCSS?: string;
    } = {}
  ): Promise<string> {
    const {
      includeCSS = true,
      wrapInDocument = true,
      title = 'Marp Presentation',
      customCSS = '',
    } = options;

    const result = this.processMarkdown(markdown);

    if (!wrapInDocument) {
      return result.html;
    }

    const css = includeCSS ? result.css + '\n' + customCSS : customCSS;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        ${css ? `<style>${css}</style>` : ''}
      </head>
      <body>
        ${result.html}
      </body>
      </html>
    `;
  }

  async renderSlidePreview(
    markdown: string,
    slideNumber: number,
    options: {
      width?: number;
      height?: number;
      includeCSS?: boolean;
    } = {}
  ): Promise<string> {
    const { width = 1280, height = 720, includeCSS = true } = options;

    const result = this.processMarkdown(markdown);
    const slide = result.slides.find(s => s.slideNumber === slideNumber);

    if (!slide) {
      throw new Error(`Slide ${slideNumber} not found`);
    }

    // Render just this slide
    const { html, css } = this.marp.render(slide.content);

    const previewCSS = `
      ${includeCSS ? css : ''}
      .marp-slide {
        width: ${width}px;
        height: ${height}px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      }
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Slide ${slideNumber} Preview</title>
        <style>${previewCSS}</style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
  }

  async exportToPDF(
    markdown: string,
    outputPath: string,
    options: {
      format?: 'A4' | '16:9' | '4:3';
      theme?: string;
    } = {}
  ): Promise<void> {
    // Note: This would require a PDF generation library like Puppeteer
    // For now, this is a placeholder implementation
    throw new Error('PDF export not implemented yet');
  }

  async createSlideNavigation(result: ProcessedMarp): Promise<string> {
    const navigationItems = result.slides.map(slide => {
      const title = slide.title || `Slide ${slide.slideNumber}`;
      return `
        <button 
          class="nav-item" 
          data-slide="${slide.slideNumber}"
          onclick="goToSlide(${slide.slideNumber})"
        >
          <span class="nav-number">${slide.slideNumber}</span>
          <span class="nav-title">${title}</span>
        </button>
      `;
    }).join('');

    return `
      <div class="slide-navigation">
        <div class="nav-header">
          <h3>Navigation</h3>
          <button class="nav-close" onclick="closeNavigation()">×</button>
        </div>
        <div class="nav-items">
          ${navigationItems}
        </div>
      </div>
      <style>
        .slide-navigation {
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          max-width: 300px;
          max-height: 80vh;
          overflow-y: auto;
          z-index: 1000;
        }
        .nav-header {
          padding: 16px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .nav-items {
          padding: 8px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 8px;
          margin: 4px 0;
          background: transparent;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .nav-item:hover {
          background-color: #f5f5f5;
        }
        .nav-item.active {
          background-color: #e3f2fd;
          border-color: #2196f3;
        }
        .nav-number {
          font-weight: bold;
          margin-right: 8px;
          color: #666;
        }
        .nav-title {
          flex: 1;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      </style>
    `;
  }

  getAvailableThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  async loadThemeDirectory(themesPath: string): Promise<void> {
    try {
      const files = await fs.readdir(themesPath);
      
      for (const file of files) {
        if (file.endsWith('.css') || file.endsWith('.scss')) {
          const themeName = path.basename(file, path.extname(file));
          const themePath = path.join(themesPath, file);
          
          try {
            await this.loadCustomTheme(themeName, themePath);
          } catch (error) {
            console.warn(`Failed to load theme ${themeName}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to load theme directory ${themesPath}:`, error);
    }
  }

  validateMarkdown(markdown: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check for basic structure
      if (!markdown.trim()) {
        errors.push('Markdown content is empty');
      }

      // Check for frontmatter
      const { data: frontmatter } = matter(markdown);

      // Validate required fields
      if (!frontmatter.marp) {
        errors.push('Missing "marp: true" in frontmatter');
      }

      // Check for slides
      const slideCount = (markdown.match(/^---$/gm) || []).length + 1;
      if (slideCount < 1) {
        errors.push('No slides found');
      }

      // Try to render (basic validation)
      this.marp.render(markdown);

    } catch (error) {
      errors.push(`Render error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  calculateStatistics(result: ProcessedMarp): {
    slideCount: number;
    averageWordsPerSlide: number;
    totalWords: number;
    slidesWithImages: number;
    slidesWithNotes: number;
    estimatedDuration: number; // in minutes
  } {
    const slideCount = result.slides.length;
    let totalWords = 0;
    let slidesWithImages = 0;
    let slidesWithNotes = 0;

    result.slides.forEach(slide => {
      // Count words (simple word count)
      const words = slide.content.replace(/[#*\-`]/g, '').split(/\s+/).filter(word => word.length > 0);
      totalWords += words.length;

      // Check for images
      if (slide.content.includes('![') || slide.backgroundImage) {
        slidesWithImages++;
      }

      // Check for notes
      if (slide.notes) {
        slidesWithNotes++;
      }
    });

    const averageWordsPerSlide = slideCount > 0 ? Math.round(totalWords / slideCount) : 0;
    
    // Estimate duration: ~2 minutes per slide + 30 seconds per 100 words
    const estimatedDuration = slideCount * 2 + Math.floor(totalWords / 100) * 0.5;

    return {
      slideCount,
      averageWordsPerSlide,
      totalWords,
      slidesWithImages,
      slidesWithNotes,
      estimatedDuration,
    };
  }
}

// Utility functions
export class MarpUtils {
  static extractSlideContent(markdown: string, slideNumber: number): string | null {
    const slides = markdown.split(/^---$/m).filter(slide => slide.trim());
    return slides[slideNumber - 1] || null;
  }

  static replaceSlideContent(
    markdown: string,
    slideNumber: number,
    newContent: string
  ): string {
    const slides = markdown.split(/^---$/m);
    if (slideNumber <= slides.length && slideNumber > 0) {
      slides[slideNumber - 1] = newContent;
    }
    return slides.join('---');
  }

  static insertSlide(
    markdown: string,
    slideNumber: number,
    slideContent: string
  ): string {
    const slides = markdown.split(/^---$/m).filter(slide => slide.trim());
    slides.splice(slideNumber - 1, 0, slideContent);
    return slides.join('\n---\n');
  }

  static deleteSlide(markdown: string, slideNumber: number): string {
    const slides = markdown.split(/^---$/m).filter(slide => slide.trim());
    if (slideNumber <= slides.length && slideNumber > 0) {
      slides.splice(slideNumber - 1, 1);
    }
    return slides.join('\n---\n');
  }

  static moveSlide(
    markdown: string,
    fromSlide: number,
    toSlide: number
  ): string {
    const slides = markdown.split(/^---$/m).filter(slide => slide.trim());
    
    if (fromSlide <= slides.length && fromSlide > 0 && 
        toSlide <= slides.length && toSlide > 0) {
      const slideContent = slides.splice(fromSlide - 1, 1)[0];
      slides.splice(toSlide - 1, 0, slideContent);
    }
    
    return slides.join('\n---\n');
  }

  static addSlideNotes(slideContent: string, notes: string): string {
    // Remove existing notes
    const withoutNotes = slideContent.replace(/<!--\s*.*?\s*-->/s, '');
    
    // Add new notes
    return `${withoutNotes.trim()}\n\n<!-- ${notes} -->`;
  }

  static extractImageUrls(markdown: string): string[] {
    const imageRegex = /!\[.*?\]\((.+?)\)/g;
    const urls: string[] = [];
    let match;
    
    while ((match = imageRegex.exec(markdown)) !== null) {
      urls.push(match[1]);
    }
    
    return urls;
  }

  static replaceImageUrls(
    markdown: string,
    urlMapping: Record<string, string>
  ): string {
    let result = markdown;
    
    Object.entries(urlMapping).forEach(([oldUrl, newUrl]) => {
      const regex = new RegExp(`(!\[.*?\]\\\()${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\\))`, 'g');
      result = result.replace(regex, `$1${newUrl}$2`);
    });
    
    return result;
  }

  static optimizeForMobile(css: string): string {
    return `
      ${css}
      
      @media (max-width: 768px) {
        .marp-slide {
          font-size: 0.8em;
          padding: 1em;
        }
        
        .marp-slide h1 {
          font-size: 1.5em;
        }
        
        .marp-slide h2 {
          font-size: 1.3em;
        }
        
        .marp-slide img {
          max-width: 100%;
          height: auto;
        }
      }
    `;
  }
}
