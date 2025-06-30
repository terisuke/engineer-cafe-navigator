import { Agent } from '@mastra/core/agent';
import { EmotionTagParser } from '../../lib/emotion-tag-parser';
import { ragSearchTool } from '../tools/rag-search';
import { GeneralWebSearchTool } from '../tools/general-web-search';
import { SupportedLanguage } from '../types/config';
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';
import { ClarificationUtils } from '@/lib/clarification-utils';
import { applySttCorrections } from '@/utils/stt-corrections';

export class EnhancedQAAgent extends Agent {
  private memory: any;
  private simplifiedMemory: SimplifiedMemorySystem;
  private _tools: Map<string, any> = new Map();

  constructor(config: any) {
    super({
      name: 'EnhancedQAAgent',
      model: config.llm.model,
      instructions: `You are a knowledgeable Q&A agent for Engineer Cafe in Fukuoka. 
        Use the provided conversation history and knowledge base to give contextual responses.
        Answer questions concisely and directly. Keep responses brief - typically 1-2 sentences.
        Only provide the specific information requested. Avoid unnecessary details.
        Reference previous conversation when relevant to show memory of the interaction.`,
    });
    this.memory = config.memory || new Map();
    // Set default language explicitly
    if (!this.memory.has('language')) {
      this.memory.set('language', 'ja');
    }
    this.simplifiedMemory = new SimplifiedMemorySystem('EnhancedQAAgent');
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  /**
   * Set language for this agent
   * Updates memory to maintain consistency
   */
  async setLanguage(language: SupportedLanguage) {
    // Store language preference in memory for this agent
    this.memory.set('language', language);
    console.log(`[EnhancedQAAgent] Language set to: ${language}`);
  }

  async answerQuestion(question: string, requestLanguage?: SupportedLanguage, sessionId?: string): Promise<string> {
    // Use the provided language or fall back to memory/default
    const language: SupportedLanguage = requestLanguage || this.memory.get('language') || 'ja';
    
    // Update memory with the current language to keep it synchronized
    if (requestLanguage) {
      this.memory.set('language', requestLanguage);
    }
    
    // Get conversation context first
    console.log(`[EnhancedQAAgent] Getting memory context for question: "${question}", language: ${language}`);
    const memoryContext = await this.simplifiedMemory.getContext(question, {
      includeKnowledgeBase: false, // We'll handle knowledge search separately
      language: language
    });
    console.log(`[EnhancedQAAgent] Memory context result:`, {
      recentMessagesCount: memoryContext.recentMessages.length,
      hasContext: !!memoryContext.contextString,
      firstMessage: memoryContext.recentMessages[0]
    });
    
    // Check if this is a contextual follow-up to a previous specific request
    const previousSpecificRequest = this.extractPreviousSpecificRequest(memoryContext.recentMessages);
    console.log('[EnhancedQAAgent] Previous specific request:', previousSpecificRequest);
    
    // Check if the question is about calendar/events or facility information
    const category = await this.categorizeQuestion(question);
    console.log('[EnhancedQAAgent] Question:', question);
    console.log('[EnhancedQAAgent] Detected category:', category);
    console.log('[EnhancedQAAgent] Memory context available:', memoryContext.recentMessages.length > 0);
    
    let context = '';
    let isContextual = false; // Declare at top level
    
    // Use appropriate tool based on category
    if (category === 'calendar' || category === 'events') {
      console.log('[EnhancedQAAgent] Using Calendar context');
      context = await this.getCalendarContext(question);
    } else if (category === 'facility-info') {
      console.log('[EnhancedQAAgent] Using RAG search for facility info');
      context = await this.searchKnowledgeBase(question);
      
      // Check if the result is a clarification message (starts with [curious])
      if (context.startsWith('[curious]')) {
        return context;
      }
    } else {
      // Check if this is a contextual response (answering a clarification)
      isContextual = await this.isContextualResponse(question);
      
      if (isContextual) {
        console.log('[EnhancedQAAgent] Contextual response detected - combining with knowledge search');
        // For contextual responses, use conversation history AND search for relevant info
        
        // Try to understand the original question from conversation history
        const originalQuestion = this.extractOriginalQuestionFromContext(memoryContext.recentMessages, question);
        console.log('[EnhancedQAAgent] Extracted original question:', originalQuestion);
        
        if (originalQuestion) {
          // Search knowledge base for the original question + clarification
          const combinedQuery = `${originalQuestion} ${question}`;
          context = await this.searchKnowledgeBase(combinedQuery, language);
          
          // If no specific results, use conversation history
          if (!context || context.startsWith('申し訳ございません') || context.startsWith('I couldn\'t find')) {
            context = memoryContext.recentMessages.length > 0 
              ? 'Recent conversation history is available' 
              : 'No recent conversation history available';
          }
        } else {
          context = memoryContext.recentMessages.length > 0 
            ? 'Recent conversation history is available' 
            : 'No recent conversation history available';
        }
      } else if (this.isMemoryRelatedQuestion(question)) {
        console.log('[EnhancedQAAgent] Memory-related question detected');
        // For memory questions, the context comes from conversation history
        context = memoryContext.recentMessages.length > 0 
          ? 'Recent conversation history is available' 
          : 'No recent conversation history available';
      } else if (GeneralWebSearchTool.shouldUseWebSearch(question, category)) {
        console.log('[EnhancedQAAgent] Using web search for general query');
        context = await this.performWebSearch(question);
      } else {
        // Default to RAG search
        console.log('[EnhancedQAAgent] Using RAG search');
        context = await this.searchKnowledgeBase(question, language);
        
        // Check if the result is a clarification message (contains question patterns)
        if (ClarificationUtils.isClarificationMessage(context)) {
          return context;
        }
        
        // If RAG search returns irrelevant results, fallback to web search
        if (await this.isIrrelevantResult(context, question)) {
          console.log('[EnhancedQAAgent] RAG result irrelevant, falling back to web search');
          context = await this.performWebSearch(question);
        }
      }
    }
    
    // Build prompt with memory context
    const conversationContext = memoryContext.contextString || '';
    const fullContext = conversationContext ? `${conversationContext}\n\n参考情報: ${context}` : context;
    
    // Special handling for memory-related questions and contextual responses
    const isMemoryQuestion = this.isMemoryRelatedQuestion(question);
    // isContextual is already declared in the context building logic above
    const isSpecificRequest = this.detectSpecificRequest(question, previousSpecificRequest);
    
    // Debug logging
    console.log('[EnhancedQAAgent] Building prompt with:', {
      isContextual,
      isMemoryQuestion,
      previousSpecificRequest,
      isSpecificRequest,
      hasConversationContext: !!conversationContext,
      recentMessagesCount: memoryContext.recentMessages.length
    });
    
    let prompt;
    
    if (isMemoryQuestion || isContextual) {
      if (isContextual) {
        // For contextual responses, understand the original question from conversation history
        // Extract the specific request type from the previous conversation
        const originalSpecificRequest = this.extractPreviousSpecificRequest(memoryContext.recentMessages);
        
        if (originalSpecificRequest) {
          // Get the specific information type that was requested
          const requestTypePrompt = originalSpecificRequest === 'hours' 
            ? (language === 'en' ? 'operating hours' : '営業時間')
            : originalSpecificRequest === 'price'
            ? (language === 'en' ? 'pricing information' : '料金情報')
            : originalSpecificRequest === 'location'
            ? (language === 'en' ? 'location information' : '場所情報')
            : originalSpecificRequest === 'booking'
            ? (language === 'en' ? 'reservation/booking information' : '予約情報')
            : originalSpecificRequest === 'facility'
            ? (language === 'en' ? 'facility/equipment information' : '設備情報')
            : originalSpecificRequest === 'access'
            ? (language === 'en' ? 'access/directions' : 'アクセス方法')
            : (language === 'en' ? 'requested information' : '要求された情報');
          
          // Use a focused prompt that specifically asks for the original request type
          prompt = language === 'en'
            ? `The user originally asked about ${requestTypePrompt} and is now clarifying which place they meant. Give ONLY the ${requestTypePrompt} for: ${question}\nContext: ${fullContext}\n\nIMPORTANT: Answer with ONLY the ${requestTypePrompt}. Do not include any other information about the place. Maximum 1 sentence.`
            : `ユーザーは最初に${requestTypePrompt}について尋ね、今どの場所について聞いているか明確にしています。次の場所の${requestTypePrompt}のみを答えてください: ${question}\n文脈: ${fullContext}\n\n重要：${requestTypePrompt}のみを答えてください。その場所の他の情報は含めないでください。最大1文。`;
        } else {
          // Fallback to general contextual response if no specific request was found
          prompt = language === 'en'
            ? `The user is responding to a clarification question. Look at the conversation history to understand what they originally asked, then provide ONLY the specific information they originally requested: ${question}\nConversation History: ${conversationContext}\nContext: ${fullContext}\n\nIMPORTANT: Focus only on answering their original question. Do not provide general information about the place.`
            : `ユーザーは明確化の質問に答えています。会話履歴から元の質問を理解し、最初に要求された特定の情報のみを提供してください: ${question}\n会話履歴: ${conversationContext}\n文脈: ${fullContext}\n\n重要：元の質問に答えることだけに焦点を当ててください。その場所の一般的な情報は提供しないでください。`;
        }
      } else {
        // Standard memory question handling
        prompt = language === 'en'
          ? `The user is asking about previous conversation. Use the conversation history to answer: ${question}\nConversation History: ${conversationContext}\nIf there is recent conversation history, reference what was discussed. If not, explain that you don't have previous conversation context.`
          : `ユーザーは過去の会話について質問しています。会話履歴を使って答えてください: ${question}\n会話履歴: ${conversationContext}\n最近の会話履歴がある場合は、何について話したかを参照してください。ない場合は、過去の会話の文脈がないことを説明してください。`;
      }
    } else {
      // Standard question handling - with enhanced filtering for specific requests
      const isSpecificRequest = this.detectSpecificRequest(question, previousSpecificRequest);
      
      if (isSpecificRequest) {
        // Check if it's a follow-up question
        const isFollowUp = question.includes('じゃ') || question.includes('では') || 
                          question.includes('の方は') || question.includes('then') || 
                          question.includes('how about');
        
        if (isFollowUp && previousSpecificRequest) {
          // If following up with a previous specific request (e.g., hours), focus on that
          const requestTypePrompt = previousSpecificRequest === 'hours' 
            ? (language === 'en' ? 'operating hours' : '営業時間')
            : previousSpecificRequest === 'price'
            ? (language === 'en' ? 'pricing information' : '料金情報')
            : previousSpecificRequest === 'location'
            ? (language === 'en' ? 'location information' : '場所情報')
            : previousSpecificRequest === 'booking'
            ? (language === 'en' ? 'reservation/booking information' : '予約情報')
            : previousSpecificRequest === 'facility'
            ? (language === 'en' ? 'facility/equipment information' : '設備情報')
            : previousSpecificRequest === 'access'
            ? (language === 'en' ? 'access/directions' : 'アクセス方法')
            : (language === 'en' ? 'requested information' : '要求された情報');
            
          prompt = language === 'en'
            ? `The user previously asked about ${requestTypePrompt} and is now asking about a specific option. Give ONLY the ${requestTypePrompt} for what they're asking about: ${question}\nContext: ${fullContext}\n\nIMPORTANT: Answer with ONLY the ${requestTypePrompt}. Do not include any other information. Maximum 1 sentence. Speak naturally in conversational tone, not like reading a table or list. Do NOT include any tags, titles, or labels in square brackets like [Tag Name].`
            : `ユーザーは以前${requestTypePrompt}について尋ね、今は特定の選択肢について聞いています。聞かれているものの${requestTypePrompt}のみを答えてください: ${question}\n文脈: ${fullContext}\n\n重要：${requestTypePrompt}のみを答えてください。他の情報は含めないでください。最大1文。表や箇条書きを読み上げるのではなく、自然な会話調で答えてください。[タグ名]のような角括弧付きのタグ、タイトル、ラベルを含めないでください。`;
        } else if (isFollowUp) {
          prompt = language === 'en'
            ? `The user is asking a follow-up question about another option. Give a brief, direct answer focusing only on what they asked about: ${question}\nContext: ${fullContext}\n\nIMPORTANT: Keep your response extremely brief (1 sentence). Only state the key information they need. Do NOT include any tags, titles, or labels in square brackets like [Tag Name].`
            : `ユーザーは別の選択肢についてフォローアップの質問をしています。聞かれたことだけに焦点を当てて、簡潔で直接的な答えを提供してください: ${question}\n文脈: ${fullContext}\n\n重要：極めて簡潔に（1文で）回答してください。必要な主要情報のみを述べてください。[タグ名]のような角括弧付きのタグ、タイトル、ラベルを含めないでください。`;
        } else {
          prompt = language === 'en'
            ? `Extract ONLY the specific information requested from the knowledge provided. Ignore unrelated information even if it's in the same document: ${question}\nContext: ${fullContext}\n\nIMPORTANT: Answer ONLY what was asked. Do not include additional details, explanations, or unrelated information. Keep response to 1 sentence maximum. Convert lists or tables into natural conversational language. Do not use markdown formatting or bullet points. Do NOT include any tags, titles, or labels in square brackets like [Tag Name].`
            : `提供された知識から、質問された特定の情報のみを抽出してください。同じ文書内にあっても関連のない情報は無視してください: ${question}\n文脈: ${fullContext}\n\n重要：質問されたことのみに答えてください。追加の詳細、説明、関連のない情報は含めないでください。回答は最大1文にしてください。リストや表は自然な会話調の言葉に変換してください。マークダウン形式や箇条書きは使用しないでください。[タグ名]のような角括弧付きのタグ、タイトル、ラベルを含めないでください。`;
        }
      } else {
        prompt = language === 'en'
          ? `Answer the question using the conversation history and knowledge provided. Reference previous conversation when relevant: ${question}\nContext: ${fullContext}\nProvide ONLY the requested information. Keep it to 1-2 sentences maximum. Use natural conversational language, not lists or formal documentation style. Do NOT include any tags, titles, or labels in square brackets like [Tag Name].`
          : `会話履歴と提供された知識を使って質問に答えてください。関連する場合は以前の会話を参照してください: ${question}\n文脈: ${fullContext}\n聞かれた情報のみを答え、余計な説明は不要です。最大1-2文で答えてください。リストや形式的な文書スタイルではなく、自然な会話調の言葉を使用してください。[タグ名]のような角括弧付きのタグ、タイトル、ラベルを含めないでください。`;
      }
    }
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    
    // Post-process response to ensure it doesn't contain knowledge base tags
    let cleanedResponse = response.text;
    
    // Remove any square bracket tags that might have leaked through
    cleanedResponse = cleanedResponse.replace(/\[[^\]]+\]\s*/g, '');
    
    // If this was a specific request, ensure the response is focused
    if (isSpecificRequest && cleanedResponse.length > 150) {
      // If response is too long for a specific request, extract the key information
      const extractPrompt = language === 'en'
        ? `Extract ONLY the specific answer from this text. Keep it to 1 sentence maximum: ${cleanedResponse}`
        : `このテキストから特定の答えのみを抽出してください。最大1文にしてください: ${cleanedResponse}`;
      
      const extractedResponse = await this.generate([
        { role: 'user', content: extractPrompt }
      ]);
      
      cleanedResponse = extractedResponse.text;
    }
    
    // Store the Q&A interaction in memory with error handling
    try {
      // Extract request type before storing to memory
      const requestType = this.extractRequestTypeFromQuestion(question);
      
      await this.simplifiedMemory.addMessage('user', question, {
        requestType: requestType,
        sessionId: sessionId
      });
      await this.simplifiedMemory.addMessage('assistant', cleanedResponse, {
        sessionId: sessionId
      });
    } catch (error) {
      console.error('[EnhancedQAAgent] Failed to store conversation in memory:', error);
      // Continue execution even if memory storage fails
    }
    
    // Auto-enhance response with emotion tags
    return EmotionTagParser.enhanceAgentResponse(cleanedResponse, 'qa', language);
  }

