import { EmotionData, EmotionManager } from '@/lib/emotion-manager';
import { EmotionTagParser } from '@/lib/emotion-tag-parser';
import { endPerformance, logPerformanceSummary, startPerformance } from '@/lib/performance-monitor';
import { ConversationManager, SupabaseMemoryAdapter } from '@/lib/supabase-memory';
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';
import { TextChunker } from '@/lib/text-chunker';
import { getEngineerCafeNavigator } from '@/mastra';
import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '../types/config';
import { EnhancedQAAgent } from './enhanced-qa-agent';

export class RealtimeAgent extends Agent {
  private conversationState: 'idle' | 'listening' | 'processing' | 'speaking' = 'idle';
  private interruptionEnabled: boolean = true;
  private voiceService: any;
  private supabaseMemory: SupabaseMemoryAdapter;
  private simplifiedMemory: SimplifiedMemorySystem;
  private currentSessionId: string | null = null;
  private _tools: Map<string, any> = new Map();
  private config: any;

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
        
        Available emotion tags (aituber-kit standard):
        [neutral] - for calm, normal, explaining responses
        [happy] - for joyful, excited, cheerful, greeting responses
        [sad] - for disappointed, melancholy, apologetic responses  
        [angry] - for frustrated, annoyed responses
        [relaxed] - for thinking, pondering, listening responses
        [surprised] - for shocked, amazed responses
        
        You can also specify intensity: [happy:0.8] (0.0-1.0)
        
        Examples:
        Japanese: "[happy]はじめまして！[neutral]今日はとても良い天気ですね。[relaxed]何かお手伝いできることはありますか？"
        English: "[happy]Hello there! [neutral]It's such a beautiful day today. [relaxed]How can I help you?"
        
