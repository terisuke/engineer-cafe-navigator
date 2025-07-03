import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '@/mastra/types/config';
import { EmotionTagParser } from '@/lib/emotion-tag-parser';
import { preprocessTTS } from '@/utils/tts-preprocess';

export interface VoiceOutputAgentConfig {
  llm: {
    model: any;
  };
  tools: {
    voice: any;
  };
}

export interface VoiceOutputRequest {
  text: string;
  language: SupportedLanguage;
  emotion?: string;
  sessionId?: string;
  agentName?: string;
}

export interface VoiceOutputResponse {
  success: boolean;
  audioData?: ArrayBuffer;
  cleanText?: string;
  emotion?: string;
  error?: string;
}

export class VoiceOutputAgent extends Agent {
  private voiceService: any;

  constructor(config: VoiceOutputAgentConfig) {
    super({
      name: 'VoiceOutputAgent',
      model: config.llm.model,
      instructions: `You are a voice output specialist responsible for converting text responses from other agents into speech.
        Your main responsibilities are:
        1. Clean and prepare text for TTS conversion
        2. Handle emotion tags appropriately
        3. Ensure consistent voice output quality
        4. Handle errors gracefully`,
    });

    this.voiceService = config.tools.voice;
  }

  /**
   * Convert text response to speech with unified error handling
   */
  async convertTextToSpeech(request: VoiceOutputRequest): Promise<VoiceOutputResponse> {
    try {
      console.log(`[VoiceOutputAgent] Processing text from ${request.agentName || 'unknown'} agent`);
      
      // 1. Parse emotion tags and clean text
      const { cleanText, primaryEmotion } = EmotionTagParser.parseEmotionTags(request.text);
      
      // 2. Clean text for TTS (remove markdown, special characters, etc.)
      const ttsText = this.cleanTextForTTS(cleanText);
      
      // 3. Apply TTS preprocessing (MTG -> ミーティング, etc.)
      const processedText = preprocessTTS(ttsText, request.language);
      
      // 4. Check text length limits
      const textBytes = new TextEncoder().encode(processedText);
      if (textBytes.length > 5000) {
        console.warn('[VoiceOutputAgent] Text exceeds 5000 bytes, truncating...');
        const truncatedText = this.truncateTextByBytes(processedText, 5000);
        return await this.generateTTS(truncatedText, request.language, request.emotion || primaryEmotion || 'neutral');
      }
      
      // 5. Generate TTS
      return await this.generateTTS(processedText, request.language, request.emotion || primaryEmotion || 'neutral');
      
    } catch (error) {
      console.error('[VoiceOutputAgent] Error in text-to-speech conversion:', error);
      
      // Return a fallback error response instead of throwing
      const fallbackText = this.getFallbackErrorMessage(request.language);
      try {
        // Try to generate TTS for error message
        const fallbackResponse = await this.generateTTS(fallbackText, request.language, 'apologetic');
        return {
          ...fallbackResponse,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      } catch (fallbackError) {
        // If even fallback fails, return error without audio
        return {
          success: false,
          error: `Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  }

  /**
   * Generate TTS audio
   */
  private async generateTTS(text: string, language: SupportedLanguage, emotion: string): Promise<VoiceOutputResponse> {
    try {
      // Call voice service with the correct interface
      const result = await this.voiceService.textToSpeech(text, language, emotion);
      
      if (!result.success || !result.audioBase64) {
        throw new Error(result.error || 'TTS generation failed');
      }
      
      // Convert base64 to ArrayBuffer
      const audioData = Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0));
      
      return {
        success: true,
        audioData: audioData.buffer,
        cleanText: text,
        emotion
      };
    } catch (error) {
      throw new Error(`TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean text for TTS by removing markdown and special formatting
   */
  private cleanTextForTTS(text: string): string {
    return text
      // Remove bold markers
      .replace(/\*\*/g, '')
      // Remove italic markers and list markers
      .replace(/\*/g, '')
      // Remove numbered list prefixes
      .replace(/^\d+\.\s*/gm, '')
      // Remove headers
      .replace(/^#+\s+/gm, '')
      // Remove links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove code blocks
      .replace(/```[^`]*```/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Truncate text to fit within byte limit
   */
  private truncateTextByBytes(text: string, maxBytes: number): string {
    const encoder = new TextEncoder();
    let truncated = text;
    
    while (encoder.encode(truncated).length > maxBytes) {
      // Remove last sentence
      const sentences = truncated.split('。');
      if (sentences.length > 1) {
        sentences.pop();
        truncated = sentences.join('。') + '。';
      } else {
        // If no sentences, truncate by characters
        truncated = truncated.substring(0, truncated.length - 10);
      }
    }
    
    return truncated;
  }

  /**
   * Get appropriate voice settings for emotion
   */
  private getVoiceForEmotion(emotion: string, language: SupportedLanguage): any {
    // This can be extended to return different voice settings based on emotion
    // For now, using default voice with emotion parameter
    return undefined; // Use default voice
  }

  /**
   * Get fallback error message in appropriate language
   */
  private getFallbackErrorMessage(language: SupportedLanguage): string {
    return language === 'ja' 
      ? '申し訳ございません。音声の生成に失敗しました。'
      : 'I apologize, but I failed to generate the audio response.';
  }

  /**
   * Handle text streaming for real-time TTS
   */
  async *streamTextToSpeech(textStream: AsyncIterable<string>, language: SupportedLanguage): AsyncGenerator<ArrayBuffer> {
    let buffer = '';
    
    for await (const chunk of textStream) {
      buffer += chunk;
      
      // Process complete sentences
      const sentences = buffer.split(/[。.!?]/);
      if (sentences.length > 1) {
        // Keep last incomplete sentence in buffer
        buffer = sentences[sentences.length - 1];
        
        // Process complete sentences
        for (let i = 0; i < sentences.length - 1; i++) {
          const sentence = sentences[i].trim();
          if (sentence) {
            const response = await this.convertTextToSpeech({
              text: sentence,
              language
            });
            
            if (response.success && response.audioData) {
              yield response.audioData;
            }
          }
        }
      }
    }
    
    // Process remaining buffer
    if (buffer.trim()) {
      const response = await this.convertTextToSpeech({
        text: buffer,
        language
      });
      
      if (response.success && response.audioData) {
        yield response.audioData;
      }
    }
  }
}