  private async getCalendarContext(query: string): Promise<string> {
    console.log('[EnhancedQAAgent] Getting calendar context for query:', query);
    const calendarTool = this._tools.get('calendarService');
    console.log('[EnhancedQAAgent] Calendar tool available:', !!calendarTool);
    if (!calendarTool) {
      return 'Calendar service is not available.';
    }

    try {
      console.log('[EnhancedQAAgent] Calling calendar tool...');
      const result = await calendarTool.execute({
        daysAhead: 30,
        maxEvents: 10,
      });
      console.log('[EnhancedQAAgent] Calendar result:', result);

      if (result.success && result.events) {
        return result.events;
      } else {
        return 'Unable to fetch calendar events at this time.';
      }
    } catch (error) {
      console.error('[EnhancedQAAgent] Calendar fetch error:', error);
      return 'Error fetching calendar information.';
    }
  }

  private async getFacilityContext(query: string): Promise<string> {
    const webSearchTool = this._tools.get('engineerCafeWebSearch');
    if (!webSearchTool) {
      return 'Engineer Cafe web search service is not available.';
    }

    try {
      const language: SupportedLanguage = this.memory.get('language') || 'ja';
      
      // Get facility context from memory or knowledge base if available
      const facilityContext = await this.getFacilityKnowledgeBase();
      
      const result = await webSearchTool.execute({
        query: query,
        language: language,
        facilityContext: facilityContext,
      });

      if (result.success && result.text) {
        // Format the response with sources if available
        if (result.sources && result.sources.length > 0) {
          return webSearchTool.formatSearchResultsWithSources(result.text, result.sources, language);
        }
        return result.text;
      } else {
        return 'No facility information found for your query.';
      }
    } catch (error) {
      console.error('Engineer Cafe web search error:', error);
      return 'Error searching facility information.';
    }
  }

