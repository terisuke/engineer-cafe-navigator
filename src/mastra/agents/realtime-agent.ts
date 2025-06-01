import { Agent } from '@mastra/core';
import { SupportedLanguage } from '../types/config';
import { SupabaseMemoryAdapter, ConversationManager } from '@/lib/supabase-memory';
import { EmotionManager, EmotionData } from '@/lib/emotion-manager';
import { EmotionTagParser } from '@/lib/emotion-tag-parser';
import { PerformanceMonitor } from '@/lib/performance-monitor';
import { TextChunker } from '@/lib/text-chunker';
import { AudioQueue, AudioQueueItem } from '@/lib/audio-queue';

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
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  async processTextInput(text: string): Promise<{
    response: string;
    rawResponse?: string;
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
      PerformanceMonitor.start('AI Response Generation (Text)');
      const rawResponse = await this.generateResponse(text);
      performanceSteps['AI Response Generation'] = PerformanceMonitor.end('AI Response Generation (Text)');
      
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
      
      // Store conversation turn with emotion
      await this.storeConversationTurn(text, cleanResponse, emotion);
      
      this.conversationState = 'speaking';
      
      const characterAction = this.determineCharacterAction(cleanResponse, emotion);
      
      // Log performance summary for text processing
      PerformanceMonitor.logSummary(performanceSteps);
      
      return {
        response: cleanResponse,
        rawResponse: rawResponse,
        shouldUpdateCharacter: true,
        characterAction,
        emotion,
        emotionTags: parsedResponse.emotions,
        primaryEmotion: parsedResponse.primaryEmotion
      };
    } catch (error) {
      this.conversationState = 'idle';
      console.error('Error processing text input:', error);
      // Log partial performance data if available
      if (Object.keys(performanceSteps).length > 0) {
        PerformanceMonitor.logSummary(performanceSteps);
      }
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
  }> {
    const performanceSteps: Record<string, number> = {};
    
    try {
      this.conversationState = 'processing';
      
      // Convert speech to text
      if (!this.voiceService) {
        throw new Error('Voice service not initialized');
      }
      PerformanceMonitor.start('Speech-to-Text');
      const transcript = await this.voiceService.speechToText(audioBuffer);
      performanceSteps['Speech-to-Text'] = PerformanceMonitor.end('Speech-to-Text');
      
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
      PerformanceMonitor.start('AI Response Generation');
      const rawResponse = await this.generateResponse(transcript);
      performanceSteps['AI Response Generation'] = PerformanceMonitor.end('AI Response Generation');
      
      // Parse emotion tags from response
      PerformanceMonitor.start('Emotion Parsing');
      const parsedResponse = EmotionTagParser.parseEmotionTags(rawResponse);
      performanceSteps['Emotion Parsing'] = PerformanceMonitor.end('Emotion Parsing');
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
          conversationHistory
        );
        console.log('Using fallback emotion detection:', emotion);
      }
      
      // Store emotion for character state
      await this.supabaseMemory.set('currentEmotion', emotion);
      await this.supabaseMemory.set('emotionTags', parsedResponse.emotions);
      
      // Store conversation turn in history
      await this.storeConversationTurn(transcript, cleanResponse, emotion);
      
      // Convert CLEAN response to speech (without emotion tags and markdown)
      PerformanceMonitor.start('Text-to-Speech');
      const cleanedForTTS = this.cleanTextForTTS(cleanResponse);
      
      // Set voice parameters based on emotion
      if (emotion && this.voiceService.setSpeakerByEmotion) {
        console.log(`[RealtimeAgent] Setting voice emotion: ${emotion.emotion}`);
        this.voiceService.setSpeakerByEmotion(emotion.emotion);
      }
      
      const audioResponse = await this.voiceService.textToSpeech(cleanedForTTS, { language });
      performanceSteps['Text-to-Speech'] = PerformanceMonitor.end('Text-to-Speech');
      
      // Determine character action based on response content and emotion
      const characterAction = this.determineCharacterAction(cleanResponse, emotion);
      
      this.conversationState = 'speaking';
      
      // Log performance summary
      PerformanceMonitor.logSummary(performanceSteps);
      
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
      // Log partial performance data if available
      if (Object.keys(performanceSteps).length > 0) {
        PerformanceMonitor.logSummary(performanceSteps);
      }
      throw error;
    }
  }

  async generateResponse(input: string): Promise<string> {
    let language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    // Auto-detect language from input if confidence is high enough
    const languageTool = this._tools.get('languageSwitch');
    if (languageTool) {
      try {
        const detection = await languageTool.execute({
          action: 'detectLanguage',
          text: input,
        });
        
        if (detection.success && detection.result.confidence >= 0.8) {
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

  private buildContextualPrompt(
    input: string, 
    language: SupportedLanguage, 
    mode: string, 
    history: any[]
  ): string {
    const systemPrompt = language === 'en'
      ? `You are assisting a visitor at Engineer Cafe. Current mode: ${mode}. 
         IMPORTANT: Respond ONLY in English. 
         
         EMOTION TAGS: You MUST include emotion tags in your response to express feelings.
         Available tags: [happy], [excited], [sad], [angry], [surprised], [relaxed], [neutral], [thoughtful]
         
         Examples:
         - "[happy] Great to see you! How can I help you today?"
         - "[excited] That's amazing! I'd love to hear more about your project!"
         - "[sad] I'm sorry to hear that you're having trouble."
         - "[surprised] Oh wow! I didn't expect that!"
         
         Use appropriate emotions based on the context. Change emotions within response when appropriate.
         Respond naturally and helpfully to their voice input in English.`
      : `エンジニアカフェの来訪者をサポートしています。現在のモード: ${mode}。
         重要: 日本語のみで応答してください。
         
         感情タグ: 応答に必ず感情タグを含めて、感情を表現してください。
         使用可能なタグ: [happy], [excited], [sad], [angry], [surprised], [relaxed], [neutral], [thoughtful]
         
         例:
         - "[happy] こんにちは！今日はどのようなお手伝いができますか？"
         - "[excited] それは素晴らしいですね！もっと詳しく聞かせてください！"
         - "[sad] お困りのようで心配です。"
         - "[surprised] えっ！それは驚きました！"
         
         文脈に応じて適切な感情を使用してください。応答内で感情が変わる場合は、適切に変更してください。
         音声入力に自然で親切に日本語で応答してください。`;

    const contextHistory = history.length > 0 
      ? `Previous conversation:\n${history.slice(-6).map(h => `${h.role}: ${h.content}`).join('\n')}\n\n`
      : '';

    return `${systemPrompt}\n\n${contextHistory}User: ${input}\nAssistant:`;
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
      // Clean markdown formatting before TTS
      const cleanedText = this.cleanTextForTTS(text);
      const audioBuffer = await this.voiceService.textToSpeech(cleanedText);
      return audioBuffer;
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
      const audioResponse = await this.voiceService.textToSpeech(text, { language });
      yield {
        chunk: audioResponse,
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
        
        const audioResponse = await this.voiceService.textToSpeech(chunk.text, { language });
        const duration = Date.now() - start;
        console.log(`[Streaming TTS] Chunk ${chunk.index} generated in ${duration}ms with emotion: ${chunkEmotion}`);
        
        return {
          chunk: audioResponse,
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
      PerformanceMonitor.start('AI Response Generation');
      const rawResponse = await this.generateResponse(input);
      performanceSteps['AI Response Generation'] = PerformanceMonitor.end('AI Response Generation');
      
      // Parse emotion tags from response
      PerformanceMonitor.start('Emotion Parsing');
      const parsedResponse = EmotionTagParser.parseEmotionTags(rawResponse);
      performanceSteps['Emotion Parsing'] = PerformanceMonitor.end('Emotion Parsing');
      
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
      PerformanceMonitor.logSummary(performanceSteps);
      
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
}
