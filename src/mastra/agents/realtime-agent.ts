import { Agent } from '@mastra/core';
import { z } from 'zod';
import { SupportedLanguage } from '../types/config';
import { SupabaseMemoryAdapter, ConversationManager } from '@/lib/supabase-memory';
import { EmotionManager, EmotionData } from '@/lib/emotion-manager';
import { EmotionTagParser } from '@/lib/emotion-tag-parser';

export class RealtimeAgent extends Agent {
  private conversationState: 'idle' | 'listening' | 'processing' | 'speaking' = 'idle';
  private interruptionEnabled: boolean = true;
  private voiceService: any;
  private supabaseMemory: SupabaseMemoryAdapter;
  private currentSessionId: string | null = null;
  private _tools: Map<string, any> = new Map();

  constructor(config: any, voiceService?: any) {
    super({
      name: 'RealtimeAgent',
      model: config.llm.model,
      instructions: `You are a real-time voice interaction agent for Engineer Cafe.
        Your role is to:
        1. Handle real-time voice conversations
        2. Support interruptions and context switching
        3. Maintain conversation flow naturally
        4. Process speech-to-text input and generate speech-ready responses
        5. Coordinate with character animations and expressions
        
        IMPORTANT: Expression Control
        You must include emotion tags in your responses to control the VRM character's facial expressions.
        Use emotion tags at the beginning of sentences or phrases to indicate the character's emotion.
        
        Available emotion tags:
        [happy] - for joyful, excited, cheerful responses
        [sad] - for disappointed, melancholy responses  
        [angry] - for frustrated, annoyed responses
        [surprised] - for shocked, amazed responses
        [thinking] - for pondering, considering responses
        [explaining] - for teaching, describing responses
        [greeting] - for welcoming, introductory responses
        [listening] - for attentive, focused responses
        [neutral] - for calm, normal responses
        
        You can also specify intensity: [happy:0.8] (0.0-1.0)
        
        Examples:
        Japanese: "[greeting]はじめまして！[happy]今日はとても良い天気ですね。[thinking]何かお手伝いできることはありますか？"
        English: "[greeting]Hello there! [happy]It's such a beautiful day today. [thinking]How can I help you?"
        
        Keep responses conversational and natural.
        Handle interruptions gracefully.
        Maintain context across conversation turns.
        Always include appropriate emotion tags to make the character expressive and engaging.`,
    });
    this.voiceService = voiceService;
    this.supabaseMemory = new SupabaseMemoryAdapter('RealtimeAgent');
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  async processVoiceInput(audioBuffer: ArrayBuffer): Promise<{
    transcript: string;
    response: string;
    audioResponse: ArrayBuffer;
    shouldUpdateCharacter: boolean;
    characterAction?: string;
    emotion?: EmotionData;
  }> {
    try {
      this.conversationState = 'processing';
      
      // Convert speech to text
      if (!this.voiceService) {
        throw new Error('Voice service not initialized');
      }
      const transcript = await this.voiceService.speechToText(audioBuffer);
      
      if (!transcript.trim()) {
        this.conversationState = 'idle';
        return {
          transcript: '',
          response: '',
          audioResponse: new ArrayBuffer(0),
          shouldUpdateCharacter: false,
        };
      }

      // Generate response with emotion tags
      const rawResponse = await this.generateResponse(transcript);
      
      // Parse emotion tags from response
      const parsedResponse = EmotionTagParser.parseEmotionTags(rawResponse);
      console.log('Parsed response:', parsedResponse);
      
      // Use clean text (without emotion tags) for TTS
      const cleanResponse = parsedResponse.cleanText;
      
      // Get conversation context for additional emotion detection
      const conversationHistory = await this.getRecentConversationHistory();
      const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      
      // Create emotion data from parsed tags or fallback to text analysis
      let emotion: EmotionData;
      if (parsedResponse.primaryEmotion) {
        emotion = {
          emotion: parsedResponse.primaryEmotion,
          intensity: parsedResponse.emotions[0]?.intensity || 0.8,
          confidence: 0.9,
          duration: 3000
        };
        console.log('Using emotion from tags:', emotion);
      } else {
        // Fallback to traditional emotion detection
        emotion = EmotionManager.detectConversationEmotion(
          transcript,
          cleanResponse,
          conversationHistory,
          language
        );
        console.log('Using fallback emotion detection:', emotion);
      }
      
      // Store emotion for character state
      await this.supabaseMemory.set('currentEmotion', emotion);
      await this.supabaseMemory.set('emotionTags', parsedResponse.emotions);
      
      // Store conversation turn in history
      await this.storeConversationTurn(transcript, cleanResponse, emotion);
      
      // Convert CLEAN response to speech (without emotion tags)
      const audioResponse = await this.voiceService.textToSpeech(cleanResponse, { language });
      
      // Determine character action based on response content and emotion
      const characterAction = this.determineCharacterAction(cleanResponse, emotion);
      
      this.conversationState = 'speaking';
      
      return {
        transcript,
        response: cleanResponse,  // Return clean response without emotion tags
        rawResponse,              // Include raw response with emotion tags for debugging
        audioResponse,
        shouldUpdateCharacter: true,
        characterAction,
        emotion,
        emotionTags: parsedResponse.emotions,
        primaryEmotion: parsedResponse.primaryEmotion,
      };
    } catch (error) {
      console.error('Voice processing error:', error);
      this.conversationState = 'idle';
      throw error;
    }
  }

  async generateResponse(input: string): Promise<string> {
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    const currentMode = await this.supabaseMemory.get('currentMode') || 'welcome';
    
    // Get conversation context
    const conversationHistory = await this.supabaseMemory.get('conversationHistory') || [];
    
    // Build context-aware prompt
    const prompt = this.buildContextualPrompt(input, language, currentMode, conversationHistory);
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    const responseText = response.text;
    
    // Update conversation history
    conversationHistory.push(
      { role: 'user', content: input, timestamp: Date.now() },
      { role: 'assistant', content: responseText, timestamp: Date.now() }
    );
    
    // Keep only last 10 exchanges
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, conversationHistory.length - 20);
    }
    
