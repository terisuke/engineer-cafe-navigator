import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '@/mastra/types/config';
import { UnifiedAgentResponse, createUnifiedResponse } from '@/mastra/types/unified-response';

export interface ClarificationAgentConfig {
  llm: {
    model: any;
  };
}

export class ClarificationAgent extends Agent {
  constructor(config: ClarificationAgentConfig) {
    super({
      name: 'ClarificationAgent',
      model: config.llm.model,
      instructions: `You are a clarification specialist for Engineer Cafe.
        When users ask ambiguous questions about "cafe" or "meeting rooms",
        help them specify which facility they're asking about.
        Be friendly and helpful in guiding them to clarify their needs.`,
    });
  }

  async handleClarification(
    query: string,
    category: string,
    language: SupportedLanguage
  ): Promise<UnifiedAgentResponse> {
    const { EmotionTagger } = await import('@/lib/emotion-tagger');

    // Handle cafe clarification
    if (category === 'cafe-clarification-needed') {
      const clarificationMessage = language === 'en'
        ? "I'd be happy to help! Are you asking about:\n1. **Engineer Cafe** (the coworking space) - hours, facilities, usage\n2. **Saino Cafe** (the attached cafe & bar) - menu, hours, prices\n\nPlease let me know which one you're interested in!"
        : "お手伝いさせていただきます！どちらについてお聞きでしょうか：\n1. **エンジニアカフェ**（コワーキングスペース）- 営業時間、設備、利用方法\n2. **サイノカフェ**（併設のカフェ＆バー）- メニュー、営業時間、料金\n\nお聞かせください！";
      
      // Add emotion tag
      const taggedMessage = EmotionTagger.addEmotionTag(clarificationMessage, 'surprised');
      
      return createUnifiedResponse(
        taggedMessage,
        'surprised',
        'ClarificationAgent',
        language,
        {
          confidence: 0.9,
          category: 'cafe-clarification-needed',
          sources: ['clarification_system']
        }
      );
    }

    // Handle meeting room clarification
    if (category === 'meeting-room-clarification-needed') {
      const clarificationMessage = language === 'en'
        ? "I'd be happy to help! We have two types of meeting spaces:\n1. **Paid Meeting Rooms (2F)** - Private rooms with advance booking required (fees apply)\n2. **Basement Meeting Spaces (B1)** - Free open spaces for casual meetings\n\nWhich one would you like to know about?"
        : "お手伝いさせていただきます！会議スペースは2種類ございます：\n1. **有料会議室（2階）** - 事前予約制の個室（有料）\n2. **地下MTGスペース（地下1階）** - カジュアルな打ち合わせ用の無料スペース\n\nどちらについてお知りになりたいですか？";
      
      // Add emotion tag
      const taggedMessage = EmotionTagger.addEmotionTag(clarificationMessage, 'surprised');
      
      return createUnifiedResponse(
        taggedMessage,
        'surprised',
        'ClarificationAgent',
        language,
        {
          confidence: 0.9,
          category: 'meeting-room-clarification-needed',
          sources: ['clarification_system']
        }
      );
    }

    // Default clarification for any other ambiguous queries
    const defaultMessage = language === 'en'
      ? "I'd be happy to help! Could you please provide more details about what you'd like to know?"
      : "お手伝いさせていただきます！もう少し詳しくお聞かせいただけますか？";
    
    // Add emotion tag
    const taggedMessage = EmotionTagger.addEmotionTag(defaultMessage, 'surprised');
    
    return createUnifiedResponse(
      taggedMessage,
      'surprised',
      'ClarificationAgent',
      language,
      {
        confidence: 0.7,
        category: 'general-clarification-needed',
        sources: ['clarification_system']
      }
    );
  }
}