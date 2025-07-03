/**
 * Agent Response Helper
 * Ensures all agent responses include proper emotion tags
 */

import { EmotionTagger, UnifiedEmotion } from './emotion-tagger';
import { SupportedLanguage } from '@/mastra/types/config';

export interface AgentResponseOptions {
  agent: string;
  category?: string;
  hasError?: boolean;
  isEmpty?: boolean;
}

export class AgentResponseHelper {
  /**
   * Process agent response to ensure emotion tags are included
   */
  static processResponse(
    response: string,
    language: SupportedLanguage,
    options: AgentResponseOptions
  ): string {
    // Check if response already has emotion tag
    const hasEmotionTag = /^\[[a-zA-Z_]+(?::\d*\.?\d+)?\]/.test(response.trim());
    if (hasEmotionTag) {
      return response;
    }

    // Determine appropriate emotion based on context
    let emotion: UnifiedEmotion;
    
    if (options.hasError) {
      emotion = 'sad';
    } else if (options.isEmpty) {
      emotion = 'sad';
    } else {
      // Get emotion based on agent and category
      emotion = EmotionTagger.getEmotionForContext(options.agent, options.category);
    }

    // Add emotion tag
    return EmotionTagger.addEmotionTag(response, emotion);
  }

  /**
   * Create agent instructions with emotion tag requirements
   */
  static createInstructions(
    baseInstructions: string,
    agentName: string
  ): string {
    const emotionInstructions = `
    
IMPORTANT: Always start your response with an emotion tag.
Available emotions: [happy], [sad], [angry], [relaxed], [surprised]

Emotion Guidelines:
- Use [happy] for positive information, successful results, greetings
- Use [sad] for unavailable services, errors, apologies
- Use [relaxed] for general information, explanations
- Use [surprised] for questions, clarifications
- Use [angry] only for serious violations or prohibited actions

Example responses:
- "[happy]Found 3 events for today!"
- "[relaxed]The facility is located on the 2nd floor."
- "[sad]Sorry, no events are scheduled for today."
- "[surprised]Which specific facility are you asking about?"`;

    return baseInstructions + emotionInstructions;
  }

  /**
   * Wrap LLM prompt with emotion tag instructions
   */
  static wrapPrompt(
    prompt: string,
    language: SupportedLanguage,
    defaultEmotion: UnifiedEmotion = 'relaxed'
  ): string {
    const emotionInstruction = language === 'en'
      ? `Remember to start your response with an emotion tag: [happy], [sad], [angry], [relaxed], or [surprised]. Default to [${defaultEmotion}] if unsure.`
      : `回答の最初に感情タグを付けることを忘れないでください: [happy], [sad], [angry], [relaxed], または [surprised]。不確かな場合は[${defaultEmotion}]を使用してください。`;

    return `${prompt}\n\n${emotionInstruction}`;
  }

  /**
   * Extract emotion from LLM response and ensure proper formatting
   */
  static formatLLMResponse(
    rawResponse: string,
    fallbackEmotion: UnifiedEmotion = 'relaxed'
  ): string {
    // Clean up any double emotion tags or malformed tags
    let cleaned = rawResponse.trim();
    
    // Remove duplicate emotion tags
    cleaned = cleaned.replace(/(\[[a-zA-Z_]+(?::\d*\.?\d+)?\])\s*\1/g, '$1');
    
    // If no emotion tag, add one
    if (!/^\[[a-zA-Z_]+(?::\d*\.?\d+)?\]/.test(cleaned)) {
      cleaned = EmotionTagger.addEmotionTag(cleaned, fallbackEmotion);
    }
    
    return cleaned;
  }

  /**
   * Get emotion for specific response types
   */
  static getEmotionForResponseType(responseType: string): UnifiedEmotion {
    const emotionMap: Record<string, UnifiedEmotion> = {
      // Positive responses
      'found': 'happy',
      'available': 'happy',
      'success': 'happy',
      'greeting': 'happy',
      
      // Negative responses
      'not-found': 'sad',
      'unavailable': 'sad',
      'error': 'sad',
      'closed': 'sad',
      
      // Informational responses
      'info': 'relaxed',
      'explanation': 'relaxed',
      'details': 'relaxed',
      
      // Questions
      'clarification': 'surprised',
      'question': 'surprised',
      
      // Default
      'default': 'relaxed'
    };
    
    return emotionMap[responseType] || emotionMap['default'];
  }
}