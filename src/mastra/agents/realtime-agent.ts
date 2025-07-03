import { EmotionData, EmotionManager } from '@/lib/emotion-manager';
import { EmotionTagParser } from '@/lib/emotion-tag-parser';
import { endPerformance, logPerformanceSummary, startPerformance } from '@/lib/performance-monitor';
import { ConversationManager, SupabaseMemoryAdapter } from '@/lib/supabase-memory';
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';
import { SharedMemoryService } from '@/lib/shared-memory-service';
import { TextChunker } from '@/lib/text-chunker';
import { ClarificationUtils } from '@/lib/clarification-utils';
import { getEngineerCafeNavigator } from '@/mastra';
import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '../types/config';
import { MainQAWorkflow } from '../workflows/main-qa-workflow';
import { STTCorrection } from '@/lib/stt-correction';

/**
 * RealtimeAgent handles real-time voice interactions with contextual memory
 * Supports speech recognition, AI response generation, and text-to-speech
 */
export class RealtimeAgent extends Agent {
  /** Current conversation state for flow control */
  private conversationState: 'idle' | 'listening' | 'processing' | 'speaking' = 'idle';
  
  /** Enable/disable interruption handling */
  private interruptionEnabled: boolean = true;
  
  /** Voice service for STT/TTS operations */
  private voiceService: any;
  
  /** Legacy memory adapter (deprecated) */
  private supabaseMemory: SupabaseMemoryAdapter;
  
  /** New simplified memory system with 3-minute TTL */
  private simplifiedMemory: SimplifiedMemorySystem;
  
  /** Shared memory service for cross-agent communication */
  private sharedMemory: SharedMemoryService;
  
  /** Current active session ID */
  private currentSessionId: string | null = null;
  
  /** Tool registry for this agent */
  private _tools: Map<string, any> = new Map();
  
  /** Agent configuration */
  private config: any;
  
  /** Voice output agent for centralized TTS handling */
  private voiceOutputAgent: any;
  
  /** Character control agent for animations and lip sync */
  private characterControlAgent: any;

  /**
   * Normalize input for common speech recognition errors
   * Note: Primary corrections are now handled in GoogleCloudVoiceSimple.speechToText
   * This is kept as a secondary fallback for any missed corrections
   */
  private normalizeInput(input: string): string {
    return STTCorrection.correct(input);
  }

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
        