  private async getFacilityKnowledgeBase(): Promise<string> {
    // This method can be extended to fetch facility information from the knowledge base
    // For now, return basic facility information
    const language: SupportedLanguage = this.memory.get('language') || 'ja';
    
    if (language === 'ja') {
      return `
エンジニアカフェは福岡市が運営するITエンジニア向けの公共施設です。
営業時間: 9:00-22:00、休館日: 毎月最終月曜日（祝日の場合は翌平日）と年末年始（12/29-1/3）
設備: 高速インターネット、会議室、イベントスペース、コワーキングスペース
利用料金: 完全無料
所在地: 福岡市中央区天神
公式サイト: https://engineercafe.jp
公式X: https://x.com/EngineerCafeJP
`;
    } else {
      return `
Engineer Cafe is a public facility for IT engineers operated by Fukuoka City.
Operating hours: 9:00-22:00 (Open every day)
Facilities: High-speed internet, meeting rooms, event spaces, coworking space
Usage fee: Completely free
Location: Tenjin, Chuo-ku, Fukuoka City
Official website: https://engineercafe.jp
Official X/Twitter: https://x.com/EngineerCafeJP
`;
    }
  }

  private async searchKnowledgeBase(query: string, language?: SupportedLanguage): Promise<string> {
    const currentLanguage: SupportedLanguage = language || this.memory.get('language') || 'ja';
    
    console.log('[EnhancedQAAgent] Starting RAG search for query:', query);
    
    // Apply STT corrections first (handles cafe/wall confusion and other misrecognitions)
    const sttCorrectedQuery = applySttCorrections(query);
    
    // Normalize query for better matching
    const normalizedQuery = sttCorrectedQuery.toLowerCase()
      .replace(/coffee say no/g, 'saino cafe')
      .replace(/才能/g, 'saino')
      .replace(/say no/g, 'saino')
      .replace(/才能カフェ/g, 'saino cafe')
      .replace(/才能 カフェ/g, 'saino cafe')
      .replace(/セイノ/g, 'saino')
      .replace(/サイノ/g, 'saino');
    
    if (query !== sttCorrectedQuery) {
      console.log('[EnhancedQAAgent] STT correction applied:', query, '→', sttCorrectedQuery);
    }
    console.log('[EnhancedQAAgent] Normalized query:', normalizedQuery);
    
    const category = await this.categorizeQuestion(normalizedQuery);
    console.log('[EnhancedQAAgent] Categorized as:', category);
    
    try {
      const ragTool = this._tools.get('ragSearch') || ragSearchTool;
      console.log('[EnhancedQAAgent] Using RAG tool:', !!ragTool);
      
      if (category === 'cafe-clarification-needed') {
        const clarificationMessage = currentLanguage === 'en'
          ? "Are you asking about Engineer Cafe (the coworking space) or Saino Cafe (the attached cafe & bar)?"
          : "コワーキングスペースのエンジニアカフェのことですか、それとも併設のカフェ＆バーのsainoカフェのことですか？";
        
        console.log('[EnhancedQAAgent] Returning clarification message');
        return clarificationMessage;
      }
      
      if (category === 'meeting-room-clarification-needed') {
        const clarificationMessage = currentLanguage === 'en'
          ? "Are you asking about the basement workspace (free, part of Engineer Cafe) or the 2F meeting rooms (paid, city-managed)?"
          : "地下の無料ワークスペース（エンジニアカフェの一部）のことですか、それとも2階の有料会議室（市の管理）のことですか？";
        
        console.log('[EnhancedQAAgent] Returning meeting room clarification message');
        return clarificationMessage;
      }
      
      // For saino-cafe queries, enhance search with language-appropriate terms
      let searchQuery = normalizedQuery;
      if (category === 'saino-cafe') {
        // Add saino-specific terms to improve RAG search accuracy based on language
        if (language === 'ja') {
          searchQuery = `saino ${normalizedQuery} 併設 カフェ バー`.replace(/\s+/g, ' ').trim();
        } else {
          searchQuery = `saino ${normalizedQuery} adjoining cafe bar attached`.replace(/\s+/g, ' ').trim();
        }
        console.log('[EnhancedQAAgent] Enhanced search query for Saino:', searchQuery);
      }
      
      // Also enhance if query contains saino-related terms but wasn't categorized as saino-cafe
      if (normalizedQuery.includes('saino') || normalizedQuery.includes('カフェ&バー') || normalizedQuery.includes('併設') || 
          normalizedQuery.includes('cafe&bar') || normalizedQuery.includes('adjoining')) {
        if (category !== 'saino-cafe') {
          if (language === 'ja') {
            searchQuery = `saino ${normalizedQuery} 併設 カフェ バー`.replace(/\s+/g, ' ').trim();
          } else {
            searchQuery = `saino ${normalizedQuery} adjoining cafe bar attached`.replace(/\s+/g, ' ').trim();
          }
          console.log('[EnhancedQAAgent] Enhanced search query for potential Saino query:', searchQuery);
        }
      }
      
      // Enhance basement/underground space queries
      const basementKeywords = ['地下', 'basement', 'under space', 'underスペース', 'under スペース', 'b1'];
      const hasBasementKeyword = basementKeywords.some(keyword => normalizedQuery.includes(keyword));
      
      // Specific basement space keywords
      const specificBasementSpaces = {
        'mtg': 'MTGスペース 会議室 ミーティング 予約 2時間',
        'ミーティング': 'MTGスペース 会議室 ミーティング 予約 2時間',
        '会議室': 'MTGスペース 会議室 ミーティング 予約 2時間',
        '集中': '集中スペース ブース おしゃべり禁止 予約不要',
        'focus': '集中スペース focus ブース おしゃべり禁止 予約不要',
        'アンダー': 'アンダースペース フリーアドレス 拡張画面 防音室',
        'under': 'アンダースペース under フリーアドレス 拡張画面 防音室',
        'makers': 'Makersスペース 3Dプリンタ レーザーカッター 講習',
        'メーカー': 'Makersスペース makers 3Dプリンタ レーザーカッター 講習',
        '3d': 'Makersスペース 3Dプリンタ レーザーカッター 講習',
        'レーザー': 'Makersスペース 3Dプリンタ レーザーカッター 講習'
      };
      
      if (hasBasementKeyword) {
        let spaceSpecificTerms = '';
        for (const [keyword, terms] of Object.entries(specificBasementSpaces)) {
          if (normalizedQuery.includes(keyword)) {
            spaceSpecificTerms = terms;
            break;
          }
        }
        
        // Add language-appropriate basement terms
        if (language === 'ja') {
          searchQuery = `地下 ${spaceSpecificTerms} ${normalizedQuery}`.replace(/\s+/g, ' ').trim();
        } else {
          searchQuery = `basement ${spaceSpecificTerms} ${normalizedQuery}`.replace(/\s+/g, ' ').trim();
        }
        console.log('[EnhancedQAAgent] Enhanced search query for basement space:', searchQuery);
      }
      
      console.log('[EnhancedQAAgent] Calling RAG search with query:', searchQuery);
      
      // Use multi-language search to get the best results regardless of language
      const context = await ragTool.searchKnowledgeBaseMultiLang(searchQuery, language);
      console.log('[EnhancedQAAgent] Multi-language RAG search result length:', context ? context.length : 0);
      
      if (!context) {
        console.log('[EnhancedQAAgent] No context found, checking if history question');
        const isHistoryQuestion = /history|歴史|background|started|founded|established|開設|設立|始まり|創立/i.test(normalizedQuery);
        
        if (isHistoryQuestion) {
          console.log('[EnhancedQAAgent] Providing history context');
          const historyContext = {
            en: `Engineer Cafe is a public coworking space for IT engineers operated by Fukuoka City. It was established to support the local tech community by providing free workspace, meeting rooms, and networking opportunities for engineers and tech professionals in the Tenjin area.`,
            ja: `エンジニアカフェは、福岡市が運営するITエンジニア向けの公共コワーキングスペースです。地域のテックコミュニティを支援するため、天神エリアのエンジニアや技術者に無料のワークスペース、会議室、ネットワーキングの機会を提供することを目的として設立されました。`
          };
          return historyContext[currentLanguage] || historyContext.ja;
        }
        
        console.log('[EnhancedQAAgent] Returning default context');
        const defaultContext = {
          en: `I couldn't find specific information about that in my knowledge base. 
                Engineer Cafe is open from 9:00 to 22:00 daily, a coworking space in Fukuoka designed for IT engineers.`,
          ja: `申し訳ございませんが、その件について具体的な情報が見つかりませんでした。
                エンジニアカフェは福岡のITエンジニア向け9:00〜22:00営業のコワーキングスペースです。`
        };
        return defaultContext[currentLanguage] || defaultContext.ja;
      }
      
      console.log('[EnhancedQAAgent] Returning RAG context:', context.substring(0, 100) + '...');
      return context;
    } catch (error) {
      console.error('[EnhancedQAAgent] Knowledge base search error:', error);
      const sampleContext = {
        en: `Engineer Cafe is open from 9:00 to 22:00 daily, a coworking space in Fukuoka designed for IT engineers. 
              Features include high-speed internet, private meeting rooms, coffee service, 
              and event spaces. The facility is completely free to use.`,
        ja: `エンジニアカフェは福岡のITエンジニア向け9:00〜22:00営業のコワーキングスペースです。
              高速インターネット、プライベート会議室、コーヒーサービス、イベントスペースを完備。
              施設は完全無料でご利用いただけます。`
      };
      return sampleContext[currentLanguage] || sampleContext.ja;
    }
  }

