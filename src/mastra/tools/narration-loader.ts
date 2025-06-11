import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { NarrationConfig, SupportedLanguage } from '../types/config';

export class NarrationLoaderTool {
  name = 'narration-loader';
  description = 'Load and manage slide narration content';

  schema = z.object({
    slideFile: z.string().describe('Slide file name (without extension)'),
    language: z.enum(['ja', 'en']).describe('Language for narration'),
    action: z.enum(['load', 'save', 'validate']).default('load'),
    narrationData: z.any().optional().describe('Narration data for save action'),
  });

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    narrationData?: NarrationConfig;
    validationErrors?: string[];
    error?: string;
  }> {
    try {
      const { slideFile, language, action, narrationData } = params;

      switch (action) {
        case 'load':
          return await this.loadNarration(slideFile, language);
        case 'save':
          if (!narrationData) {
            return { success: false, error: 'Narration data required for save action' };
          }
          return await this.saveNarration(slideFile, language, narrationData);
        case 'validate':
          if (!narrationData) {
            return { success: false, error: 'Narration data required for validation' };
          }
          return await this.validateNarration(narrationData);
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      console.error('Narration loader error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async loadNarration(slideFile: string, language: SupportedLanguage): Promise<{
    success: boolean;
    narrationData?: NarrationConfig;
    error?: string;
  }> {
    try {
      // Extract base filename from slideFile (remove language prefix if present)
      // e.g., "en/engineer-cafe" -> "engineer-cafe"
      const baseFileName = slideFile.includes('/') ? slideFile.split('/').pop() : slideFile;
      
      const narrationPath = path.resolve(`src/slides/narration/${baseFileName}-${language}.json`);
      
      const narrationContent = await fs.readFile(narrationPath, 'utf-8');
      const narrationData = JSON.parse(narrationContent) as NarrationConfig;

      // Validate the loaded data
      const validation = await this.validateNarration(narrationData);
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid narration data: ${validation.validationErrors?.join(', ')}`,
        };
      }

      return {
        success: true,
        narrationData,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        // Derive base file name here to avoid reference errors
        const fileName = slideFile.includes('/') ? slideFile.split('/').pop() : slideFile;
        return {
          success: false,
          error: `Narration file not found: ${fileName}-${language}.json`,
        };
      }
      throw error;
    }
  }

  private async saveNarration(
    slideFile: string, 
    language: SupportedLanguage, 
    narrationData: NarrationConfig
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Validate data before saving
      const validation = await this.validateNarration(narrationData);
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid narration data: ${validation.validationErrors?.join(', ')}`,
        };
      }

      // Extract base filename from slideFile (remove language prefix if present)
      const baseFileName = slideFile.includes('/') ? slideFile.split('/').pop() : slideFile;

      // Ensure directory exists
      const narrationDir = path.resolve('src/slides/narration');
      await fs.mkdir(narrationDir, { recursive: true });

      // Save the narration file
      const narrationPath = path.resolve(narrationDir, `${baseFileName}-${language}.json`);
      const formattedData = JSON.stringify(narrationData, null, 2);
      await fs.writeFile(narrationPath, formattedData, 'utf-8');

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  private async validateNarration(narrationData: any): Promise<{
    success: boolean;
    validationErrors?: string[];
  }> {
    const errors: string[] = [];

    // Check required metadata fields
    if (!narrationData.metadata) {
      errors.push('Missing metadata');
    } else {
      if (!narrationData.metadata.title) errors.push('Missing metadata.title');
      if (!narrationData.metadata.language) errors.push('Missing metadata.language');
      if (!narrationData.metadata.speaker) errors.push('Missing metadata.speaker');
      if (!narrationData.metadata.version) errors.push('Missing metadata.version');
    }

    // Check slides array
    if (!Array.isArray(narrationData.slides)) {
      errors.push('slides must be an array');
    } else {
      narrationData.slides.forEach((slide: any, index: number) => {
        const slidePrefix = `slides[${index}]`;
        
        if (typeof slide.slideNumber !== 'number') {
          errors.push(`${slidePrefix}.slideNumber must be a number`);
        }
        
        if (!slide.narration) {
          errors.push(`${slidePrefix}.narration is required`);
        } else {
          if (!slide.narration.auto) {
            errors.push(`${slidePrefix}.narration.auto is required`);
          }
          if (!slide.narration.onEnter) {
            errors.push(`${slidePrefix}.narration.onEnter is required`);
          }
          if (!slide.narration.onDemand || typeof slide.narration.onDemand !== 'object') {
            errors.push(`${slidePrefix}.narration.onDemand must be an object`);
          }
        }
        
        if (!slide.transitions) {
          errors.push(`${slidePrefix}.transitions is required`);
        }
      });

      // Check for duplicate slide numbers
      const slideNumbers = narrationData.slides.map((slide: any) => slide.slideNumber);
      const duplicates = slideNumbers.filter((num: number, index: number) => 
        slideNumbers.indexOf(num) !== index
      );
      if (duplicates.length > 0) {
        errors.push(`Duplicate slide numbers: ${duplicates.join(', ')}`);
      }

      // Check for sequential slide numbers
      const sortedNumbers = [...slideNumbers].sort((a, b) => a - b);
      for (let i = 0; i < sortedNumbers.length; i++) {
        if (sortedNumbers[i] !== i + 1) {
          errors.push(`Non-sequential slide numbers. Expected ${i + 1}, found ${sortedNumbers[i]}`);
          break;
        }
      }
    }

    return {
      success: errors.length === 0,
      validationErrors: errors.length > 0 ? errors : undefined,
    };
  }

  async getNarrationForSlide(
    slideFile: string, 
    language: SupportedLanguage, 
    slideNumber: number
  ): Promise<{
    success: boolean;
    slideNarration?: any;
    error?: string;
  }> {
    try {
      // Extract base filename from slideFile (remove language prefix if present)
      const baseFileName = slideFile.includes('/') ? slideFile.split('/').pop() : slideFile;
      const result = await this.loadNarration(baseFileName!, language);
      
      if (!result.success || !result.narrationData) {
        return { success: false, error: result.error };
      }

      const slideNarration = result.narrationData.slides.find(
        slide => slide.slideNumber === slideNumber
      );

      if (!slideNarration) {
        return {
          success: false,
          error: `No narration found for slide ${slideNumber}`,
        };
      }

      return {
        success: true,
        slideNarration,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listAvailableNarrations(): Promise<{
    success: boolean;
    narrations?: Array<{
      slideFile: string;
      language: SupportedLanguage;
      metadata?: any;
    }>;
    error?: string;
  }> {
    try {
      const narrationDir = path.resolve('src/slides/narration');
      const files = await fs.readdir(narrationDir);
      
      const narrations = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const match = file.match(/^(.+)-(ja|en)\.json$/);
          if (match) {
            const [, slideFile, language] = match;
            try {
              const narrationPath = path.resolve(narrationDir, file);
              const content = await fs.readFile(narrationPath, 'utf-8');
              const data = JSON.parse(content);
              
              narrations.push({
                slideFile,
                language: language as SupportedLanguage,
                metadata: data.metadata,
              });
            } catch (error) {
              console.warn(`Failed to read narration file ${file}:`, error);
            }
          }
        }
      }

      return {
        success: true,
        narrations,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createTemplateNarration(
    slideFile: string, 
    language: SupportedLanguage, 
    slideCount: number
  ): Promise<{
    success: boolean;
    templateData?: NarrationConfig;
    error?: string;
  }> {
    try {
      // Extract base filename from slideFile (remove language prefix if present)
      const baseFileName = slideFile.includes('/') ? slideFile.split('/').pop() : slideFile;
      
      const templateData: NarrationConfig = {
        metadata: {
          title: `${baseFileName} Narration`,
          language,
          speaker: language === 'ja' ? 'ja-JP-Neural2-B' : 'en-US-Neural2-F',
          version: '1.0',
        },
        slides: Array.from({ length: slideCount }, (_, index) => ({
          slideNumber: index + 1,
          narration: {
            auto: `Slide ${index + 1} narration text here`,
            onEnter: `Entering slide ${index + 1}`,
            onDemand: {
              "more info": `Additional information for slide ${index + 1}`,
              "details": `Detailed explanation of slide ${index + 1}`,
            },
          },
          transitions: {
            next: index < slideCount - 1 ? `Moving to slide ${index + 2}` : null,
            previous: index > 0 ? `Going back to slide ${index}` : null,
          },
        })),
      };

      return {
        success: true,
        templateData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