        Available emotion tags (5 unified emotions):
        [happy] - for joyful, excited, cheerful, greeting, positive responses
        [sad] - for disappointed, melancholy, apologetic, unavailable responses  
        [angry] - for frustrated, annoyed, prohibited responses (use sparingly)
        [relaxed] - for calm, informational, explaining, thinking responses
        [surprised] - for questioning, amazed, clarification responses
        
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
    // Use 'shared' namespace for unified memory access
    this.simplifiedMemory = new SimplifiedMemorySystem('shared');
    this.sharedMemory = config.sharedMemory;
    this.config = config;
    this.voiceOutputAgent = null; // Will be set later
    this.characterControlAgent = null; // Will be set later
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }
  
  // Method to set the voice output agent
  setVoiceOutputAgent(agent: any) {
    this.voiceOutputAgent = agent;
  }
  
  // Method to set the character control agent
  setCharacterControlAgent(agent: any) {
    this.characterControlAgent = agent;
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
    characterControlData?: any;
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
      
      // Apply STT corrections to text input
      const correctedText = this.normalizeInput(text);
      if (correctedText !== text) {
        console.log('[RealtimeAgent] STT correction applied to text input:', {
          original: text,
          corrected: correctedText
        });
      }

      // Store user message in shared memory BEFORE generating response
      // This ensures the message is available for context when QA agent processes it
      if (this.sharedMemory) {
        await this.sharedMemory.addMessage('user', correctedText, {
          agentName: 'RealtimeAgent'
        });
      }

      // Generate response with emotion tags
      startPerformance('AI Response Generation (Text)');
      const rawResponse = await this.generateResponse(correctedText);
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
        // Store in shared memory if available
        if (this.sharedMemory) {
          await this.sharedMemory.addMessage('user', text, {
            agentName: 'RealtimeAgent',
            emotion: emotion?.emotion,
            confidence: emotion?.confidence
          });
          await this.sharedMemory.addMessage('assistant', cleanResponse, {
            agentName: 'RealtimeAgent',
            emotion: emotion?.emotion,
            confidence: emotion?.confidence
          });
        }
        
        // Also store in local memory for agent-specific operations
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
        console.error('[RealtimeAgent] Failed to store in memory:', error);
        // Fallback to legacy system if memory storage fails
      }
      
      // Generate TTS audio and character control data in parallel
      startPerformance('Text-to-Speech');
      startPerformance('Character Control');
      const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      
      let audioResponse: ArrayBuffer | undefined = undefined;
      let characterControlData: any = undefined;
      
      try {
        // Process voice output and character control in parallel
        const [voiceResult, characterResult] = await Promise.all([
          // Voice output processing
          this.voiceOutputAgent ? 
            this.voiceOutputAgent.convertTextToSpeech({
              text: rawResponse, // Send raw response with emotion tags
              language,
              emotion: emotion?.emotion,
              sessionId: this.currentSessionId || undefined,
              agentName: 'RealtimeAgent'
            }) : Promise.resolve(null),
          
          // Character control processing
          this.characterControlAgent ? 
            this.characterControlAgent.processCharacterControl({
              emotion: emotion?.emotion,
              text: cleanResponse,
              intensity: emotion?.intensity || 0.8,
              agentName: 'RealtimeAgent'
            }) : Promise.resolve(null)
        ]);
        
        // Handle voice output result
        if (voiceResult?.success && voiceResult.audioData) {
          audioResponse = voiceResult.audioData;
          
          // Update character control with audio data for lip sync
          if (this.characterControlAgent && audioResponse) {
            const lipSyncResult = await this.characterControlAgent.processCharacterControl({
              emotion: emotion?.emotion,
              text: cleanResponse,
              audioData: audioResponse,
              intensity: emotion?.intensity || 0.8,
              agentName: 'RealtimeAgent'
            });
            
            if (lipSyncResult.success) {
              characterControlData = lipSyncResult;
            }
          }
        } else if (voiceResult?.error) {
          console.error('VoiceOutputAgent error:', voiceResult.error);
        }
        
        // Handle character control result
        if (characterResult?.success && !characterControlData) {
          characterControlData = characterResult;
        }
        
        // Fallback to direct TTS if VoiceOutputAgent is not available or failed
        if (!audioResponse) {
          console.warn('VoiceOutputAgent not available or failed, falling back to direct TTS');
          const cleanedForTTS = this.cleanTextForTTS(cleanResponse);
          if (emotion && this.voiceService.setSpeakerByEmotion) {
            this.voiceService.setSpeakerByEmotion(emotion.emotion);
          }
          const ttsResult = await this.voiceService.textToSpeech(cleanedForTTS, language, emotion?.emotion);
          if (ttsResult.success && ttsResult.audioBase64) {
            const audioData = Uint8Array.from(atob(ttsResult.audioBase64), c => c.charCodeAt(0));
            audioResponse = audioData.buffer;
            
            // Generate lip sync for fallback audio
            if (this.characterControlAgent && audioResponse) {
              const lipSyncResult = await this.characterControlAgent.processCharacterControl({
                emotion: emotion?.emotion,
                text: cleanResponse,
                audioData: audioResponse,
                intensity: emotion?.intensity || 0.8,
                agentName: 'RealtimeAgent'
              });
              
              if (lipSyncResult.success) {
                characterControlData = lipSyncResult;
              }
            }
          }
        }
      } catch (ttsError) {
        console.error('TTS generation failed:', ttsError);
        // Continue without audio
      }
      
      performanceSteps['Text-to-Speech'] = endPerformance('Text-to-Speech');
      performanceSteps['Character Control'] = endPerformance('Character Control');
      
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
        primaryEmotion: parsedResponse.primaryEmotion,
        characterControlData
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

  /**
   * Process voice input with full pipeline: STT → AI Response → TTS
   * Includes quality checks and clarification handling
   * 
   * @param audioBuffer Raw audio data
   * @param language Target language (ja/en)
   * @returns Complete response with audio and emotion data
   */
  async processVoiceInput(audioBuffer: ArrayBuffer, language?: SupportedLanguage): Promise<{
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
    characterControlData?: any;
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
      
      // Use the provided language or fallback to stored language or default 'ja'
      const currentLang = language || await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      
      // Update stored language if provided
      if (language) {
        await this.supabaseMemory.store('language', language);
      }
      
      const result = await this.voiceService.speechToText(audioBase64, currentLang);
      performanceSteps['Speech-to-Text'] = endPerformance('Speech-to-Text');
      
      // Apply STT corrections
      if (result.success && result.transcript) {
        const originalTranscript = result.transcript;
        result.transcript = STTCorrection.correct(result.transcript);
        
        if (originalTranscript !== result.transcript) {
          console.log('[RealtimeAgent] STT correction applied:', {
            original: originalTranscript,
            corrected: result.transcript
          });
        }
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[RealtimeAgent] STT result:', {
          success: result.success,
          transcript: result.transcript,
          confidence: result.confidence,
          error: result.error
        });
      }
      
      // Enhanced quality check for speech recognition
      const qualityCheck = this.checkSpeechQuality(result);
      
      if (!qualityCheck.isValid) {
        console.log('[RealtimeAgent] STT quality check failed:', {
          reason: qualityCheck.reason,
          confidence: qualityCheck.confidence,
          transcript: result.transcript,
          transcriptLength: result.transcript?.length || 0
        });
        
        // Generate clarification request based on the issue
        const clarificationResponse = await this.generateClarificationRequest(qualityCheck, currentLang);
        
        // Convert clarification to speech and generate character control data
        let clarificationAudio: ArrayBuffer;
        let clarificationCharacterData: any = undefined;
        
        try {
          // Process voice output and character control in parallel
          const [voiceResult, characterResult] = await Promise.all([
            // Voice output processing
            this.voiceOutputAgent ? 
              this.voiceOutputAgent.convertTextToSpeech({
                text: `[curious]${clarificationResponse}[/curious]`,
                language: currentLang,
                emotion: 'curious',
                sessionId: this.currentSessionId || undefined,
                agentName: 'RealtimeAgent'
              }) : Promise.resolve(null),
            
            // Character control processing
            this.characterControlAgent ? 
              this.characterControlAgent.processCharacterControl({
                emotion: 'curious',
                text: clarificationResponse,
                intensity: 0.8,
                agentName: 'RealtimeAgent'
              }) : Promise.resolve(null)
          ]);
          
          // Handle voice output result
          if (voiceResult?.success && voiceResult.audioData) {
            clarificationAudio = voiceResult.audioData;
            
            // Update character control with audio data for lip sync
            if (this.characterControlAgent) {
              const lipSyncResult = await this.characterControlAgent.processCharacterControl({
                emotion: 'curious',
                text: clarificationResponse,
                audioData: clarificationAudio,
                intensity: 0.8,
                agentName: 'RealtimeAgent'
              });
              
              if (lipSyncResult.success) {
                clarificationCharacterData = lipSyncResult;
              }
            }
          } else {
            console.warn('[RealtimeAgent] VoiceOutputAgent failed for clarification:', voiceResult?.error);
            
            // Fallback to direct TTS
            const ttsResult = await this.voiceService.textToSpeech(clarificationResponse, currentLang);
            if (ttsResult.success && ttsResult.audioBuffer && ttsResult.audioBuffer instanceof ArrayBuffer) {
              clarificationAudio = ttsResult.audioBuffer;
            } else if (ttsResult.success && ttsResult.audioBase64) {
              const audioData = Uint8Array.from(atob(ttsResult.audioBase64), c => c.charCodeAt(0));
              clarificationAudio = audioData.buffer;
            } else {
              console.warn('[RealtimeAgent] TTS for clarification succeeded but no valid audio data:', ttsResult);
              clarificationAudio = new ArrayBuffer(0);
            }
            
            // Generate lip sync for fallback audio
            if (this.characterControlAgent && clarificationAudio.byteLength > 0) {
              const lipSyncResult = await this.characterControlAgent.processCharacterControl({
                emotion: 'curious',
                text: clarificationResponse,
                audioData: clarificationAudio,
                intensity: 0.8,
                agentName: 'RealtimeAgent'
              });
              
              if (lipSyncResult.success) {
                clarificationCharacterData = lipSyncResult;
              }
            }
          }
          
          // Handle character control result
          if (characterResult?.success && !clarificationCharacterData) {
            clarificationCharacterData = characterResult;
          }
          
        } catch (error) {
          console.error('[RealtimeAgent] TTS failed for clarification:', error);
          clarificationAudio = new ArrayBuffer(0);
        }
        
        this.conversationState = 'idle';
        return {
          transcript: result.transcript || '',
          response: clarificationResponse,
          audioResponse: clarificationAudio,
          shouldUpdateCharacter: true,
          characterAction: 'thinking',
          emotion: {
            emotion: 'curious',
            intensity: 0.8,
            confidence: 0.9,
            duration: 3000
          },
          primaryEmotion: 'curious',
          characterControlData: clarificationCharacterData
        };
      }
      
      const transcript = result.transcript;

      // Store user message in shared memory BEFORE generating response
      // This ensures the message is available for context when QA agent processes it
      if (this.sharedMemory) {
        await this.sharedMemory.addMessage('user', transcript, {
          agentName: 'RealtimeAgent'
        });
      }

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
      
      // Convert response to speech and generate character control data in parallel
      startPerformance('Text-to-Speech');
      startPerformance('Character Control');
      
      let audioResponse: ArrayBuffer | undefined = undefined;
      let characterControlData: any = undefined;
      
      try {
        // Process voice output and character control in parallel
        const [voiceResult, characterResult] = await Promise.all([
          // Voice output processing
          this.voiceOutputAgent ? 
            this.voiceOutputAgent.convertTextToSpeech({
              text: rawResponse, // Send raw response with emotion tags
              language: currentLang,
              emotion: emotion?.emotion,
              sessionId: this.currentSessionId || undefined,
              agentName: 'RealtimeAgent'
            }) : Promise.resolve(null),
          
          // Character control processing
          this.characterControlAgent ? 
            this.characterControlAgent.processCharacterControl({
              emotion: emotion?.emotion,
              text: cleanResponse,
              intensity: emotion?.intensity || 0.8,
              agentName: 'RealtimeAgent'
            }) : Promise.resolve(null)
        ]);
        
        // Handle voice output result
        if (voiceResult?.success && voiceResult.audioData) {
          audioResponse = voiceResult.audioData;
          
          // Update character control with audio data for lip sync
          if (this.characterControlAgent) {
            const lipSyncResult = await this.characterControlAgent.processCharacterControl({
              emotion: emotion?.emotion,
              text: cleanResponse,
              audioData: audioResponse,
              intensity: emotion?.intensity || 0.8,
              agentName: 'RealtimeAgent'
            });
            
            if (lipSyncResult.success) {
              characterControlData = lipSyncResult;
            }
          }
        } else if (voiceResult?.error) {
          throw new Error(voiceResult.error || 'VoiceOutputAgent failed to generate audio');
        } else if (!this.voiceOutputAgent) {
          // No voice output agent, will use fallback below
        } else {
          throw new Error('VoiceOutputAgent failed to generate audio');
        }
        
        // Handle character control result
        if (characterResult?.success && !characterControlData) {
          characterControlData = characterResult;
        }
        
        // Fallback to direct TTS if VoiceOutputAgent is not available
        if (!audioResponse && !this.voiceOutputAgent) {
          console.warn('[RealtimeAgent] VoiceOutputAgent not available, using direct TTS');
          let cleanedForTTS = this.cleanTextForTTS(cleanResponse);
          
          // Check if text is too long for TTS (5000 bytes limit)
          const textByteLength = new TextEncoder().encode(cleanedForTTS).length;
          if (textByteLength > 4500) {
            console.warn(`[RealtimeAgent] Text too long for TTS: ${textByteLength} bytes. Truncating...`);
            
            const sentences = cleanedForTTS.split(/[。．！？\n]/);
            let truncatedText = '';
            let currentByteLength = 0;
            
            for (const sentence of sentences) {
              const sentenceBytes = new TextEncoder().encode(sentence + '。').length;
              if (currentByteLength + sentenceBytes > 4000) {
                break;
              }
              truncatedText += sentence + '。';
              currentByteLength += sentenceBytes;
            }
            
            cleanedForTTS = truncatedText + '...' + (currentLang === 'ja' ? '（詳細は省略されました）' : '(details omitted)');
          }
          
          if (emotion && this.voiceService.setSpeakerByEmotion) {
            this.voiceService.setSpeakerByEmotion(emotion.emotion);
          }
          
          const ttsResult = await this.voiceService.textToSpeech(cleanedForTTS, currentLang, emotion?.emotion);
          
          if (!ttsResult.success || !ttsResult.audioBase64) {
            throw new Error(ttsResult.error || 'TTS generation failed');
          }
          
          const audioData = Uint8Array.from(atob(ttsResult.audioBase64), c => c.charCodeAt(0));
          audioResponse = audioData.buffer;
          
          // Generate lip sync for fallback audio
          if (this.characterControlAgent) {
            const lipSyncResult = await this.characterControlAgent.processCharacterControl({
              emotion: emotion?.emotion,
              text: cleanResponse,
              audioData: audioResponse,
              intensity: emotion?.intensity || 0.8,
              agentName: 'RealtimeAgent'
            });
            
            if (lipSyncResult.success) {
              characterControlData = lipSyncResult;
            }
          }
        }
        
        // Ensure we have audio data before proceeding
        if (!audioResponse) {
          throw new Error('Failed to generate audio response');
        }
      } catch (ttsError) {
        console.error('[RealtimeAgent] TTS generation failed:', ttsError);
        throw ttsError;
      }
      
      performanceSteps['Text-to-Speech'] = endPerformance('Text-to-Speech');
      performanceSteps['Character Control'] = endPerformance('Character Control');
      
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
        characterControlData
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
      const qaAgent = navigator.getAgent('qa') as MainQAWorkflow | undefined;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[RealtimeAgent] QA agent available:', !!qaAgent);
      }
      
      if (qaAgent?.processQuestion) {
        // Normalize input for common speech recognition errors
        const normalizedInput = this.normalizeInput(input);
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[RealtimeAgent] Calling QA agent with input:', normalizedInput, 'language:', language);
          if (normalizedInput !== input) {
            console.log('[RealtimeAgent] Input normalized from:', input, 'to:', normalizedInput);
          }
        }
        const qaResult = await qaAgent.processQuestion(normalizedInput, this.currentSessionId || '', language);
        const qaAnswer: string = qaResult.answer;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[RealtimeAgent] QA agent response:', qaAnswer ? qaAnswer.substring(0, 200) + '...' : 'null/empty');
        }
        
        if (qaAnswer && qaAnswer.trim()) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[RealtimeAgent] Using QA agent response');
          }
          
          // Ensure emotion tag is present using EmotionTagger
          const { EmotionTagger } = await import('@/lib/emotion-tagger');
          
          // Check if emotion tag already exists
          const hasEmotionTag = /^\[[a-zA-Z_]+(?::\d*\.?\d+)?\]/.test(qaAnswer.trim());
          
          if (!hasEmotionTag) {
            // Determine appropriate emotion
            let emotion: 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';
            
            if (ClarificationUtils.isClarificationMessage(qaAnswer)) {
              emotion = 'surprised';
            } else {
              emotion = EmotionTagger.detectEmotion(qaAnswer);
            }
            
            return EmotionTagger.addEmotionTag(qaAnswer, emotion);
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
    
    // Normalize input for speech recognition errors before memory operations
    const normalizedInput = this.normalizeInput(input);
    
    // Get comprehensive context using SimplifiedMemorySystem
    const memoryContext = await this.simplifiedMemory.getContext(normalizedInput, {
      includeKnowledgeBase: true,
      language: language as 'ja' | 'en'
    });
    
    // Check if conversation is still active
    const isActiveConversation = await this.simplifiedMemory.isConversationActive();
    
    // Build context-aware prompt with comprehensive memory
    const prompt = this.buildContextualPrompt(normalizedInput, language, memoryContext, isActiveConversation);
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    const responseText = response.text;
    
    // Parse emotion from response for context
    const parsedResponse = EmotionTagParser.parseEmotionTags(responseText);
    const primaryEmotion = parsedResponse.emotions?.[0]?.emotion || 'neutral';
    
    // Store conversation in SimplifiedMemorySystem (use original input for accurate conversation history)
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

  /**
   * Check speech recognition quality and detect issues
   * Prevents responding to unclear or invalid input
   * 
   * @param result STT result with transcript and confidence
   * @returns Quality assessment with validation details
   */
  private checkSpeechQuality(result: any): { isValid: boolean; reason?: string; confidence?: number } {
    // Basic validation
    if (!result.success || !result.transcript || !result.transcript.trim()) {
      return { 
        isValid: false, 
        reason: 'no_transcript',
        confidence: 0 
      };
    }
    
    const transcript = result.transcript.trim();
    const confidence = result.confidence || 0;
    
    // Confidence threshold check
    if (confidence < 0.6) {
      return { 
        isValid: false, 
        reason: 'low_confidence',
        confidence 
      };
    }
    
    // Length check - very short transcripts might be noise
    if (transcript.length < 2) {
      return { 
        isValid: false, 
        reason: 'too_short',
        confidence 
      };
    }
    
    // Check for common STT errors or gibberish
    const gibberishPatterns = [
      /^[a-z]$/, // Single letter
      /^(uh|um|hmm|ah|eh)$/i, // Filler words only
      /^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/, // Only punctuation/symbols (excluding Japanese characters)
      /(.)\1{4,}/, // Repeated characters (aaaaa)
    ];
    
    if (gibberishPatterns.some(pattern => pattern.test(transcript))) {
      return { 
        isValid: false, 
        reason: 'gibberish',
        confidence 
      };
    }
    
    // Check for unclear speech patterns
    const unclearPatterns = [
      /^(what|what\?|pardon|sorry|excuse me)$/i,
      /^(なん|何|えっ|すみません)$/,
    ];
    
    if (unclearPatterns.some(pattern => pattern.test(transcript))) {
      return { 
        isValid: false, 
        reason: 'user_unclear',
        confidence 
      };
    }
    
    return { 
      isValid: true, 
      confidence 
    };
  }

  private async generateClarificationRequest(qualityCheck: any, language: SupportedLanguage): Promise<string> {
    const reason = qualityCheck.reason;
    
    let clarification: string;
    
    switch (reason) {
      case 'no_transcript':
      case 'too_short':
      case 'gibberish':
        clarification = language === 'en'
          ? "I'm sorry, I didn't catch that clearly. Could you please repeat what you said?"
          : "すみません、よく聞き取れませんでした。もう一度お話しいただけますか？";
        break;
        
      case 'low_confidence':
        clarification = language === 'en'
          ? "I think I heard something, but I'm not quite sure. Could you please speak a bit more clearly?"
          : "少し聞こえましたが、はっきりしませんでした。もう少しはっきりお話しいただけますか？";
        break;
        
      case 'user_unclear':
        clarification = language === 'en'
          ? "No problem! Please take your time and let me know what you'd like to ask."
          : "大丈夫です！ゆっくりで構いませんので、何をお聞きになりたいか教えてください。";
        break;
        
      default:
        clarification = language === 'en'
          ? "I'm sorry, could you please repeat that?"
          : "すみません、もう一度お願いします。";
    }
    
    return clarification;
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
    memoryContext: any,
    isActiveConversation?: boolean
  ): string {
    // Check for history-related questions
    const isHistoryQuestion = /history|歴史|background|started|founded|established|開設|設立|始まり|創立/i.test(input);
    
    let systemPrompt = language === 'en'
      ? `You're an Engineer Cafe assistant. Use the provided conversation history and knowledge base to give contextual responses. 
         Respond briefly in English with emotion tags: [happy], [sad], [angry], [relaxed], [surprised]. 
         Example: "[happy] How can I help?" Keep responses short and natural.`
      : `エンジニアカフェのアシスタントです。提供された会話履歴と知識ベースを使用して文脈のある回答をしてください。
         感情タグ付きで簡潔に日本語で応答: [happy], [sad], [angry], [relaxed], [surprised]
         例: "[happy] いかがお手伝いしましょうか？" 短く自然に答えてください。`;

    // Add specific context for history questions
    if (isHistoryQuestion) {
      const historyContext = language === 'en'
        ? `\n\nEngineer Cafe is a public coworking space for IT engineers operated by Fukuoka City. It was established to support the local tech community by providing free workspace, meeting rooms, and networking opportunities. The facility is located in Tenjin, Fukuoka and serves as a hub for engineers and tech professionals.`
        : `\n\nエンジニアカフェは、福岡市が運営するITエンジニア向けの公共コワーキングスペースです。地域のテックコミュニティを支援するため、無料のワークスペース、会議室、ネットワーキングの機会を提供することを目的として設立されました。福岡天神に位置し、エンジニアや技術者のハブとして機能しています。`;
      
      systemPrompt += historyContext;
    }

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
    if (this.sharedMemory) {
      this.sharedMemory.setSessionId(this.currentSessionId);
      this.sharedMemory.setLanguage(language);
    }
    return this.currentSessionId;
  }

  async endSession(): Promise<void> {
    if (this.currentSessionId) {
      await ConversationManager.endSession(this.currentSessionId);
      await this.supabaseMemory.delete('currentSessionId');
      this.currentSessionId = null;
      if (this.sharedMemory) {
        this.sharedMemory.setSessionId(null);
      }
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Set the current language for this agent
   * Updates both memory systems and voice service
   */
  async setLanguage(language: 'ja' | 'en'): Promise<void> {
    // Store in legacy memory system
    await this.supabaseMemory.store('language', language);
    
    // Also store in simplified memory system for consistency
    await this.supabaseMemory.store('currentLanguage', language);
    
    // Update voice service language
    if (this.voiceService) {
      this.voiceService.setLanguage(language);
    }
    
    console.log(`[RealtimeAgent] Language set to: ${language}`);
  }

  async generateTTSAudio(text: string): Promise<ArrayBuffer> {
    try {
      const currentLang = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      
      if (this.voiceOutputAgent) {
        // Use VoiceOutputAgent for TTS
        const voiceResult = await this.voiceOutputAgent.convertTextToSpeech({
          text, // Let VoiceOutputAgent handle cleaning
          language: currentLang,
          sessionId: this.currentSessionId || undefined,
          agentName: 'RealtimeAgent'
        });
        
        if (voiceResult.success && voiceResult.audioData) {
          return voiceResult.audioData;
        } else {
          throw new Error(voiceResult.error || 'VoiceOutputAgent failed to generate audio');
        }
      } else if (this.voiceService) {
        // Fallback to direct voice service
        console.warn('[RealtimeAgent] VoiceOutputAgent not available, using direct TTS');
        const cleanedText = this.cleanTextForTTS(text);
        const result = await this.voiceService.textToSpeech(cleanedText, currentLang);
        
        if (!result.success || !result.audioBase64) {
          throw new Error(result.error || 'TTS generation failed');
        }
        
        const audioData = Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0));
        return audioData.buffer;
      } else {
        throw new Error('No voice service available');
      }
    } catch (error) {
      console.error('Error generating TTS audio:', error);
      throw error;
    }
  }

  // Generate streaming audio response with character control (returns chunks for immediate playback)
  async *generateStreamingTTSAudioWithCharacterControl(
    text: string, 
    language: SupportedLanguage = 'ja',
    emotion?: EmotionData
  ): AsyncGenerator<{
    chunk: ArrayBuffer;
    text: string;
    index: number;
    isLast: boolean;
    emotion?: string;
    characterControlData?: any;
  }> {
    // Check if text needs chunking
    if (!TextChunker.needsChunking(text)) {
      // For short text, just return single chunk
      let audioData: ArrayBuffer;
      
      if (this.voiceOutputAgent) {
        const voiceResult = await this.voiceOutputAgent.convertTextToSpeech({
          text,
          language,
          emotion: emotion?.emotion,
          sessionId: this.currentSessionId || undefined,
          agentName: 'RealtimeAgent'
        });
        
        if (voiceResult.success && voiceResult.audioData) {
          audioData = voiceResult.audioData;
        } else {
          throw new Error(voiceResult.error || 'VoiceOutputAgent failed to generate audio');
        }
      } else if (this.voiceService) {
        // Fallback to direct voice service
        console.warn('[RealtimeAgent] VoiceOutputAgent not available for streaming, using direct TTS');
        if (emotion && this.voiceService.setSpeakerByEmotion) {
          this.voiceService.setSpeakerByEmotion(emotion.emotion);
        }
        const result = await this.voiceService.textToSpeech(text, language);
        if (!result.success || !result.audioBase64) {
          throw new Error(result.error || 'TTS generation failed');
        }
        const audioArray = Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0));
        audioData = audioArray.buffer;
      } else {
        throw new Error('No voice service available');
      }
      
      // Generate character control data for single chunk
      let characterControlData: any = undefined;
      if (this.characterControlAgent) {
        try {
          const characterResult = await this.characterControlAgent.processCharacterControl({
            emotion: emotion?.emotion,
            text,
            audioData,
            intensity: emotion?.intensity || 0.8,
            agentName: 'RealtimeAgent'
          });
          
          if (characterResult.success) {
            characterControlData = characterResult;
          }
        } catch (error) {
          console.error('[RealtimeAgent] Character control failed for single chunk:', error);
        }
      }
      
      yield {
        chunk: audioData,
        text,
        index: 0,
        isLast: true,
        emotion: emotion?.emotion,
        characterControlData
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
        
        let audioData: ArrayBuffer;
        
        if (this.voiceOutputAgent) {
          const voiceResult = await this.voiceOutputAgent.convertTextToSpeech({
            text: chunk.text,
            language,
            emotion: chunkEmotion,
            sessionId: this.currentSessionId || undefined,
            agentName: 'RealtimeAgent'
          });
          
          if (voiceResult.success && voiceResult.audioData) {
            audioData = voiceResult.audioData;
          } else {
            throw new Error(voiceResult.error || `VoiceOutputAgent failed for chunk ${chunk.index}`);
          }
        } else if (this.voiceService) {
          // Fallback to direct voice service
          if (chunkEmotion && this.voiceService.setSpeakerByEmotion) {
            this.voiceService.setSpeakerByEmotion(chunkEmotion);
          }
          
          const result = await this.voiceService.textToSpeech(chunk.text, language, chunkEmotion);
          if (!result.success || !result.audioBase64) {
            throw new Error(result.error || `TTS generation failed for chunk ${chunk.index}`);
          }
          
          const audioArray = new Uint8Array(Buffer.from(result.audioBase64, 'base64'));
          audioData = audioArray.buffer;
        } else {
          throw new Error('No voice service available');
        }
        
        const duration = Date.now() - start;
        console.log(`[Streaming TTS] Chunk ${chunk.index} generated in ${duration}ms with emotion: ${chunkEmotion}`);
        
        // Generate character control data for this chunk
        let characterControlData: any = undefined;
        if (this.characterControlAgent) {
          try {
            const characterResult = await this.characterControlAgent.processCharacterControl({
              emotion: chunkEmotion,
              text: chunk.text,
              audioData,
              intensity: emotion?.intensity || 0.8,
              agentName: 'RealtimeAgent'
            });
            
            if (characterResult.success) {
              characterControlData = characterResult;
            }
          } catch (error) {
            console.error(`[RealtimeAgent] Character control failed for chunk ${chunk.index}:`, error);
          }
        }
        
        return {
          chunk: audioData,
          text: chunk.text,
          index: chunk.index,
          isLast: chunk.isLast,
          emotion: chunkEmotion,
          characterControlData
        };
      });

      // Yield results as they complete
      const results = await Promise.all(batchPromises);
      for (const result of results) {
        yield result;
      }
    }
  }

  // Generate streaming audio response (returns chunks for immediate playback) - for backwards compatibility
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
    // Delegate to the enhanced version and strip out character control data
    for await (const chunk of this.generateStreamingTTSAudioWithCharacterControl(text, language, emotion)) {
      yield {
        chunk: chunk.chunk,
        text: chunk.text,
        index: chunk.index,
        isLast: chunk.isLast,
        emotion: chunk.emotion
      };
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
      characterControlData?: any;
    }>;
    shouldUpdateCharacter: boolean;
    characterAction?: string;
    emotion?: EmotionData;
    emotionTags?: any[];
    primaryEmotion?: string;
    characterControlData?: any;
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
      
      // Create streaming audio generator with character control
      const audioChunks = this.generateStreamingTTSAudioWithCharacterControl(
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
        primaryEmotion: parsedResponse.primaryEmotion,
        characterControlData: undefined // Will be provided in streaming chunks
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
      
      // Apply STT corrections
      if (result.success && result.transcript) {
        const originalTranscript = result.transcript;
        result.transcript = STTCorrection.correct(result.transcript);
        
        if (originalTranscript !== result.transcript) {
          console.log('[RealtimeAgent] STT correction applied:', {
            original: originalTranscript,
            corrected: result.transcript
          });
        }
      }
      
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