  async categorizeQuestion(question: string): Promise<string> {
    // Apply STT corrections first
    const correctedQuestion = applySttCorrections(question);
    const lowerQuestion = correctedQuestion.toLowerCase();
    const normalizedQuestion = lowerQuestion
      .replace(/coffee say no/g, 'saino')
      .replace(/才能/g, 'saino')
      .replace(/say no/g, 'saino')
      // Common speech recognition errors for "engineer cafe" are now handled by applySttCorrections
      ;
    
    // Calendar/Events
    if (normalizedQuestion.includes('カレンダー') || normalizedQuestion.includes('calendar') ||
        normalizedQuestion.includes('イベント') || normalizedQuestion.includes('event') ||
        normalizedQuestion.includes('予定') || normalizedQuestion.includes('schedule') ||
        normalizedQuestion.includes('今日') || normalizedQuestion.includes('today') ||
        normalizedQuestion.includes('明日') || normalizedQuestion.includes('tomorrow') ||
        normalizedQuestion.includes('今週') || normalizedQuestion.includes('this week') ||
        normalizedQuestion.includes('直近') || normalizedQuestion.includes('upcoming') ||
        normalizedQuestion.includes('何月') || normalizedQuestion.includes('何日')) {
      console.log('[EnhancedQAAgent] Detected calendar/event keywords');
      return 'calendar';
    }
    
    // Engineer Cafe specific (highest priority - check space variations)
    if (normalizedQuestion.includes('エンジニアカフェ') || 
        normalizedQuestion.includes('エンジニア カフェ') ||
        normalizedQuestion.includes('engineer cafe') || 
        normalizedQuestion.includes('engineer カフェ')) {
      console.log('[EnhancedQAAgent] Detected Engineer Cafe specific query');
      return 'facility-info';
    }
    
    // History-related questions
    if (normalizedQuestion.includes('history') || normalizedQuestion.includes('歴史') ||
        normalizedQuestion.includes('background') || normalizedQuestion.includes('started') ||
        normalizedQuestion.includes('founded') || normalizedQuestion.includes('established') ||
        normalizedQuestion.includes('開設') || normalizedQuestion.includes('設立') ||
        normalizedQuestion.includes('始まり') || normalizedQuestion.includes('創立')) {
      console.log('[EnhancedQAAgent] Detected history-related query');
      return 'facility-info';
    }
    
    // Meeting room ambiguity check (before general facility-info)
    const meetingRoomKeywords = ['会議室', 'meeting room', 'ミーティング', 'mtg'];
    const hasMeetingRoom = meetingRoomKeywords.some(keyword => normalizedQuestion.includes(keyword));
    const hasSpecificFloor = normalizedQuestion.includes('2階') || normalizedQuestion.includes('2f') || 
                            normalizedQuestion.includes('地下') || normalizedQuestion.includes('basement') ||
                            normalizedQuestion.includes('under');
    
    // Check for basement/underground space queries specifically
    const basementKeywords = ['地下', 'basement', 'under space', 'underスペース', 'under スペース', 'b1'];
    const hasBasementKeyword = basementKeywords.some(keyword => normalizedQuestion.includes(keyword));
    
    if (hasBasementKeyword) {
      console.log('[EnhancedQAAgent] Detected basement space query');
      return 'facility-info'; // Handle as facility info with basement context
    }
    
    if (hasMeetingRoom && !hasSpecificFloor) {
      console.log('[EnhancedQAAgent] Detected ambiguous meeting room query - needs clarification');
      return 'meeting-room-clarification-needed';
    }

    // Saino Cafe specific (併設カフェも含む)
    // More specific Saino Cafe detection to reduce false positives
    if ((normalizedQuestion.includes('サイノ') || normalizedQuestion.includes('saino')) ||
        ((normalizedQuestion.includes('併設') || normalizedQuestion.includes('併設されてる')) &&
         (normalizedQuestion.includes('カフェ') || normalizedQuestion.includes('cafe') || normalizedQuestion.includes('bar')))) {
      console.log('[EnhancedQAAgent] Detected Saino Cafe specific query');
      return 'saino-cafe';
    }
    
    // General facility information
    if (normalizedQuestion.includes('施設') || normalizedQuestion.includes('facility') ||
        normalizedQuestion.includes('福岡市') || normalizedQuestion.includes('fukuoka') ||
        normalizedQuestion.includes('公式') || normalizedQuestion.includes('official') ||
        normalizedQuestion.includes('twitter') || normalizedQuestion.includes('x.com') ||
        normalizedQuestion.includes('会議室') || normalizedQuestion.includes('meeting room') ||
        normalizedQuestion.includes('受付') || normalizedQuestion.includes('reception') ||
        normalizedQuestion.includes('フロア') || normalizedQuestion.includes('floor') ||
        normalizedQuestion.includes('どこ') || normalizedQuestion.includes('where') ||
        normalizedQuestion.includes('場所') || normalizedQuestion.includes('location') ||
        normalizedQuestion.includes('階') || normalizedQuestion.includes('回') ||
        normalizedQuestion.includes('部屋') || normalizedQuestion.includes('room')) {
      console.log('[EnhancedQAAgent] Detected facility/location query');
      return 'facility-info';
    }
    
    // Ambiguous cafe queries - ask for clarification when unclear
    if (normalizedQuestion.includes('カフェ') || normalizedQuestion.includes('cafe')) {
      // If it contains working/facility keywords (but not saino-specific), assume Engineer Cafe
      if (normalizedQuestion.includes('コワーキング') || normalizedQuestion.includes('作業') || 
          normalizedQuestion.includes('無料') || normalizedQuestion.includes('利用')) {
        console.log('[EnhancedQAAgent] Cafe query with facility keywords, assuming Engineer Cafe');
        return 'facility-info';
      }
      // For time-related queries without specific context, ask for clarification
      if (normalizedQuestion.includes('営業時間') || normalizedQuestion.includes('時間')) {
        console.log('[EnhancedQAAgent] Ambiguous time query for cafe, requesting clarification');
        return 'cafe-clarification-needed';
      }
      // Otherwise ask for clarification
      console.log('[EnhancedQAAgent] Ambiguous cafe query, requesting clarification');
      return 'cafe-clarification-needed';
    }
    
    // Other categories
    if (lowerQuestion.includes('料金') || lowerQuestion.includes('price')) {
      return 'pricing';
    } else if (lowerQuestion.includes('設備') || lowerQuestion.includes('facility')) {
      return 'facilities';
    } else if (lowerQuestion.includes('アクセス') || lowerQuestion.includes('access')) {
      return 'access';
    } else if (lowerQuestion.includes('時間') || lowerQuestion.includes('営業') || 
               lowerQuestion.includes('hours') || lowerQuestion.includes('open')) {
      return 'hours';
    } else {
      return 'general';
    }
  }