        Keep responses conversational and natural.
        Handle interruptions gracefully.
        Maintain context across conversation turns.
        Always include appropriate emotion tags to make the character expressive and engaging.`,
    });
    this.voiceService = voiceService;
    this.supabaseMemory = new SupabaseMemoryAdapter('RealtimeAgent');
    this.simplifiedMemory = new SimplifiedMemorySystem('RealtimeAgent');
    this.config = config;
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  async processTextInput(text: string): Promise<{
    response: string;
    rawResponse?: string;
    audioResponse?: ArrayBuffer;
    shouldUpdateCharacter: boolean;
    characterAction?: string;
    emotion?: EmotionData;
    emotionTags?: any[];
    primaryEmotion?: string;
  }> {
    const performanceSteps: Record<string, number> = {};
    
    try {
      this.conversationState = 'processing';
      
      if (!text.trim()) {
        this.conversationState = 'idle';
        return {
          response: '',
          shouldUpdateCharacter: false,
        };
      }

      // Generate response with emotion tags
      startPerformance('AI Response Generation (Text)');
      const rawResponse = await this.generateResponse(text);
      performanceSteps['AI Response Generation'] = endPerformance('AI Response Generation (Text)');
      
      // Parse emotion tags from response
      const parsedResponse = EmotionTagParser.parseEmotionTags(rawResponse);
      console.log('Parsed response:', parsedResponse);
      
      // Use clean text (without emotion tags) for TTS
      const cleanResponse = parsedResponse.cleanText;
      
      // Get conversation context for additional emotion detection
      const conversationHistory = await this.getRecentConversationHistory();
      
      // Get emotion data with enhanced analysis
      const emotion = EmotionManager.detectConversationEmotion(
        text,
        cleanResponse,
        conversationHistory
      );
      
      // Store conversation turn with emotion (both long-term and short-term)
      // Store conversation in memory systems
      // TODO: Migration in progress - currently using both systems for compatibility
      await this.storeConversationTurn(text, cleanResponse, emotion);
      
      // Primary memory storage using SimplifiedMemorySystem
      try {
        await this.simplifiedMemory.addMessage('user', text, {
          emotion: emotion?.emotion,
          confidence: emotion?.confidence,
          sessionId: this.currentSessionId || undefined,
        });
        await this.simplifiedMemory.addMessage('assistant', cleanResponse, {
          emotion: emotion?.emotion,
          confidence: emotion?.confidence,
          sessionId: this.currentSessionId || undefined,
        });
      } catch (error) {
        console.error('[RealtimeAgent] Failed to store in SimplifiedMemorySystem:', error);
        // Fallback to legacy system if SimplifiedMemorySystem fails
      }
      
      // Generate TTS audio for the response
      startPerformance('Text-to-Speech');
      const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      const cleanedForTTS = this.cleanTextForTTS(cleanResponse);
      
      // Set voice parameters based on emotion
      if (emotion && this.voiceService.setSpeakerByEmotion) {
        this.voiceService.setSpeakerByEmotion(emotion.emotion);
      }
      
      let audioResponse: ArrayBuffer | undefined;
      try {
        const ttsResult = await this.voiceService.textToSpeech(cleanedForTTS, language, emotion?.emotion);
        
        if (ttsResult.success && ttsResult.audioBase64) {
          // Convert base64 to ArrayBuffer
          const audioData = Uint8Array.from(atob(ttsResult.audioBase64), c => c.charCodeAt(0));
          audioResponse = audioData.buffer;
        }
      } catch (ttsError) {
        console.error('TTS generation failed:', ttsError);
        // Continue without audio
      }
      performanceSteps['Text-to-Speech'] = endPerformance('Text-to-Speech');
      
      this.conversationState = 'speaking';
      
      const characterAction = this.determineCharacterAction(cleanResponse, emotion);
      
      // Log performance summary for text processing
      logPerformanceSummary(performanceSteps);
      
      return {
        response: cleanResponse,
        rawResponse: rawResponse,
        audioResponse,
        shouldUpdateCharacter: true,
        characterAction,
        emotion,
        emotionTags: parsedResponse.emotions,
        primaryEmotion: parsedResponse.primaryEmotion
      };
    } catch (error) {
      this.conversationState = 'idle';
      console.error('Error processing text input:', error);
      // 開始したパフォーマンス計測が未終了ならここで終了させる
      if (performanceSteps['AI Response Generation'] === undefined) {
        performanceSteps['AI Response Generation'] = endPerformance('AI Response Generation (Text)');
      }
      // 他に追加したい計測があれば同様にここでendPerformanceを呼ぶ
      logPerformanceSummary(performanceSteps);
      throw error;
    }
  }

  async processVoiceInput(audioBuffer: ArrayBuffer): Promise<{
    transcript: string;
    response: string;
    rawResponse?: string;
    audioResponse: ArrayBuffer;
    shouldUpdateCharacter: boolean;
    characterAction?: string;
    emotion?: EmotionData;
    emotionTags?: any[];
    primaryEmotion?: string;
    responseText?: string;
    error?: string;
  }> {
    const performanceSteps: Record<string, number> = {};
    
    try {
      this.conversationState = 'processing';
      
      // Convert speech to text
      if (!this.voiceService) {
        throw new Error('Voice service not initialized');
      }
      startPerformance('Speech-to-Text');
      // Convert ArrayBuffer to base64 for the API using Buffer to avoid stack overflow
      const uint8Array = new Uint8Array(audioBuffer);
      const audioBase64 = Buffer.from(uint8Array).toString('base64');
      
      const currentLang = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      const result = await this.voiceService.speechToText(audioBase64, currentLang);
      performanceSteps['Speech-to-Text'] = endPerformance('Speech-to-Text');
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[RealtimeAgent] STT result:', {
          success: result.success,
          transcript: result.transcript,
          confidence: result.confidence,
          error: result.error
        });
      }
      
      // Check confidence threshold (ignore very low-confidence STT results)
      if (!result.success || !result.transcript || !result.transcript.trim()) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[RealtimeAgent] STT failed validation:', {
            success: result.success,
            hasTranscript: !!result.transcript,
            transcriptTrimmed: result.transcript ? result.transcript.trim() : null
          });
        }
        this.conversationState = 'idle';
        return {
          transcript: '',
          response: '',
          audioResponse: new ArrayBuffer(0),
          shouldUpdateCharacter: false,
          error: result.error || 'Speech recognition confidence too low',
        };
      }
      
      const transcript = result.transcript;

      // Generate response with emotion tags
      startPerformance('AI Response Generation');
      const rawResponse = await this.generateResponse(transcript);
      performanceSteps['AI Response Generation'] = endPerformance('AI Response Generation');
      
      // Parse emotion tags from response
      startPerformance('Emotion Parsing');
      const parsedResponse = EmotionTagParser.parseEmotionTags(rawResponse);
      performanceSteps['Emotion Parsing'] = endPerformance('Emotion Parsing');
      
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
      } else {
        // Fallback to traditional emotion detection
        emotion = EmotionManager.detectConversationEmotion(
          transcript,
          cleanResponse,
          conversationHistory
        );
      }
      
      // Store emotion for character state (async, non-blocking)
      this.supabaseMemory.set('currentEmotion', emotion).catch(console.error);
      this.supabaseMemory.set('emotionTags', parsedResponse.emotions).catch(console.error);
      
      // Store conversation in memory systems (async, non-blocking)
      // TODO: Migration in progress - currently using both systems for compatibility
      this.storeConversationTurn(transcript, cleanResponse, emotion).catch(console.error);
      
      // Primary memory storage using SimplifiedMemorySystem
      this.simplifiedMemory.addMessage('user', transcript, {
        emotion: emotion?.emotion,
        confidence: emotion?.confidence,
        sessionId: this.currentSessionId || undefined,
      }).catch((error) => {
        console.error('[RealtimeAgent] Failed to store user message in SimplifiedMemorySystem:', error);
      });
      
      this.simplifiedMemory.addMessage('assistant', cleanResponse, {
        emotion: emotion?.emotion,
        confidence: emotion?.confidence,
        sessionId: this.currentSessionId || undefined,
      }).catch((error) => {
        console.error('[RealtimeAgent] Failed to store assistant message in SimplifiedMemorySystem:', error);
      });
      
      // Convert CLEAN response to speech (without emotion tags and markdown)
      startPerformance('Text-to-Speech');
      const cleanedForTTS = this.cleanTextForTTS(cleanResponse);
      
      // Set voice parameters based on emotion
      if (emotion && this.voiceService.setSpeakerByEmotion) {
        this.voiceService.setSpeakerByEmotion(emotion.emotion);
      }
      
      // Always process the full text for better user experience
      const ttsResult = await this.voiceService.textToSpeech(cleanedForTTS, currentLang, emotion?.emotion);
      
      if (!ttsResult.success || !ttsResult.audioBase64) {
        throw new Error(ttsResult.error || 'TTS generation failed');
      }
      
      // Convert base64 to ArrayBuffer
      const audioData = Uint8Array.from(atob(ttsResult.audioBase64), c => c.charCodeAt(0));
      const audioResponse = audioData.buffer;
      
      performanceSteps['Text-to-Speech'] = endPerformance('Text-to-Speech');
      
      // Determine character action based on response content and emotion (simple default)
      const characterAction = 'speaking';
      
      this.conversationState = 'speaking';
      
      // Log performance summary
      logPerformanceSummary(performanceSteps);
      
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
        responseText: cleanResponse,
      };
    } catch (error) {
      console.error('Voice processing error:', error);
      this.conversationState = 'idle';
      // Log partial performance data if available
      if (Object.keys(performanceSteps).length > 0) {
        logPerformanceSummary(performanceSteps);
      }
      throw error;
    }
  }

  async generateResponse(input: string): Promise<string> {
    let language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('[RealtimeAgent] generateResponse called with input:', input);
    }
    
    // Try RAG via existing QA-agent first
    try {
      const navigator = getEngineerCafeNavigator(this.config);
      const qaAgent = navigator.getAgent('qa') as EnhancedQAAgent | undefined;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[RealtimeAgent] QA agent available:', !!qaAgent);
      }
      
      if (qaAgent && qaAgent.answerQuestion) {
        // Ensure QA agent uses the same language as RealtimeAgent
        if (qaAgent.setLanguage) {
          await qaAgent.setLanguage(language);
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[RealtimeAgent] Calling QA agent with input:', input, 'language:', language);
        }
        const qaAnswer: string = await qaAgent.answerQuestion(input);
        if (process.env.NODE_ENV !== 'production') {
          console.log('[RealtimeAgent] QA agent response:', qaAnswer ? qaAnswer.substring(0, 200) + '...' : 'null/empty');
        }
        
        if (qaAnswer && qaAnswer.trim()) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[RealtimeAgent] Using QA agent response');
          }
          return qaAnswer;
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[RealtimeAgent] QA agent returned empty response, falling back to standard response');
          }
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[RealtimeAgent] QA agent not available or missing answerQuestion method');
        }
      }
    } catch (err) {
      console.error('[RealtimeAgent] QA-agent RAG fallback failed:', err);
    }
    
    // Auto-detect language from input if confidence is high enough
    const languageTool = this._tools.get('languageSwitch');
    if (languageTool) {
      try {
        const detection = await languageTool.execute({
          action: 'detectLanguage',
          text: input,
        });
        
        // Only switch if detection confidence is extremely high (>=0.98) to avoid
        // accidental language changes triggered by speech recognition errors.
        if (detection.success && detection.result.confidence >= 0.98) {
          const detectedLanguage = detection.result.detectedLanguage;
          
          // Switch language if detected language is different and confidence is high
          if (detectedLanguage !== language) {
            console.log(`Auto-switching language from ${language} to ${detectedLanguage} (confidence: ${detection.result.confidence})`);
            await this.setLanguage(detectedLanguage);
            language = detectedLanguage;
          }
        }
      } catch (error) {
        console.error('Language detection error:', error);
      }
    }
    
    const currentMode = await this.supabaseMemory.get('currentMode') || 'welcome';
    
    // Get comprehensive context using SimplifiedMemorySystem
    const memoryContext = await this.simplifiedMemory.getContext(input, {
      includeKnowledgeBase: true,
      language: language as 'ja' | 'en'
    });
    
    // Check if conversation is still active
    const isActiveConversation = await this.simplifiedMemory.isConversationActive();
    
    // Build context-aware prompt with comprehensive memory
    const prompt = this.buildContextualPrompt(input, language, currentMode, memoryContext, isActiveConversation);
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    const responseText = response.text;
    
    // Parse emotion from response for context
    const parsedResponse = EmotionTagParser.parseEmotionTags(responseText);
    const primaryEmotion = parsedResponse.emotions?.[0]?.emotion || 'neutral';
    
    // Store conversation in SimplifiedMemorySystem
    await this.simplifiedMemory.addMessage('user', input, {
      sessionId: this.currentSessionId || undefined
    });
    
    await this.simplifiedMemory.addMessage('assistant', responseText, {
      emotion: primaryEmotion,
      sessionId: this.currentSessionId || undefined
    });
    
    // Legacy: Also store in conversation session for compatibility
    if (this.currentSessionId) {
      await ConversationManager.addToHistory(this.currentSessionId, 'user', input);
      await ConversationManager.addToHistory(this.currentSessionId, 'assistant', responseText);
    }
    
    return responseText;
  }

  private cleanTextForTTS(text: string): string {
    return text
      .replace(/\*\*/g, '')        // Remove bold markers
      .replace(/\*/g, '')          // Remove italic/list markers
      .replace(/^[\s\-\*]+/gm, '') // Remove list prefixes
      .replace(/_/g, '')           // Remove underscores
      .replace(/`/g, '')           // Remove code markers
      .replace(/#+\s/g, '')        // Remove headings
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/\n\s*\n/g, '\n')   // Remove extra line breaks
      .trim();
  }

  private extractFirstSentence(text: string): string {
    const sentences = text.split(/[。！？.!?]/);
    if (sentences.length > 0 && sentences[0].trim()) {
      return sentences[0].trim() + (text.includes('。') ? '。' : '！');
    }
    return text.slice(0, 100); // Fallback to first 100 characters
  }

  private async processRemainingTextAsync(remainingText: string, language: string, emotion?: string): Promise<void> {
    try {
      // Generate TTS for remaining text
      const result = await this.voiceService.textToSpeech(remainingText, language, emotion);
      
      if (result.success && result.audioBase64) {
        // TODO: Send remaining audio to frontend via WebSocket or store for later retrieval
        console.log(`Background TTS completed for remaining text (${remainingText.length} chars)`);
      }
    } catch (error) {
      console.error('Background TTS processing failed:', error);
    }
  }

  private buildContextualPrompt(
    input: string, 
    language: SupportedLanguage, 
    mode: string, 
    memoryContext: any,
    isActiveConversation?: boolean
  ): string {
    const systemPrompt = language === 'en'
      ? `You're an Engineer Cafe assistant. Use the provided conversation history and knowledge base to give contextual responses. 
         Respond briefly in English with emotion tags: [happy], [neutral], [excited], [relaxed]. 
         Example: "[happy] How can I help?" Keep responses short and natural.`
      : `エンジニアカフェのアシスタントです。提供された会話履歴と知識ベースを使用して文脈のある回答をしてください。
         感情タグ付きで簡潔に日本語で応答: [happy], [neutral], [excited], [relaxed]
         例: "[happy] いかがお手伝いしましょうか？" 短く自然に答えてください。`;

    // Use the comprehensive context from SimplifiedMemorySystem
    let contextSection = '';
    if (memoryContext && memoryContext.contextString && memoryContext.contextString.trim()) {
      contextSection = `\n${memoryContext.contextString}\n\n`;
    }

    const conversationStatus = isActiveConversation 
      ? (language === 'en' ? ' (Continuing conversation)' : ' (会話継続中)')
      : (language === 'en' ? ' (New conversation)' : ' (新しい会話)');

    return `${systemPrompt}${conversationStatus}\n${contextSection}User: ${input}\nAssistant:`;
  }

  private determineCharacterAction(response: string, emotion?: EmotionData): string {
    // Prioritize emotion-based action if emotion is detected with high confidence
    if (emotion && emotion.confidence > 0.6) {
      const emotionActions: Record<string, string> = {
        'neutral': 'neutral',
        'happy': 'greeting',
        'sad': 'thinking',
        'angry': 'explaining',
        'relaxed': 'thinking',
        'surprised': 'greeting',
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
      const history = await this.supabaseMemory.get('conversationHistory') as any[] || [];
      return history.slice(-3).map(item => {
        if (typeof item === 'string') {
          return item;
        } else if (item && item.content) {
          return `${item.role || 'user'}: ${item.content}`;
        } else {
          return '';
        }
      }).filter(Boolean);
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  private async storeConversationTurn(userInput: string, aiResponse: string, emotion?: EmotionData): Promise<void> {
    try {
      // Get existing history
      const history = await this.supabaseMemory.get('conversationHistory') as any[] || [];
      
      // Add new turn with consistent object structure
      history.push(
        { role: 'user', content: userInput, timestamp: Date.now() },
        { role: 'assistant', content: aiResponse, timestamp: Date.now() }
      );
      
      // Keep only last 20 entries (10 turns) to prevent memory bloat
      const recentHistory = history.slice(-20);
      
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
    // Also clear short-term memory
    await this.simplifiedMemory.cleanup();
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

  // Short-term memory management methods
  async getShortTermMemoryStats(): Promise<{
    activeTurns: number;
    oldestTurn: number | null;
    newestTurn: number | null;
    dominantEmotion: string | null;
    timeSpan: number;
    sessionSummary: string;
  }> {
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    const sessionSummary = await this.simplifiedMemory.getSessionSummary(language);
    const stats = await this.simplifiedMemory.getMemoryStats();
    
    return {
      ...stats,
      sessionSummary,
    };
  }

  async isConversationActive(): Promise<boolean> {
    return await this.simplifiedMemory.isConversationActive();
  }

  async promoteToLongTermMemory(key: string, data: any, reason: string): Promise<void> {
    try {
      const longTermData = {
        data,
        reason,
        promotedAt: Date.now(),
        originalSource: 'short_term_memory',
      };

      // Store in agent_memory without TTL for long-term persistence
      await this.supabaseMemory.set(`long_term_${key}`, longTermData);
      
      console.log(`[RealtimeAgent] Promoted data to long-term memory: ${key} (${reason})`);
    } catch (error) {
      console.error(`[RealtimeAgent] Error promoting to long-term memory:`, error);
    }
  }

  async cleanupShortTermMemory(): Promise<void> {
    await this.simplifiedMemory.cleanup();
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
      // Clean markdown formatting before TTS
      const cleanedText = this.cleanTextForTTS(text);
      const currentLang = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      const result = await this.voiceService.textToSpeech(cleanedText, currentLang);
      
      if (!result.success || !result.audioBase64) {
        throw new Error(result.error || 'TTS generation failed');
      }
      
      // Convert base64 to ArrayBuffer
      const audioData = Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0));
      return audioData.buffer;
    } catch (error) {
      console.error('Error generating TTS audio:', error);
      throw error;
    }
  }

  // Generate streaming audio response (returns chunks for immediate playback)
  async *generateStreamingTTSAudio(
    text: string, 
    language: SupportedLanguage = 'ja',
    emotion?: EmotionData
  ): AsyncGenerator<{
    chunk: ArrayBuffer;
    text: string;
    index: number;
    isLast: boolean;
    emotion?: string;
  }> {
    if (!this.voiceService) {
      throw new Error('Voice service not initialized');
    }

    // Set voice parameters based on emotion
    if (emotion && this.voiceService.setSpeakerByEmotion) {
      console.log(`[RealtimeAgent] Setting streaming voice emotion: ${emotion.emotion}`);
      this.voiceService.setSpeakerByEmotion(emotion.emotion);
    }

    // Check if text needs chunking
    if (!TextChunker.needsChunking(text)) {
      // For short text, just return single chunk
      const result = await this.voiceService.textToSpeech(text, language);
      
      if (!result.success || !result.audioBase64) {
        throw new Error(result.error || 'TTS generation failed');
      }
      
      // Convert base64 to ArrayBuffer
      const audioData = Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0));
      
      yield {
        chunk: audioData.buffer,
        text,
        index: 0,
        isLast: true,
        emotion: emotion?.emotion
      };
      return;
    }

    // Split text into chunks for streaming
    const chunks = TextChunker.chunkText(text, language);
    console.log(`[Streaming TTS] Splitting text into ${chunks.length} chunks`);

    // Process chunks in parallel batches for better performance
    const BATCH_SIZE = 2; // Process 2 chunks at a time
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, Math.min(i + BATCH_SIZE, chunks.length));
      
      // Generate TTS for batch in parallel
      const batchPromises = batch.map(async (chunk) => {
        const start = Date.now();
        
        // Use chunk-specific emotion if available, otherwise use the overall emotion
        const chunkEmotion = chunk.emotion || emotion?.emotion;
        if (chunkEmotion && this.voiceService.setSpeakerByEmotion) {
          this.voiceService.setSpeakerByEmotion(chunkEmotion);
        }
        
        const result = await this.voiceService.textToSpeech(chunk.text, language, chunkEmotion);
        const duration = Date.now() - start;
        console.log(`[Streaming TTS] Chunk ${chunk.index} generated in ${duration}ms with emotion: ${chunkEmotion}`);
        
        if (!result.success || !result.audioBase64) {
          throw new Error(result.error || `TTS generation failed for chunk ${chunk.index}`);
        }
        
        // Convert base64 to ArrayBuffer using Buffer to avoid stack overflow
        const audioData = new Uint8Array(Buffer.from(result.audioBase64, 'base64'));
        
        return {
          chunk: audioData.buffer,
          text: chunk.text,
          index: chunk.index,
          isLast: chunk.isLast,
          emotion: chunkEmotion
        };
      });

      // Yield results as they complete
      const results = await Promise.all(batchPromises);
      for (const result of results) {
        yield result;
      }
    }
  }

  // Process text input with streaming TTS support
  async processTextInputStreaming(input: string): Promise<{
    transcript: string;
    response: string;
    rawResponse?: string;
    audioChunks: AsyncGenerator<{
      chunk: ArrayBuffer;
      text: string;
      index: number;
      isLast: boolean;
      emotion?: string;
    }>;
    shouldUpdateCharacter: boolean;
    characterAction?: string;
    emotion?: EmotionData;
    emotionTags?: any[];
    primaryEmotion?: string;
  }> {
    const performanceSteps: Record<string, number> = {};
    
    try {
      this.conversationState = 'processing';
      
      // Generate response with emotion tags
      startPerformance('AI Response Generation');
      const rawResponse = await this.generateResponse(input);
      performanceSteps['AI Response Generation'] = endPerformance('AI Response Generation');
      
      // Parse emotion tags from response
      startPerformance('Emotion Parsing');
      const parsedResponse = EmotionTagParser.parseEmotionTags(rawResponse);
      performanceSteps['Emotion Parsing'] = endPerformance('Emotion Parsing');
      
      const cleanResponse = parsedResponse.cleanText;
      const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      
      // Create emotion data
      let emotion: EmotionData;
      if (parsedResponse.primaryEmotion) {
        emotion = {
          emotion: parsedResponse.primaryEmotion,
          intensity: parsedResponse.emotions[0]?.intensity || 0.8,
          confidence: 0.9,
          duration: 3000
        };
      } else {
        const conversationHistory = await this.getRecentConversationHistory();
        emotion = EmotionManager.detectConversationEmotion(
          input,
          cleanResponse,
          conversationHistory
        );
      }
      
      // Store emotion and conversation turn
      await this.supabaseMemory.set('currentEmotion', emotion);
      await this.supabaseMemory.set('emotionTags', parsedResponse.emotions);
      await this.storeConversationTurn(input, cleanResponse, emotion);
      
      // Determine character action
      const characterAction = this.determineCharacterAction(cleanResponse, emotion);
      
      this.conversationState = 'speaking';
      
      // Create streaming audio generator
      const audioChunks = this.generateStreamingTTSAudio(
        this.cleanTextForTTS(cleanResponse),
        language,
        emotion
      );
      
      // Log performance summary
      logPerformanceSummary(performanceSteps);
      
      return {
        transcript: input,
        response: cleanResponse,
        rawResponse,
        audioChunks,
        shouldUpdateCharacter: true,
        characterAction,
        emotion,
        emotionTags: parsedResponse.emotions,
        primaryEmotion: parsedResponse.primaryEmotion
      };
    } catch (error) {
      this.conversationState = 'idle';
      console.error('Error processing text input with streaming:', error);
      throw error;
    }
  }

  // Speech to text only method (for quick transcription)
  async speechToText(audioBuffer: ArrayBuffer, language: SupportedLanguage = 'ja'): Promise<{
    success: boolean;
    transcript?: string;
    confidence?: number;
    error?: string;
  }> {
    try {
      if (!this.voiceService) {
        return {
          success: false,
          error: 'Voice service not initialized'
        };
      }
      
      // Convert ArrayBuffer to base64 for the API using Buffer to avoid stack overflow
      const uint8Array = new Uint8Array(audioBuffer);
      const audioBase64 = Buffer.from(uint8Array).toString('base64');
      
      const result = await this.voiceService.speechToText(audioBase64, language);
      
      return {
        success: result.success,
        transcript: result.transcript,
        confidence: result.confidence,
        error: result.error
      };
    } catch (error) {
      console.error('Speech-to-text error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
