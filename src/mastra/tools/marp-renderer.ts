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
    // Configure Marp with Engineer Cafe settings using proper Marp API
    try {
      // Enable HTML support if available
      if (this.marp.markdown && this.marp.markdown.set) {
        this.marp.markdown.set({ html: true });
      }
      
      console.log('Marp configured successfully');
    } catch (error) {
      console.warn('Marp configuration warning:', error);
      // Continue without error as basic functionality should still work
    }
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
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[MarpRenderer] Attempting to read file: ${path.basename(markdownPath)}`);
        console.log(`[MarpRenderer] Slide file parameter: ${slideFile}`);
      }
      
      const markdownContent = await fs.readFile(markdownPath, 'utf-8');

      // Parse frontmatter and content
      const { data: frontmatter, content } = matter(markdownContent);

      // Apply theme if specified
      if (theme) {
        await this.applyTheme(theme);
      }

      // Render markdown to HTML with options for better slide detection
      const { html, css } = this.marp.render(content, {
        html: true,
      });

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
    const themePath = path.join(process.cwd(), 'src', 'slides', 'themes', `${themeName}.css`);
    try {
      // Use process.cwd() to get the project root directory
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Attempting to load theme from: ${path.basename(themePath)}`);
      }
      const themeCSS = await fs.readFile(themePath, 'utf-8');
      
      // Apply custom theme
      this.marp.themeSet.add(themeCSS);
      console.log(`Successfully loaded theme: ${themeName}`);
    } catch (error) {
      console.warn(`Theme ${themeName} not found at ${themePath}, using default. Error:`, error);
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
    // Split content by slide separators (three dashes on their own line)
    const slideContents = content.split(/\n---\n/).filter(slide => slide.trim());

    console.log(`Parsing ${slideContents.length} slides from markdown`);

    const slides = slideContents.map((slideContent, index) => {
      const lines = slideContent.trim().split('\n');
      
      // Extract title (first heading)
      let title: string | undefined;
      for (const line of lines) {
        const titleMatch = line.match(/^#+\s+(.+)$/);
        if (titleMatch) {
          title = titleMatch[1];
          break;
        }
      }

      // Extract speaker notes (HTML comments)
      const notesMatch = slideContent.match(/<!--([\s\S]*?)-->/g);
      let notes: string | undefined;
      if (notesMatch) {
        // Combine all comments as notes, excluding directives
        notes = notesMatch
          .map(comment => comment.replace(/<!--\s*|\s*-->/g, '').trim())
          .filter(note => !note.startsWith('_') && note.length > 0)
          .join('\n\n');
        if (notes.length === 0) notes = undefined;
      }

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
              const counter = document.getElementById('slideCounter');
              if (counter) {
                counter.textContent = \`Slide \${slideNumber} of \${totalSlides}\`;
              }
            }
          };
          
          function nextSlide() {
            window.parent.postMessage({ type: 'slide-control', action: 'next' }, '*');
          }
          
          function previousSlide() {
            window.parent.postMessage({ type: 'slide-control', action: 'previous' }, '*');
          }
          
          // Log slide information on load
          window.addEventListener('load', function() {
            const marpit = document.querySelector('.marpit');
            if (marpit) {
              const slides = marpit.querySelectorAll('svg[id^="slide-"]');
              console.log('Marp slides found:', slides.length);
              // Update counter with actual count
              const counter = document.getElementById('slideCounter');
              if (counter && slides.length > 0) {
                counter.textContent = \`Slide 1 of \${slides.length}\`;
              }
            }
          });
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