  async provideFallbackResponse(): Promise<string> {
    const language: SupportedLanguage = this.memory.get('language') || 'ja';
    
    const fallback = language === 'en'
      ? "[sad]I don't have specific information about that. Would you like me to connect you with our staff for detailed assistance?[/sad]"
      : "[sad]その件について詳しい情報がございません。スタッフにお繋ぎしてより詳しくご案内させていただきましょうか？[/sad]";
    
    return fallback;
  }

  async escalateToStaff(_question: string): Promise<string> {
    const language: SupportedLanguage = this.memory.get('language') || 'ja';
    
    const message = language === 'en'
      ? "[happy]I've notified our staff about your inquiry. Someone will be with you shortly to provide detailed assistance.[/happy]"
      : "[happy]スタッフにご連絡いたしました。詳しいご案内のため、まもなくスタッフがお伺いいたします。[/happy]";
    
    return message;
  }

  private async isIrrelevantResult(context: string, question: string): Promise<boolean> {
    // Skip relevance check for clarification messages
    if (ClarificationUtils.isClarificationMessage(context)) {
      return false;
    }

    // If context is too short or generic, consider it irrelevant
    if (context.length < 50) {
      console.log('[EnhancedQAAgent] Context too short, considering irrelevant');
      return true;
    }

    try {
      const language: SupportedLanguage = this.memory.get('language') || 'ja';
      
      const relevancePrompt = language === 'en'
        ? `Based ONLY on the following information, can you clearly answer this question: "${question}"?

Information:
${context}

Answer with only "YES" or "NO". If the information is about Engineer Cafe facilities but the question is about sports, news, or unrelated topics, answer "NO".`
        : `以下の情報のみを使用して、この質問「${question}」に明確に回答できますか？

情報:
${context}

「はい」または「いいえ」でのみ答えてください。情報がエンジニアカフェの施設に関するものでも、質問がスポーツ、ニュース、または無関係な話題の場合は「いいえ」と答えてください。`;

      const relevanceCheck = await this.generate([
        { role: 'user', content: relevancePrompt }
      ]);

      const isRelevant = relevanceCheck.text.toLowerCase().includes('yes') || 
                        relevanceCheck.text.toLowerCase().includes('はい');
      
      console.log('[EnhancedQAAgent] Relevance check result:', isRelevant ? 'RELEVANT' : 'IRRELEVANT');
      return !isRelevant;
      
    } catch (error) {
      console.error('[EnhancedQAAgent] Error in relevance check:', error);
      // If relevance check fails, assume relevant to avoid unnecessary web search
      return false;
    }
  }

