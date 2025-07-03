import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '@/mastra/types/config';
import { UnifiedAgentResponse, createUnifiedResponse } from '@/mastra/types/unified-response';

export interface EventAgentConfig {
  llm: {
    model: any;
  };
}

export class EventAgent extends Agent {
  private _tools: Map<string, any> = new Map();

  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }
  constructor(config: EventAgentConfig) {
    super({
      name: 'EventAgent',
      model: config.llm.model,
      instructions: `You are an event information specialist for Engineer Cafe.
        You provide information about:
        - Today's events and activities
        - This week's schedule
        - Upcoming workshops and seminars
        - Study groups and meetups
        Format event information clearly with dates, times, and descriptions.
        Always respond in the same language as the question.
        
        IMPORTANT: Always start your response with an emotion tag.
        Available emotions: [happy], [sad], [angry], [relaxed], [surprised]
        
        Use [happy] when announcing exciting events or multiple activities
        Use [sad] when there are no events or limited activities
        Use [relaxed] for general event information
        Use [surprised] for unexpected event updates or special announcements`,
    });
  }

  async answerEventQuery(
    query: string,
    language: SupportedLanguage
  ): Promise<UnifiedAgentResponse> {
    console.log('[EventAgent] Processing event query:', {
      query,
      language
    });

    // Determine time range from query
    const timeRange = this.extractTimeRange(query);
    
    // Get calendar events
    const calendarTool = this._tools.get('calendarService');
    let calendarResult: any = { success: false, data: null };
    if (calendarTool) {
      try {
        calendarResult = await calendarTool.execute({
          action: 'searchEvents',
          timeRange,
          query
        });
      } catch (error) {
        console.error('[EventAgent] Calendar tool error:', error);
      }
    }
    
    // Also search knowledge base for event information
    const ragTool = this._tools.get('ragSearch');
    let knowledgeResult: any = { success: false, data: null };
    if (ragTool) {
      try {
        knowledgeResult = await ragTool.execute({
          query,
          language,
          limit: 10
        });
      } catch (error) {
        console.error('[EventAgent] RAG search error:', error);
      }
    }
    
    // Combine results
    const hasCalendarEvents = calendarResult.success && calendarResult.data?.events?.length > 0;
    // RAG検索結果からコンテキストを構築
    let knowledgeContext = '';
    if (knowledgeResult.success) {
      if (knowledgeResult.results && Array.isArray(knowledgeResult.results)) {
        knowledgeContext = knowledgeResult.results
          .map((r: any) => r.content)
          .join('\n\n');
      } else if (knowledgeResult.data && knowledgeResult.data.context) {
        knowledgeContext = knowledgeResult.data.context;
      }
    }
    
    const hasKnowledgeEvents = knowledgeResult.success && knowledgeContext;
    
    if (!hasCalendarEvents && !hasKnowledgeEvents) {
      return this.getNoEventsResponse(timeRange, language);
    }
    
    const prompt = this.buildEventPrompt(
      query,
      calendarResult.data?.events || [],
      knowledgeContext,
      timeRange,
      language
    );
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    
    // Determine sources used
    const sources = [];
    if (hasCalendarEvents) {
      sources.push('calendar');
    }
    if (hasKnowledgeEvents) {
      sources.push('knowledge_base');
    }
    
    // Determine emotion based on events found
    let emotion = 'helpful';
    if (hasCalendarEvents && calendarResult.data?.events?.length > 0) {
      emotion = 'excited';
    } else if (!hasCalendarEvents && !hasKnowledgeEvents) {
      emotion = 'apologetic';
    }
    
    return createUnifiedResponse(
      response.text,
      emotion,
      'EventAgent',
      language,
      {
        confidence: 0.8,
        category: 'events',
        sources,
        processingInfo: {
          enhancedRag: false
        }
      }
    );
  }

  private extractTimeRange(query: string): 'today' | 'thisWeek' | 'nextWeek' | 'thisMonth' {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('今日') || lowerQuery.includes('today') || lowerQuery.includes('本日')) {
      return 'today';
    }
    if (lowerQuery.includes('今週') || lowerQuery.includes('this week')) {
      return 'thisWeek';
    }
    if (lowerQuery.includes('来週') || lowerQuery.includes('next week')) {
      return 'nextWeek';
    }
    if (lowerQuery.includes('今月') || lowerQuery.includes('this month')) {
      return 'thisMonth';
    }
    
    // Default to this week
    return 'thisWeek';
  }

  private buildEventPrompt(
    query: string,
    calendarEvents: any[],
    knowledgeContext: string,
    timeRange: string,
    language: SupportedLanguage
  ): string {
    const calendarInfo = this.formatCalendarEvents(calendarEvents, language);
    
    if (language === 'en') {
      return `Provide information about events at Engineer Cafe based on the following data.

Question: ${query}
Time Range: ${timeRange}

Calendar Events:
${calendarInfo || 'No events found in calendar'}

Additional Event Information:
${knowledgeContext || 'No additional information available'}

Format the response with clear dates, times, and event descriptions. If there are multiple events, list them chronologically.`;
    } else {
      return `以下のデータに基づいて、エンジニアカフェのイベントについて情報を提供してください。

質問: ${query}
期間: ${this.translateTimeRange(timeRange)}

カレンダーイベント:
${calendarInfo || 'カレンダーにイベントが見つかりません'}

追加のイベント情報:
${knowledgeContext || '追加情報はありません'}

日付、時間、イベントの説明を明確にフォーマットして応答してください。複数のイベントがある場合は、時系列順に一覧表示してください。`;
    }
  }

  private formatCalendarEvents(events: any[], language: SupportedLanguage): string {
    if (!events || events.length === 0) {
      return '';
    }
    
    return events.map(event => {
      const startTime = new Date(event.start).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US');
      const endTime = event.end ? new Date(event.end).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US') : '';
      
      return language === 'en'
        ? `- ${event.title}\n  Time: ${startTime}${endTime ? ` - ${endTime}` : ''}\n  ${event.description || 'No description'}`
        : `- ${event.title}\n  時間: ${startTime}${endTime ? ` - ${endTime}` : ''}\n  ${event.description || '説明なし'}`;
    }).join('\n\n');
  }

  private translateTimeRange(timeRange: string): string {
    const translations: Record<string, string> = {
      'today': '今日',
      'thisWeek': '今週',
      'nextWeek': '来週',
      'thisMonth': '今月'
    };
    
    return translations[timeRange] || timeRange;
  }

  private getNoEventsResponse(timeRange: string, language: SupportedLanguage): UnifiedAgentResponse {
    const timeRangeText = language === 'ja' ? this.translateTimeRange(timeRange) : timeRange;
    
    const text = language === 'en'
      ? `[sad]I couldn't find any scheduled events for ${timeRange} at Engineer Cafe. Please check the official website or contact the staff for the most up-to-date event information.`
      : `[sad]${timeRangeText}のエンジニアカフェでの予定されたイベントが見つかりませんでした。最新のイベント情報については、公式ウェブサイトをご確認いただくか、スタッフにお問い合わせください。`;
    
    return createUnifiedResponse(
      text,
      'apologetic',
      'EventAgent',
      language,
      {
        confidence: 0.7,
        category: 'events',
        sources: ['calendar', 'knowledge_base']
      }
    );
  }
}