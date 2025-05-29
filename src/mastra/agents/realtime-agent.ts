import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { SupportedLanguage } from '../types/config';

export class RealtimeAgent extends Agent {
  private conversationState: 'idle' | 'listening' | 'processing' | 'speaking' = 'idle';
  private interruptionEnabled: boolean = true;

  constructor(mastra: any) {
    super({
      name: 'RealtimeAgent',
      instructions: `You are a real-time voice interaction agent for Engineer Cafe.
        Your role is to:
        1. Handle real-time voice conversations
        2. Support interruptions and context switching
        3. Maintain conversation flow naturally
        4. Process speech-to-text input and generate speech-ready responses
        5. Coordinate with character animations and expressions
        
        Keep responses conversational and natural.
        Handle interruptions gracefully.
        Maintain context across conversation turns.`,
      model: 'gemini-2.5-flash-preview-05-20',
      tools: [],
      memory: mastra.memory,
    });
  }

  async processVoiceInput(audioBuffer: ArrayBuffer): Promise<{
    transcript: string;
    response: string;
    audioResponse: ArrayBuffer;
    shouldUpdateCharacter: boolean;
    characterAction?: string;
  }> {
    try {
      this.conversationState = 'processing';
      
      // Convert speech to text
      const voiceService = this.tools.get('voiceService');
      const transcript = await voiceService.speechToText(audioBuffer);
      
      if (!transcript.trim()) {
        this.conversationState = 'idle';
        return {
          transcript: '',
          response: '',
          audioResponse: new ArrayBuffer(0),
          shouldUpdateCharacter: false,
        };
      }

      // Generate response
      const response = await this.generateResponse(transcript);
      
      // Convert response to speech
      const language = await this.memory.get('language') as SupportedLanguage || 'ja';
      const audioResponse = await voiceService.textToSpeech(response, { language });
      
      // Determine character action based on response content
      const characterAction = this.determineCharacterAction(response);
      
      this.conversationState = 'speaking';
      
      return {
        transcript,
        response,
        audioResponse,
        shouldUpdateCharacter: true,
        characterAction,
      };
    } catch (error) {
      console.error('Voice processing error:', error);
      this.conversationState = 'idle';
      throw error;
    }
  }

  async generateResponse(input: string): Promise<string> {
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    const currentMode = await this.memory.get('currentMode') || 'welcome';
    
    // Get conversation context
    const conversationHistory = await this.memory.get('conversationHistory') || [];
    
    // Build context-aware prompt
    const prompt = this.buildContextualPrompt(input, language, currentMode, conversationHistory);
    
    const response = await this.run(prompt);
    
    // Update conversation history
    conversationHistory.push(
      { role: 'user', content: input, timestamp: Date.now() },
      { role: 'assistant', content: response, timestamp: Date.now() }
    );
    
    // Keep only last 10 exchanges
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, conversationHistory.length - 20);
    }
    
    await this.memory.store('conversationHistory', conversationHistory);
    
    return response;
  }

  private buildContextualPrompt(
    input: string, 
    language: SupportedLanguage, 
    mode: string, 
    history: any[]
  ): string {
    const systemPrompt = language === 'en'
      ? `You are assisting a visitor at Engineer Cafe. Current mode: ${mode}. 
         Respond naturally and helpfully to their voice input.`
      : `エンジニアカフェの来訪者をサポートしています。現在のモード: ${mode}。
         音声入力に自然で親切に応答してください。`;

    const contextHistory = history.length > 0 
      ? `Previous conversation:\n${history.slice(-6).map(h => `${h.role}: ${h.content}`).join('\n')}\n\n`
      : '';

    return `${systemPrompt}\n\n${contextHistory}User: ${input}\nAssistant:`;
  }

  private determineCharacterAction(response: string): string {
    // Analyze response content to determine appropriate character action
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('welcome') || lowerResponse.includes('ようこそ')) {
      return 'greeting';
    } else if (lowerResponse.includes('question') || lowerResponse.includes('質問')) {
      return 'thinking';
    } else if (lowerResponse.includes('explain') || lowerResponse.includes('説明')) {
      return 'explaining';
    } else if (lowerResponse.includes('thank') || lowerResponse.includes('ありがとう')) {
      return 'bowing';
    } else {
      return 'neutral';
    }
  }

  async handleInterruption(): Promise<void> {
    if (this.conversationState === 'speaking' && this.interruptionEnabled) {
      this.conversationState = 'listening';
      // TODO: Stop current audio playback
      // TODO: Reset character to listening state
    }
  }

  async setConversationState(state: typeof this.conversationState): Promise<void> {
    this.conversationState = state;
    await this.memory.store('conversationState', state);
  }

  getConversationState(): typeof this.conversationState {
    return this.conversationState;
  }

  async enableInterruption(enabled: boolean): Promise<void> {
    this.interruptionEnabled = enabled;
    await this.memory.store('interruptionEnabled', enabled);
  }

  async clearConversationHistory(): Promise<void> {
    await this.memory.store('conversationHistory', []);
  }

  async getConversationSummary(): Promise<string> {
    const history = await this.memory.get('conversationHistory') || [];
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    
    if (history.length === 0) {
      return language === 'en' ? 'No conversation yet.' : 'まだ会話がありません。';
    }

    // Generate summary of conversation
    const summaryPrompt = language === 'en'
      ? `Summarize this conversation briefly:\n${history.map(h => `${h.role}: ${h.content}`).join('\n')}`
      : `この会話を簡潔にまとめてください:\n${history.map(h => `${h.role}: ${h.content}`).join('\n')}`;

    const summary = await this.run(summaryPrompt);
    return summary;
  }
}