  private async performWebSearch(query: string): Promise<string> {
    const webSearchTool = this._tools.get('generalWebSearch');
    if (!webSearchTool) {
      console.log('[EnhancedQAAgent] General web search tool not available');
      return 'Web search service is not available.';
    }

    try {
      const language: SupportedLanguage = this.memory.get('language') || 'ja';
      
      console.log('[EnhancedQAAgent] Calling general web search with query:', query);
      const result = await webSearchTool.execute({
        query: query,
        language: language,
      });

      if (result.success && result.text) {
        // Format the response with sources if available
        if (result.sources && result.sources.length > 0) {
          return webSearchTool.formatSearchResultsWithSources(result.text, result.sources, language);
        }
        return result.text;
      } else {
        console.log('[EnhancedQAAgent] Web search failed:', result.error);
        return language === 'ja' 
          ? 'インターネット検索で情報を見つけることができませんでした。'
          : 'Unable to find information through web search.';
      }
    } catch (error) {
      console.error('[EnhancedQAAgent] Web search error:', error);
      const language: SupportedLanguage = this.memory.get('language') || 'ja';
      return language === 'ja' 
        ? 'インターネット検索でエラーが発生しました。'
        : 'Error occurred during web search.';
    }
  }

  private isMemoryRelatedQuestion(question: string): boolean {
    const normalizedQuestion = question.toLowerCase();
    
    // Japanese memory-related keywords
    const japaneseMemoryKeywords = [
      'さっき', '前に', '覚えて', '記憶', '質問', '聞いた', '話した', 
      'どんな', '何を', '言った', '会話', '履歴', '先ほど'
    ];
    
    // English memory-related keywords
    const englishMemoryKeywords = [
      'remember', 'recall', 'earlier', 'before', 'previous', 
      'asked', 'said', 'mentioned', 'conversation', 'history'
    ];
    
    const allKeywords = [...japaneseMemoryKeywords, ...englishMemoryKeywords];
    
    return allKeywords.some(keyword => normalizedQuestion.includes(keyword));
  }

