import { Agent } from '@mastra/core/agent';
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';
import { SupportedLanguage } from '@/mastra/types/config';
import { UnifiedAgentResponse, createUnifiedResponse } from '@/mastra/types/unified-response';

export interface MemoryAgentConfig {
  llm: {
    model: any;
  };
}

export class MemoryAgent extends Agent {
  private simplifiedMemory: SimplifiedMemorySystem;

  constructor(config: MemoryAgentConfig) {
    super({
      name: 'MemoryAgent',
      model: config.llm.model,
      instructions: `You are a memory specialist that helps users recall previous conversations.
        You can:
        - Remember what was asked earlier
        - Provide conversation history
        - Reference previous questions and answers
        Be helpful and accurate about past interactions.
        Always respond in the same language as the question.
        
        IMPORTANT: Always start your response with an emotion tag.
        Available emotions: [happy], [sad], [angry], [relaxed], [surprised]
        
        Use [relaxed] when recalling neutral conversation history
        Use [happy] when recalling positive interactions or helpful responses
        Use [sad] when unable to find requested conversation history
        Use [surprised] when the user asks about something unexpected in the history`,
    });
    // Use shared memory system
    this.simplifiedMemory = new SimplifiedMemorySystem('shared');
  }

  async handleMemoryQuery(
    query: string,
    sessionId: string,
    language: SupportedLanguage
  ): Promise<UnifiedAgentResponse> {
    console.log('[MemoryAgent] Processing memory query:', {
      query,
      sessionId,
      language
    });

    // Check if this is asking about "the other one" from a clarification
    if (this.isAskingAboutOtherOption(query)) {
      const clarificationContext = await this.findPreviousClarification(sessionId);
      if (clarificationContext) {
        return await this.handleOtherOptionQuery(query, clarificationContext, language);
      }
    }
    
    // 会話履歴の取得
    const memoryContext = await this.simplifiedMemory.getContext(query, {
      includeKnowledgeBase: false,
      language
    });
    
    console.log('[MemoryAgent] Retrieved memory context:', {
      hasRecentMessages: !!memoryContext.recentMessages,
      messageCount: memoryContext.recentMessages?.length || 0,
      contextLength: memoryContext.contextString?.length || 0
    });

    if (!memoryContext.recentMessages || memoryContext.recentMessages.length === 0) {
      const text = language === 'en'
        ? "[sad]I don't have any previous conversation history to reference."
        : "[sad]参照できる過去の会話履歴がありません。";
      
      return createUnifiedResponse(
        text,
        'apologetic',
        'MemoryAgent',
        language,
        {
          confidence: 0.9,
          category: 'memory',
          sources: ['memory_system']
        }
      );
    }
    
    const prompt = this.buildMemoryPrompt(query, memoryContext, language);
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    
    return createUnifiedResponse(
      response.text,
      'helpful',
      'MemoryAgent',
      language,
      {
        confidence: 0.9,
        category: 'memory',
        sources: ['memory_system'],
        processingInfo: {
          contextInherited: true
        }
      }
    );
  }

  private buildMemoryPrompt(
    query: string,
    memoryContext: any,
    language: SupportedLanguage
  ): string {
    const conversationHistory = memoryContext.contextString;
    
    console.log('[MemoryAgent] Building memory prompt:', {
      queryLength: query.length,
      historyLength: conversationHistory?.length || 0,
      language
    });

    // Extract specific information from query
    const isAskingAboutQuestion = this.isAskingAboutPreviousQuestion(query);
    const isAskingAboutAnswer = this.isAskingAboutPreviousAnswer(query);
    
    if (isAskingAboutQuestion) {
      return language === 'en'
        ? `The user is asking about what question they asked earlier. Look at the conversation history and identify the user's previous questions.

Conversation History:
${conversationHistory}

User's current question: ${query}

Respond by mentioning the specific question(s) the user asked previously. Be clear and direct.`
        : `ユーザーは以前に聞いた質問について尋ねています。会話履歴を見て、ユーザーの以前の質問を特定してください。

会話履歴:
${conversationHistory}

ユーザーの現在の質問: ${query}

ユーザーが以前に聞いた具体的な質問を明確に述べて応答してください。`;
    }

    if (isAskingAboutAnswer) {
      return language === 'en'
        ? `The user is asking about what answer they received earlier. Look at the conversation history and identify the assistant's previous responses.

Conversation History:
${conversationHistory}

User's current question: ${query}

Respond by summarizing the answer(s) that were given previously. Be accurate and helpful.`
        : `ユーザーは以前に受けた回答について尋ねています。会話履歴を見て、アシスタントの以前の応答を特定してください。

会話履歴:
${conversationHistory}

ユーザーの現在の質問: ${query}

以前に提供された回答を要約して応答してください。正確で役立つ情報を提供してください。`;
    }

    // General memory query
    return language === 'en'
      ? `The user is asking about the previous conversation. Use the conversation history to answer their question.

Conversation History:
${conversationHistory}

User's current question: ${query}

Reference specific parts of the conversation history to provide an accurate and helpful response.`
      : `ユーザーは過去の会話について質問しています。会話履歴を使って質問に答えてください。

会話履歴:
${conversationHistory}

ユーザーの現在の質問: ${query}

会話履歴の具体的な部分を参照して、正確で役立つ応答を提供してください。`;
  }

