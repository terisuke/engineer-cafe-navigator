import { Agent } from '@mastra/core/agent';
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';
import { SupportedLanguage } from '@/mastra/types/config';

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
        Always respond in the same language as the question.`,
    });
    // Use shared memory system
    this.simplifiedMemory = new SimplifiedMemorySystem('shared');
  }

  async handleMemoryQuery(
    query: string,
    sessionId: string,
    language: SupportedLanguage
  ): Promise<string> {
    console.log('[MemoryAgent] Processing memory query:', {
      query,
      sessionId,
      language
    });

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
      return language === 'en'
        ? "I don't have any previous conversation history to reference."
        : "参照できる過去の会話履歴がありません。";
    }
    
    const prompt = this.buildMemoryPrompt(query, memoryContext, language);
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    
    return response.text;
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
}