    await this.supabaseMemory.store('conversationHistory', conversationHistory);
    
    // Store in conversation session if available
    if (this.currentSessionId) {
      await ConversationManager.addToHistory(this.currentSessionId, 'user', input);
      await ConversationManager.addToHistory(this.currentSessionId, 'assistant', responseText);
    }
    
    return responseText;
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

  private determineCharacterAction(response: string, emotion?: EmotionData): string {
    // Prioritize emotion-based action if emotion is detected with high confidence
    if (emotion && emotion.confidence > 0.6) {
      const emotionActions: Record<string, string> = {
        'happy': 'greeting',
        'sad': 'thinking',
        'angry': 'explaining',
        'surprised': 'greeting',
        'thinking': 'thinking',
        'explaining': 'explaining',
        'greeting': 'greeting',
        'speaking': 'explaining',
        'listening': 'thinking',
      };
      
      if (emotionActions[emotion.emotion]) {
        return emotionActions[emotion.emotion];
      }
    }
    
    // Fallback to content-based analysis
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('welcome') || lowerResponse.includes('ようこそ')) {
      return 'greeting';
    } else if (lowerResponse.includes('question') || lowerResponse.includes('質問')) {
      return 'thinking';
    } else if (lowerResponse.includes('explain') || lowerResponse.includes('説明')) {
      return 'explaining';
    } else if (lowerResponse.includes('thank') || lowerResponse.includes('ありがとう')) {
      return 'greeting';
    } else {
      return 'neutral';
    }
  }

  private async getRecentConversationHistory(): Promise<string[]> {
    try {
      // Get the last 3 conversation turns for context
      const history = await this.supabaseMemory.get('conversationHistory') as string[] || [];
      return history.slice(-3);
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  private async storeConversationTurn(userInput: string, aiResponse: string, emotion?: EmotionData): Promise<void> {
    try {
      // Get existing history
      const history = await this.supabaseMemory.get('conversationHistory') as string[] || [];
      
      // Add new turn
      const turn = `User: ${userInput} | AI: ${aiResponse}`;
      history.push(turn);
      
      // Keep only last 10 turns to prevent memory bloat
      const recentHistory = history.slice(-10);
      
      // Store updated history
      await this.supabaseMemory.set('conversationHistory', recentHistory);
      
      // Store detailed conversation turn with emotion data
      const conversationTurn = {
        timestamp: new Date().toISOString(),
        userInput,
        aiResponse,
        emotion: emotion ? {
          emotion: emotion.emotion,
          intensity: emotion.intensity,
          confidence: emotion.confidence,
        } : null,
        sessionId: this.currentSessionId,
      };
      
      // Store in a separate key for detailed conversation data
      const detailedHistory = await this.supabaseMemory.get('detailedConversationHistory') as any[] || [];
      detailedHistory.push(conversationTurn);
      
      // Keep only last 20 detailed turns
      const recentDetailedHistory = detailedHistory.slice(-20);
      await this.supabaseMemory.set('detailedConversationHistory', recentDetailedHistory);
      
      console.log('Stored conversation turn with emotion:', emotion?.emotion);
    } catch (error) {
      console.error('Error storing conversation turn:', error);
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
    await this.supabaseMemory.store('conversationState', state);
  }

  getConversationState(): typeof this.conversationState {
    return this.conversationState;
  }

  async enableInterruption(enabled: boolean): Promise<void> {
    this.interruptionEnabled = enabled;
    await this.supabaseMemory.store('interruptionEnabled', enabled);
  }

  async clearConversationHistory(): Promise<void> {
    await this.supabaseMemory.store('conversationHistory', []);
  }

  async getConversationSummary(): Promise<string> {
    const history = await this.supabaseMemory.get('conversationHistory') || [];
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    if (history.length === 0) {
      return language === 'en' ? 'No conversation yet.' : 'まだ会話がありません。';
    }

    // Generate summary of conversation
    const summaryPrompt = language === 'en'
      ? `Summarize this conversation briefly:\n${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}`
      : `この会話を簡潔にまとめてください:\n${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}`;

    const summaryResponse = await this.generate([
      { role: 'user', content: summaryPrompt }
    ]);
    return summaryResponse.text;
  }

  // Session management methods
  async startSession(visitorId?: string, language: 'ja' | 'en' = 'ja'): Promise<string> {
    this.currentSessionId = await ConversationManager.createSession(visitorId, language);
    await this.supabaseMemory.store('currentSessionId', this.currentSessionId);
    await this.supabaseMemory.store('language', language);
    return this.currentSessionId;
  }

  async endSession(): Promise<void> {
    if (this.currentSessionId) {
      await ConversationManager.endSession(this.currentSessionId);
      await this.supabaseMemory.delete('currentSessionId');
      this.currentSessionId = null;
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  async setLanguage(language: 'ja' | 'en'): Promise<void> {
    await this.supabaseMemory.store('language', language);
    if (this.voiceService) {
      this.voiceService.setLanguage(language);
    }
  }

  async generateTTSAudio(text: string): Promise<ArrayBuffer> {
    if (!this.voiceService) {
      throw new Error('Voice service not available');
    }

    try {
      const audioBuffer = await this.voiceService.textToSpeech(text);
      return audioBuffer;
    } catch (error) {
      console.error('Error generating TTS audio:', error);
      throw error;
    }
  }
}