  private isAskingAboutPreviousQuestion(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const questionKeywords = [
      // Japanese
      '何を聞いた', '質問した', 'どんな質問', '聞いたこと',
      // English
      'what did i ask', 'what i asked', 'my question', 'asked about'
    ];
    
    return questionKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  private isAskingAboutPreviousAnswer(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const answerKeywords = [
      // Japanese
      '答え', '回答', '返事', '応答',
      // English
      'answer', 'response', 'replied', 'told me'
    ];
    
    return answerKeywords.some(keyword => lowerQuery.includes(keyword));
  }
  
  private isAskingAboutOtherOption(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const otherOptionKeywords = [
      // Japanese
      'もう一つ', 'もうひとつ', 'もう1つ', 'もう一方', 'もう片方',
      '他の方', 'ほかの方', '別の方', 'そっち', 'あっち',
      // English
      'the other', 'other one', 'other option', 'the alternative'
    ];
    
    return otherOptionKeywords.some(keyword => lowerQuery.includes(keyword));
  }
  
  private async findPreviousClarification(sessionId: string): Promise<any> {
    // Get memory context - using a dummy query to get all recent messages
    const memoryContext = await this.simplifiedMemory.getContext('dummy', {
      includeKnowledgeBase: false,
      language: 'ja'
    });
    
    if (!memoryContext.recentMessages) return null;
    
    // Look for clarification messages in recent history
    for (const message of memoryContext.recentMessages.reverse()) {
      // Check if message is from the same session
      if (message.role === 'assistant' && 
          message.metadata?.sessionId === sessionId &&
          message.metadata?.clarificationType) {
        return {
          type: message.metadata.clarificationType,
          options: message.metadata.clarificationOptions,
          message: message.content
        };
      }
    }
    
    return null;
  }
  
  private async handleOtherOptionQuery(
    query: string,
    clarificationContext: any,
    language: SupportedLanguage
  ): Promise<UnifiedAgentResponse> {
    
    // For cafe clarifications
    if (clarificationContext.type === 'cafe') {
      // Check if user already specified one option
      const memoryContext = await this.simplifiedMemory.getContext(query, {
        includeKnowledgeBase: false,
        language
      });
      
      let specifiedOption = null;
      if (memoryContext.recentMessages) {
        for (const msg of memoryContext.recentMessages.slice(-5)) {
          const lowerContent = msg.content.toLowerCase();
          if (lowerContent.includes('エンジニアカフェ') || lowerContent.includes('engineer cafe')) {
            specifiedOption = 'Engineer Cafe';
            break;
          } else if (lowerContent.includes('サイノ') || lowerContent.includes('saino')) {
            specifiedOption = 'Saino Cafe';
            break;
          }
        }
      }
      
      if (specifiedOption === 'Engineer Cafe') {
        const text = language === 'en'
          ? "[happy]Based on our conversation, you were asking about Saino Cafe (the attached cafe & bar). Saino is open from 11:00 to 20:30, offering lunch, drinks, and a bar service in the evening."
          : "[happy]さきほどの会話から、サイノカフェ（併設のカフェ＆バー）についてお聞きですね。サイノの営業時間は11:00〜20:30で、ランチ、ドリンク、夕方からはバーサービスも提供しています。";
        
        return createUnifiedResponse(
          text,
          'helpful',
          'MemoryAgent',
          language,
          {
            confidence: 0.9,
            category: 'cafe-clarification',
            sources: ['memory_system', 'knowledge_base'],
            processingInfo: {
              contextInherited: true
            }
          }
        );
      } else if (specifiedOption === 'Saino Cafe') {
        const text = language === 'en'
          ? "[happy]Based on our conversation, you were asking about Engineer Cafe (the coworking space). Engineer Cafe is open from 9:00 to 22:00 and provides free workspace with Wi-Fi, power outlets, and other facilities."
          : "[happy]さきほどの会話から、エンジニアカフェ（コワーキングスペース）についてお聞きですね。エンジニアカフェの営業時間は9:00〜22:00で、Wi-Fi、電源、その他の設備を備えた無料のワークスペースを提供しています。";
        
        return createUnifiedResponse(
          text,
          'helpful',
          'MemoryAgent',
          language,
          {
            confidence: 0.9,
            category: 'cafe-clarification',
            sources: ['memory_system', 'knowledge_base'],
            processingInfo: {
              contextInherited: true
            }
          }
        );
      }
    }
    
    // For meeting room clarifications
    if (clarificationContext.type === 'meeting-room') {
      // Similar logic for meeting rooms
      const memoryContext = await this.simplifiedMemory.getContext(query, {
        includeKnowledgeBase: false,
        language
      });
      
      let specifiedOption = null;
      if (memoryContext.recentMessages) {
        for (const msg of memoryContext.recentMessages.slice(-5)) {
          const lowerContent = msg.content.toLowerCase();
          if (lowerContent.includes('地下') || lowerContent.includes('basement') || lowerContent.includes('mtg')) {
            specifiedOption = 'Basement';
            break;
          } else if (lowerContent.includes('有料') || lowerContent.includes('2階') || lowerContent.includes('paid')) {
            specifiedOption = 'Paid';
            break;
          }
        }
      }
      
      if (specifiedOption === 'Basement') {
        const text = language === 'en'
          ? "[happy]Based on our conversation, you were asking about the paid meeting rooms on the 2nd floor. These are private rooms that require advance booking and have usage fees. You can make reservations through the website."
          : "[happy]さきほどの会話から、2階の有料会議室についてお聞きですね。これらは事前予約が必要な個室で、利用料金がかかります。ウェブサイトから予約できます。";
        
        return createUnifiedResponse(
          text,
          'helpful',
          'MemoryAgent',
          language,
          {
            confidence: 0.9,
            category: 'meeting-room-clarification',
            sources: ['memory_system', 'knowledge_base'],
            processingInfo: {
              contextInherited: true
            }
          }
        );
      } else if (specifiedOption === 'Paid') {
        const text = language === 'en'
          ? "[happy]Based on our conversation, you were asking about the basement meeting spaces. These are free, casual meeting spaces that don't require reservations. They're available on a first-come, first-served basis."
          : "[happy]さきほどの会話から、地下のMTGスペースについてお聞きですね。これらは予約不要の無料のカジュアルな打ち合わせスペースで、先着順でご利用いただけます。";
        
        return createUnifiedResponse(
          text,
          'helpful',
          'MemoryAgent',
          language,
          {
            confidence: 0.9,
            category: 'meeting-room-clarification',
            sources: ['memory_system', 'knowledge_base'],
            processingInfo: {
              contextInherited: true
            }
          }
        );
      }
    }
    
    // Fallback if we can't determine the context
    const text = language === 'en'
      ? "[surprised]I understand you're asking about 'the other option', but I need more context to provide the right information. Could you please specify what you're comparing?"
      : "[surprised]「もう一つの方」についてお聞きですが、適切な情報を提供するためにはもう少し文脈が必要です。何と比較されているか具体的に教えていただけますか？";
    
    return createUnifiedResponse(
      text,
      'confused',
      'MemoryAgent',
      language,
      {
        confidence: 0.5,
        category: 'clarification-needed',
        sources: ['memory_system']
      }
    );
  }
}