  private extractOriginalQuestionFromContext(recentMessages: any[], currentResponse: string): string | null {
    // Look for the most recent user question that might have triggered a clarification
    const userMessages = recentMessages
      .filter(msg => msg.role === 'user')
      .slice(-4); // Look at last 4 user messages for better context
    
    if (userMessages.length === 0) {
      return null;
    }
    
    // Enhanced question detection patterns
    const questionIndicators = [
      // Time-related
      '営業時間', '時間', 'operating hours', 'hours', '営業', 'open', 'close', '何時',
      // Location-related  
      'どこ', 'where', '場所', 'location', '階', 'floor', '部屋', 'room',
      // Facility-related
      '設備', 'facility', 'equipment', 'wifi', 'コーヒー', 'coffee', '会議室', 'meeting',
      // Service-related
      '料金', 'price', 'cost', 'fee', '無料', 'free', 'サービス', 'service',
      // General inquiry patterns
      '教えて', 'tell me', '知りたい', 'want to know', '聞きたい', 'ask about',
      'について', 'about', 'に関して', 'regarding', 'の', 'どう', 'how'
    ];
    
    // Score messages based on how likely they are to be the original question
    const scoredMessages = userMessages.map(msg => {
      const content = msg.content.toLowerCase();
      let score = 0;
      
      // Question indicators
      questionIndicators.forEach(indicator => {
        if (content.includes(indicator)) score += 2;
      });
      
      // Question marks
      if (content.includes('?') || content.includes('？')) score += 3;
      
      // Question words
      const questionWords = ['what', 'where', 'when', 'how', 'why', 'who', 
                           '何', 'どこ', 'いつ', 'どう', 'なぜ', 'だれ'];
      questionWords.forEach(word => {
        if (content.includes(word)) score += 3;
      });
      
      // Length bonus (longer messages more likely to be questions)
      if (content.length > 10) score += 1;
      if (content.length > 20) score += 1;
      
      return { message: msg, score };
    });
    
    // Find the highest scoring message
    const bestMatch = scoredMessages.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    // Return the best match if it has a reasonable score, otherwise most recent
    if (bestMatch.score >= 3) {
      return bestMatch.message.content;
    }
    
    // Fallback to most recent user message
    return userMessages[userMessages.length - 1]?.content || null;
  }

  private async isContextualResponse(question: string): Promise<boolean> {
    const normalizedQuestion = question.toLowerCase().trim();
    
    // Enhanced contextual response detection
    const isShortResponse = question.length < 50; // Increased threshold for more coverage
    const wordCount = normalizedQuestion.split(/\s+/).length;
    const isVeryShort = wordCount <= 3; // 3 words or less
    
    // Expanded response patterns
    const contextualPatterns = [
      // Facility choices
      'エンジニアカフェ', 'engineer cafe', 'サイノ', 'saino',
      // Simple affirmatives/negatives  
      'はい', 'いいえ', 'yes', 'no', 'sure', 'okay',
      // Common short responses
      '1階', '2階', '地下', 'basement', 'first floor', 'second floor',
      '午前', '午後', 'morning', 'afternoon', 'evening',
      'wifi', 'コーヒー', 'coffee', '会議室', 'meeting room',
      // Price/time related
      '無料', 'free', '有料', 'paid', '今日', 'today', '明日', 'tomorrow',
      // Quantity responses
      '1つ', '2つ', 'one', 'two', 'first', 'second'
    ];
    
    const hasContextualPattern = contextualPatterns.some(pattern => 
      normalizedQuestion.includes(pattern.toLowerCase())
    );
    
    // Check if it's a likely contextual response
    if (!isShortResponse && !isVeryShort && !hasContextualPattern) {
      return false;
    }
    
    // Check recent conversation history for clarification questions
    try {
      const memoryContext = await this.simplifiedMemory.getContext(question, {
        includeKnowledgeBase: false, // Only look at conversation history
        language: this.memory.get('language') || 'ja'
      });
      
      const recentMessages = memoryContext.recentMessages;
      
      // Look for recent assistant messages asking for clarification
      const recentAssistantMessages = recentMessages
        .filter(msg => msg.role === 'assistant')
        .slice(-2); // Last 2 assistant messages
      
      const clarificationPatterns = [
        // Facility clarification patterns
        'どちらについてお聞きでしょうか', 'エンジニアカフェのことですか', 'サイノカフェのことですか',
        '併設のカフェ', 'コワーキングスペース', 
        'which one', 'engineer cafe', 'saino cafe', 'asking about', 'coworking space',
        'attached cafe', 'are you asking',
        // General clarification patterns
        'どちらを', 'どれを', 'どの', 'いつの', 'どこの',
        'which', 'what time', 'which floor', 'which room', 'what type',
        'choose', 'select', 'option', 'prefer',
        // Question clarification
        '詳しく', 'もう少し', 'specific', 'more details', 'clarify',
        '1つ目', '2つ目', 'first option', 'second option',
        // Yes/No clarification  
        'そうですか', 'correct', 'right', 'confirm'
      ];
      
      const hasRecentClarification = recentAssistantMessages.some(msg => 
        clarificationPatterns.some(pattern => 
          msg.content.toLowerCase().includes(pattern)
        )
      );
      
      console.log('[EnhancedQAAgent] Contextual response check:', {
        isShortResponse,
        isVeryShort,
        hasContextualPattern,
        hasRecentClarification,
        recentAssistantCount: recentAssistantMessages.length
      });
      
      return hasRecentClarification;
    } catch (error) {
      console.error('[EnhancedQAAgent] Error checking contextual response:', error);
      return false;
    }
  }

