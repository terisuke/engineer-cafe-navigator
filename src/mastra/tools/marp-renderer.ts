import { Marp } from '@marp-team/marp-core';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export class MarpRendererTool {
  name = 'marp-renderer';
  description = 'Render Marp markdown slides to HTML';

  private marp: Marp;

  schema = z.object({
    slideFile: z.string().describe('Path to the markdown slide file'),
    theme: z.string().optional().describe('Theme name to apply'),
    outputFormat: z.enum(['html', 'json', 'both']).default('html'),
  });

  constructor() {
    this.marp = new Marp();
    this.configureMarp();
  }

  private configureMarp() {
    // Configure Marp with Engineer Cafe settings
    this.marp.use(require('@marp-team/marp-core/browser'));
  }

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    html?: string;
    slideData?: any;
    slideCount?: number;
    error?: string;
  }> {
    try {
      const { slideFile, theme, outputFormat } = params;

      // Read the markdown file
      const markdownPath = path.resolve(slideFile);
      const markdownContent = await fs.readFile(markdownPath, 'utf-8');

      // Parse frontmatter and content
      const { data: frontmatter, content } = matter(markdownContent);

      // Apply theme if specified
      if (theme) {
        await this.applyTheme(theme);
      }

      // Render markdown to HTML
      const { html, css } = this.marp.render(content);

      // Parse slide structure for JSON output
      const slideData = await this.parseSlideStructure(content, frontmatter);

      const result: any = {
        success: true,
        slideCount: slideData.slides.length,
      };

      if (outputFormat === 'html' || outputFormat === 'both') {
        result.html = this.wrapHtmlWithStyles(html, css);
      }

      if (outputFormat === 'json' || outputFormat === 'both') {
        result.slideData = slideData;
      }

      return result;
    } catch (error) {
      console.error('Marp rendering error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async applyTheme(themeName: string): Promise<void> {
    try {
      const themePath = path.resolve(`src/slides/themes/${themeName}.css`);
      const themeCSS = await fs.readFile(themePath, 'utf-8');
      
      // Apply custom theme
      this.marp.themeSet.add(themeCSS);
    } catch (error) {
      console.warn(`Theme ${themeName} not found, using default`);
    }
  }

  private async parseSlideStructure(content: string, frontmatter: any): Promise<{
    metadata: any;
    slides: Array<{
      slideNumber: number;
      title?: string;
      content: string;
      notes?: string;
    }>;
  }> {
    // Split content by slide separators
    const slideContents = content.split(/^---$/m).filter(slide => slide.trim());

    const slides = slideContents.map((slideContent, index) => {
      const lines = slideContent.trim().split('\n');
      const firstLine = lines[0];
      
      // Extract title (first heading)
      const titleMatch = firstLine.match(/^#\s+(.+)$/);
      const title = titleMatch ? titleMatch[1] : undefined;

      // Extract speaker notes (comments)
      const notesMatch = slideContent.match(/<!--\s*(.*?)\s*-->/s);
      const notes = notesMatch ? notesMatch[1].trim() : undefined;

      return {
        slideNumber: index + 1,
        title,
        content: slideContent.trim(),
        notes,
      };
    });

    return {
      metadata: frontmatter,
      slides,
    };
  }

  private wrapHtmlWithStyles(html: string, css: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Engineer Cafe Presentation</title>
        <style>
          ${css}
          
          /* Custom Engineer Cafe styles */
          .marp-container {
            height: 100vh;
            overflow: hidden;
          }
          
          .marp-slide {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          
          .marp-slide h1 {
            color: #ffffff;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          }
          
          .slide-navigation {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
          }
          
          .slide-counter {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 1000;
          }
        </style>
      </head>
      <body>
        <div class="marp-container">
          ${html}
        </div>
        <div class="slide-counter" id="slideCounter">
          Slide 1 of X
        </div>
        <div class="slide-navigation">
          <button onclick="previousSlide()">Previous</button>
          <button onclick="nextSlide()">Next</button>
        </div>
        <script>
          // Slide navigation logic will be handled by the main app
          window.slideNavigationCallbacks = {
            onSlideChange: function(slideNumber, totalSlides) {
              document.getElementById('slideCounter').textContent = 
                \`Slide \${slideNumber} of \${totalSlides}\`;
            }
          };
          
          function nextSlide() {
            window.parent.postMessage({ type: 'slide-control', action: 'next' }, '*');
          }
          
          function previousSlide() {
            window.parent.postMessage({ type: 'slide-control', action: 'previous' }, '*');
          }
        </script>
      </body>
      </html>
    `;
  }

  async renderSlidePreview(slideFile: string, slideNumber: number): Promise<{
    success: boolean;
    preview?: string;
    error?: string;
  }> {
    try {
      const result = await this.execute({ slideFile, outputFormat: 'json' });
      
      if (!result.success || !result.slideData) {
        return { success: false, error: 'Failed to load slide data' };
      }

      const slide = result.slideData.slides.find((s: any) => s.slideNumber === slideNumber);
      if (!slide) {
        return { success: false, error: `Slide ${slideNumber} not found` };
      }

      // Render just this slide
      const { html } = this.marp.render(slide.content);
      
      return {
        success: true,
        preview: html,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getSlideList(slideFile: string): Promise<{
    success: boolean;
    slides?: Array<{ slideNumber: number; title?: string; }>;
    error?: string;
  }> {
    try {
      const result = await this.execute({ slideFile, outputFormat: 'json' });
      
      if (!result.success || !result.slideData) {
        return { success: false, error: 'Failed to load slide data' };
      }

      const slides = result.slideData.slides.map((slide: any) => ({
        slideNumber: slide.slideNumber,
        title: slide.title,
      }));

      return {
        success: true,
        slides,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