  /**
   * Extract previous specific request type from conversation history
   */
  private extractPreviousSpecificRequest(messages: any[]): string | null {
    if (!messages || messages.length === 0) return null;
    
    // Look for recent user messages that contained specific requests
    const recentUserMessages = messages
      .filter(msg => msg.role === 'user')
      .slice(-3); // Check last 3 user messages
    
    for (const msg of recentUserMessages) {
      // First check if we stored the request type in metadata
      if (msg.metadata?.requestType) {
        console.log('[EnhancedQAAgent] Found stored request type in metadata:', msg.metadata.requestType);
        return msg.metadata.requestType;
      }
      
      // Fallback to content analysis if no metadata
      const content = msg.content.toLowerCase();
      if (content.includes('営業時間') || content.includes('hours') || content.includes('time') || 
          content.includes('何時') || content.includes('いつまで')) {
        return 'hours';
      } else if (content.includes('料金') || content.includes('price') || content.includes('cost') ||
                 content.includes('値段') || content.includes('無料') || content.includes('有料')) {
        return 'price';
      } else if (content.includes('場所') || content.includes('location') || content.includes('where') ||
                 content.includes('どこ') || content.includes('階')) {
        return 'location';
      } else if (content.includes('予約') || content.includes('booking') || content.includes('reservation')) {
        return 'booking';
      } else if (content.includes('設備') || content.includes('facility') || content.includes('equipment')) {
        return 'facility';
      } else if (content.includes('アクセス') || content.includes('access') || content.includes('行き方')) {
        return 'access';
      }
    }
    
    return null;
  }

  /**
   * Extract the type of request from a question
   */
  private extractRequestTypeFromQuestion(question: string): string | null {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('営業時間') || lowerQuestion.includes('hours') || lowerQuestion.includes('time') || 
        lowerQuestion.includes('何時') || lowerQuestion.includes('いつまで') || lowerQuestion.includes('when') ||
        lowerQuestion.includes('open') || lowerQuestion.includes('close') || lowerQuestion.includes('開いて') || 
        lowerQuestion.includes('閉まる')) {
      return 'hours';
    } else if (lowerQuestion.includes('料金') || lowerQuestion.includes('price') || lowerQuestion.includes('cost') ||
               lowerQuestion.includes('値段') || lowerQuestion.includes('無料') || lowerQuestion.includes('有料') ||
               lowerQuestion.includes('fee') || lowerQuestion.includes('費用')) {
      return 'price';
    } else if (lowerQuestion.includes('場所') || lowerQuestion.includes('location') || lowerQuestion.includes('where') ||
               lowerQuestion.includes('どこ') || lowerQuestion.includes('階') || lowerQuestion.includes('address') ||
               lowerQuestion.includes('住所')) {
      return 'location';
    } else if (lowerQuestion.includes('予約') || lowerQuestion.includes('booking') || lowerQuestion.includes('reservation') ||
               lowerQuestion.includes('reserve') || lowerQuestion.includes('申し込み') || lowerQuestion.includes('申込')) {
      return 'booking';
    } else if (lowerQuestion.includes('設備') || lowerQuestion.includes('facility') || lowerQuestion.includes('equipment') ||
               lowerQuestion.includes('何がある') || lowerQuestion.includes('what is there') || lowerQuestion.includes('利用できる')) {
      return 'facility';
    } else if (lowerQuestion.includes('アクセス') || lowerQuestion.includes('access') || lowerQuestion.includes('行き方') ||
               lowerQuestion.includes('directions') || lowerQuestion.includes('how to get')) {
      return 'access';
    }
    
    return null;
  }

  /**
   * Detects if the question is asking for specific information (e.g., just operating hours)
   * rather than general information about a facility
   */
  private detectSpecificRequest(question: string, previousRequest?: string | null): boolean {
    const lowerQuestion = question.toLowerCase();
    
    // Specific time/hours requests
    const timePatterns = [
      '営業時間', 'hours', 'time', '何時', 'いつまで', 'when',
      'open', 'close', '開いて', '閉まる', '時間'
    ];
    
    // Price/cost specific requests
    const pricePatterns = [
      '料金', 'cost', 'price', '値段', '金額', 'fee', '費用', '有料', '無料'
    ];
    
    // Location specific requests
    const locationPatterns = [
      'どこ', 'where', '場所', 'location', '住所', 'address', 'アクセス', 'access', '階'
    ];
    
    // Contact specific requests
    const contactPatterns = [
      '電話', 'phone', '連絡', 'contact', 'メール', 'email'
    ];
    
    // Booking/reservation requests
    const bookingPatterns = [
      '予約', 'booking', 'reservation', 'reserve', '申し込み', '申込'
    ];
    
    // Facility/equipment requests
    const facilityPatterns = [
      '設備', 'facility', 'equipment', '何がある', 'what is there', '利用できる'
    ];
    
    // Short contextual follow-up patterns
    const followUpPatterns = [
      'じゃ', 'では', 'それで', 'then', 'so', 'how about',
      'の方は', 'はどう', 'については', 'what about'
    ];
    
    // Combine all specific patterns
    const specificPatterns = [
      ...timePatterns,
      ...pricePatterns, 
      ...locationPatterns,
      ...contactPatterns,
      ...bookingPatterns,
      ...facilityPatterns
    ];
    
    // Check if question contains specific request patterns
    const hasSpecificPattern = specificPatterns.some(pattern => 
      lowerQuestion.includes(pattern)
    );
    
    // Check if it's a short follow-up question
    const isShortFollowUp = followUpPatterns.some(pattern => 
      lowerQuestion.includes(pattern)
    ) && lowerQuestion.length < 20;
    
    // If there's a previous specific request and this is a follow-up, inherit the request type
    const inheritsPreviousRequest = !!(previousRequest && isShortFollowUp);
    
    // Additional check: avoid general questions even with these keywords
    const generalPatterns = [
      'について教えて', 'について知りたい', 'about', 'tell me about',
      'どんな', 'what kind', 'how is', 'explain', '説明', '詳しく'
    ];
    
    const isGeneralQuestion = generalPatterns.some(pattern => 
      lowerQuestion.includes(pattern)
    );
    
    console.log('[EnhancedQAAgent] Specific request detection:', {
      question: lowerQuestion,
      hasSpecificPattern,
      isShortFollowUp,
      inheritsPreviousRequest,
      previousRequest,
      isGeneralQuestion,
      result: (hasSpecificPattern || isShortFollowUp || inheritsPreviousRequest) && !isGeneralQuestion
    });
    
    return (hasSpecificPattern || isShortFollowUp || inheritsPreviousRequest) && !isGeneralQuestion;
  }
}