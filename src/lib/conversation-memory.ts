export interface ConversationEntry {
  id: string;
  timestamp: number;
  userInput: string;
  aiResponse: string;
  emotion: string;
  language: 'ja' | 'en';
  responseTime: number;
  cached: boolean;
}

export interface ConversationContext {
  recentTopics: string[];
  userPreferences: {
    preferredLanguage: 'ja' | 'en';
    commonEmotions: string[];
    responseStyle: 'formal' | 'casual' | 'technical';
  };
  sessionMetadata: {
    startTime: number;
    totalInteractions: number;
    averageResponseTime: number;
  };
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  language: 'ja' | 'en';
  audioBase64?: string;
  emotion: string;
  useCount: number;
  lastUsed: number;
}

export class ConversationMemory {
  private static readonly MEMORY_PREFIX = 'engineer_cafe_memory_';
  private static readonly FAQ_PREFIX = 'engineer_cafe_faq_';
  private static readonly CONTEXT_KEY = 'engineer_cafe_context';
  private static readonly MAX_CONVERSATION_HISTORY = 50;
  private static readonly MAX_FAQ_ENTRIES = 200;

  // よくある質問のデータベース
  private static readonly PREDEFINED_FAQ: FAQEntry[] = [
    // プログラミング関連
    {
      id: 'prog_1',
      question: 'JavaScriptとPythonの違いは何ですか？',
      answer: 'JavaScriptは主にWebブラウザで動作するスクリプト言語で、ウェブページのインタラクティブな要素を作るのに使います。Pythonはより汎用的なプログラミング言語で、AI開発、データ分析、Webアプリケーション開発など幅広い分野で使われています♪',
      keywords: ['JavaScript', 'Python', '違い', '比較', 'プログラミング言語'],
      category: 'programming',
      language: 'ja',
      emotion: 'knowledgeable',
      useCount: 0,
      lastUsed: 0
    },
    {
      id: 'prog_2',
      question: 'What is the difference between JavaScript and Python?',
      answer: 'JavaScript is primarily a scripting language that runs in web browsers, used to create interactive elements on web pages. Python is a more general-purpose programming language used in AI development, data analysis, web application development, and many other fields♪',
      keywords: ['JavaScript', 'Python', 'difference', 'comparison', 'programming language'],
      category: 'programming',
      language: 'en',
      emotion: 'knowledgeable',
      useCount: 0,
      lastUsed: 0
    },
    {
      id: 'prog_3',
      question: 'どのプログラミング言語から始めればいいですか？',
      answer: '初心者の方には、Pythonをおすすめします！文法がシンプルで読みやすく、AI開発からWebアプリまで幅広く使えるんです。JavaScriptも良い選択肢で、すぐにブラウザで結果を見ることができるので楽しく学習できますよ♪',
      keywords: ['初心者', '始める', 'プログラミング言語', 'おすすめ', '学習'],
      category: 'programming',
      language: 'ja',
      emotion: 'supportive',
      useCount: 0,
      lastUsed: 0
    },
    {
      id: 'prog_4',
      question: 'Which programming language should I start with?',
      answer: 'For beginners, I recommend Python! It has simple, readable syntax and can be used for everything from AI development to web apps. JavaScript is also a great choice since you can see results immediately in the browser, making learning fun♪',
      keywords: ['beginner', 'start', 'programming language', 'recommend', 'learning'],
      category: 'programming',
      language: 'en',
      emotion: 'supportive',
      useCount: 0,
      lastUsed: 0
    },

    // エラー・デバッグ関連
    {
      id: 'debug_1',
      question: 'コードにバグがあるときはどうすればいいですか？',
      answer: 'バグは誰にでもあることなので、心配しないでくださいね！まずはエラーメッセージをよく読んで、どの行でエラーが起きているかを確認しましょう。console.logやプリント文でデータの状態を確認するのも効果的です。一緒に解決しましょう！',
      keywords: ['バグ', 'エラー', 'デバッグ', 'トラブルシューティング'],
      category: 'debugging',
      language: 'ja',
      emotion: 'supportive',
      useCount: 0,
      lastUsed: 0
    },
    {
      id: 'debug_2',
      question: 'What should I do when my code has bugs?',
      answer: 'Bugs happen to everyone, so don\'t worry! First, read the error message carefully and identify which line is causing the issue. Using console.log or print statements to check data state is also very effective. Let\'s solve it together!',
      keywords: ['bug', 'error', 'debug', 'troubleshooting'],
      category: 'debugging',
      language: 'en',
      emotion: 'supportive',
      useCount: 0,
      lastUsed: 0
    },

    // Web開発関連
    {
      id: 'web_1',
      question: 'HTMLとCSSの関係は？',
      answer: 'HTMLは家の骨組み、CSSは内装のようなものです！HTMLでページの構造や内容を作り、CSSで見た目やレイアウトを美しく整えます。二つが協力して素敵なウェブページができるんです♪',
      keywords: ['HTML', 'CSS', '関係', 'Web開発', 'フロントエンド'],
      category: 'web',
      language: 'ja',
      emotion: 'excited',
      useCount: 0,
      lastUsed: 0
    },
    {
      id: 'web_2',
      question: 'What is the relationship between HTML and CSS?',
      answer: 'HTML is like the framework of a house, and CSS is like the interior design! HTML creates the structure and content of the page, while CSS makes it look beautiful with styling and layout. Together they create amazing web pages♪',
      keywords: ['HTML', 'CSS', 'relationship', 'web development', 'frontend'],
      category: 'web',
      language: 'en',
      emotion: 'excited',
      useCount: 0,
      lastUsed: 0
    },

    // キャリア・学習関連
    {
      id: 'career_1',
      question: 'プログラマーになるにはどうすればいいですか？',
      answer: 'プログラマーへの道は色々ありますが、まずは好きな分野を見つけることが大切です！Web開発、アプリ開発、AI、ゲーム開発など... 独学でも学校でも、継続的に学習することが一番重要です。一歩ずつ頑張りましょう♪',
      keywords: ['プログラマー', 'キャリア', '就職', '学習方法'],
      category: 'career',
      language: 'ja',
      emotion: 'enthusiastic',
      useCount: 0,
      lastUsed: 0
    },
    {
      id: 'career_2',
      question: 'How do I become a programmer?',
      answer: 'There are many paths to becoming a programmer, but first it\'s important to find an area you enjoy! Web development, app development, AI, game development... Whether self-taught or through school, continuous learning is most important. Let\'s take it step by step♪',
      keywords: ['programmer', 'career', 'job', 'learning'],
      category: 'career',
      language: 'en',
      emotion: 'enthusiastic',
      useCount: 0,
      lastUsed: 0
    },

    // モチベーション・励まし
    {
      id: 'motivation_1',
      question: 'プログラミングが難しくて挫折しそうです',
      answer: 'その気持ち、とてもよく分かります！プログラミングは最初は難しく感じるものですが、少しずつ理解できるようになってきます。小さな成功を積み重ねることが大切です。私も一緒に応援しますので、諦めずに頑張りましょう！',
      keywords: ['難しい', '挫折', 'モチベーション', '励まし'],
      category: 'motivation',
      language: 'ja',
      emotion: 'supportive',
      useCount: 0,
      lastUsed: 0
    },
    {
      id: 'motivation_2',
      question: 'Programming is too difficult and I want to give up',
      answer: 'I completely understand that feeling! Programming can seem difficult at first, but you\'ll gradually start to understand it better. Building small successes is important. I\'ll cheer you on too, so let\'s not give up and keep trying!',
      keywords: ['difficult', 'give up', 'motivation', 'encouragement'],
      category: 'motivation',
      language: 'en',
      emotion: 'supportive',
      useCount: 0,
      lastUsed: 0
    }
  ];

  // 会話履歴を保存
  static saveConversation(entry: Omit<ConversationEntry, 'id' | 'timestamp'>): void {
    try {
      const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const conversation: ConversationEntry = {
        ...entry,
        id,
        timestamp: Date.now()
      };

      const conversations = this.getConversationHistory();
      conversations.unshift(conversation);

      // 最大履歴数を超えた場合は古いものを削除
      if (conversations.length > this.MAX_CONVERSATION_HISTORY) {
        conversations.splice(this.MAX_CONVERSATION_HISTORY);
      }

      localStorage.setItem(
        `${this.MEMORY_PREFIX}conversations`,
        JSON.stringify(conversations)
      );

      // コンテキストを更新
      this.updateContext(conversation);
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }

  // 会話履歴を取得
  static getConversationHistory(): ConversationEntry[] {
    try {
      const stored = localStorage.getItem(`${this.MEMORY_PREFIX}conversations`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }

  // コンテキストを更新
  private static updateContext(conversation: ConversationEntry): void {
    try {
      const context = this.getContext();
      
      // 最近のトピックを更新
      const topics = this.extractTopics(conversation.userInput);
      topics.forEach(topic => {
        if (!context.recentTopics.includes(topic)) {
          context.recentTopics.unshift(topic);
        }
      });
      
      // 最大10個のトピックを保持
      if (context.recentTopics.length > 10) {
        context.recentTopics.splice(10);
      }

      // ユーザー設定を更新
      context.userPreferences.preferredLanguage = conversation.language;
      
      if (!context.userPreferences.commonEmotions.includes(conversation.emotion)) {
        context.userPreferences.commonEmotions.push(conversation.emotion);
      }

      // セッションメタデータを更新
      context.sessionMetadata.totalInteractions++;
      
      const avgResponseTime = context.sessionMetadata.averageResponseTime;
      const totalInteractions = context.sessionMetadata.totalInteractions;
      context.sessionMetadata.averageResponseTime = 
        (avgResponseTime * (totalInteractions - 1) + conversation.responseTime) / totalInteractions;

      localStorage.setItem(this.CONTEXT_KEY, JSON.stringify(context));
    } catch (error) {
      console.error('Failed to update context:', error);
    }
  }

  // コンテキストを取得
  static getContext(): ConversationContext {
    try {
      const stored = localStorage.getItem(this.CONTEXT_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to get context:', error);
    }

    // デフォルトコンテキスト
    return {
      recentTopics: [],
      userPreferences: {
        preferredLanguage: 'ja',
        commonEmotions: ['gentle'],
        responseStyle: 'casual'
      },
      sessionMetadata: {
        startTime: Date.now(),
        totalInteractions: 0,
        averageResponseTime: 0
      }
    };
  }

  // トピックを抽出
  private static extractTopics(text: string): string[] {
    const topics: string[] = [];
    const keywords = {
      ja: {
        'プログラミング': ['プログラム', 'コード', 'コーディング', 'プログラミング'],
        'Web開発': ['HTML', 'CSS', 'JavaScript', 'Web', 'ウェブ'],
        'AI': ['AI', '人工知能', '機械学習', 'ML'],
        'データベース': ['データベース', 'DB', 'SQL'],
        'モバイル': ['アプリ', 'スマホ', 'モバイル', 'iOS', 'Android'],
        'ゲーム': ['ゲーム', 'Unity', 'ゲーム開発']
      },
      en: {
        'Programming': ['program', 'code', 'coding', 'programming'],
        'Web Development': ['HTML', 'CSS', 'JavaScript', 'web'],
        'AI': ['AI', 'artificial intelligence', 'machine learning', 'ML'],
        'Database': ['database', 'DB', 'SQL'],
        'Mobile': ['app', 'mobile', 'iOS', 'Android'],
        'Game': ['game', 'Unity', 'game development']
      }
    };

    const textLower = text.toLowerCase();
    Object.entries(keywords.ja).forEach(([topic, words]) => {
      if (words.some(word => textLower.includes(word.toLowerCase()))) {
        topics.push(topic);
      }
    });

    Object.entries(keywords.en).forEach(([topic, words]) => {
      if (words.some(word => textLower.includes(word.toLowerCase()))) {
        topics.push(topic);
      }
    });

    return topics;
  }

  // FAQ検索
  static searchFAQ(query: string, language: 'ja' | 'en'): FAQEntry | null {
    try {
      // カスタムFAQから検索
      const customFAQs = this.getCustomFAQs();
      const allFAQs = [...this.PREDEFINED_FAQ, ...customFAQs];
      
      const languageFAQs = allFAQs.filter(faq => faq.language === language);
      const queryLower = query.toLowerCase();

      // 完全一致検索
      let match = languageFAQs.find(faq => 
        faq.question.toLowerCase().includes(queryLower) ||
        faq.keywords.some(keyword => queryLower.includes(keyword.toLowerCase()))
      );

      // 部分一致検索
      if (!match) {
        match = languageFAQs.find(faq => 
          faq.keywords.some(keyword => 
            queryLower.includes(keyword.toLowerCase()) ||
            keyword.toLowerCase().includes(queryLower)
          )
        );
      }

      if (match) {
        // 使用回数と最終使用時刻を更新
        match.useCount++;
        match.lastUsed = Date.now();
        this.updateFAQ(match);
      }

      return match || null;
    } catch (error) {
      console.error('Failed to search FAQ:', error);
      return null;
    }
  }

  // カスタムFAQを取得
  private static getCustomFAQs(): FAQEntry[] {
    try {
      const stored = localStorage.getItem(`${this.FAQ_PREFIX}custom`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get custom FAQs:', error);
      return [];
    }
  }

  // FAQを更新
  private static updateFAQ(faq: FAQEntry): void {
    try {
      // 定義済みFAQの場合
      const predefinedIndex = this.PREDEFINED_FAQ.findIndex(f => f.id === faq.id);
      if (predefinedIndex >= 0) {
        this.PREDEFINED_FAQ[predefinedIndex] = faq;
        return;
      }

      // カスタムFAQの場合
      const customFAQs = this.getCustomFAQs();
      const customIndex = customFAQs.findIndex(f => f.id === faq.id);
      if (customIndex >= 0) {
        customFAQs[customIndex] = faq;
        localStorage.setItem(`${this.FAQ_PREFIX}custom`, JSON.stringify(customFAQs));
      }
    } catch (error) {
      console.error('Failed to update FAQ:', error);
    }
  }

  // 新しいFAQを追加
  static addCustomFAQ(faq: Omit<FAQEntry, 'id' | 'useCount' | 'lastUsed'>): void {
    try {
      const customFAQs = this.getCustomFAQs();
      const newFAQ: FAQEntry = {
        ...faq,
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        useCount: 0,
        lastUsed: 0
      };

      customFAQs.push(newFAQ);

      // 最大数を超えた場合は使用回数の少ないものから削除
      if (customFAQs.length > this.MAX_FAQ_ENTRIES) {
        customFAQs.sort((a, b) => a.useCount - b.useCount);
        customFAQs.splice(0, customFAQs.length - this.MAX_FAQ_ENTRIES);
      }

      localStorage.setItem(`${this.FAQ_PREFIX}custom`, JSON.stringify(customFAQs));
    } catch (error) {
      console.error('Failed to add custom FAQ:', error);
    }
  }

  // 関連する会話を検索
  static findRelatedConversations(query: string, limit: number = 5): ConversationEntry[] {
    try {
      const conversations = this.getConversationHistory();
      const queryLower = query.toLowerCase();

      return conversations
        .filter(conv => 
          conv.userInput.toLowerCase().includes(queryLower) ||
          conv.aiResponse.toLowerCase().includes(queryLower)
        )
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to find related conversations:', error);
      return [];
    }
  }

  // メモリ使用量統計
  static getMemoryStats(): {
    conversationCount: number;
    faqCount: number;
    totalSize: number;
    oldestConversation?: Date;
  } {
    try {
      const conversations = this.getConversationHistory();
      const customFAQs = this.getCustomFAQs();
      
      let totalSize = 0;
      let oldestTimestamp = Infinity;

      // 会話履歴のサイズ計算
      const conversationData = localStorage.getItem(`${this.MEMORY_PREFIX}conversations`);
      if (conversationData) {
        totalSize += conversationData.length;
      }

      // FAQ データのサイズ計算
      const faqData = localStorage.getItem(`${this.FAQ_PREFIX}custom`);
      if (faqData) {
        totalSize += faqData.length;
      }

      // コンテキストデータのサイズ計算
      const contextData = localStorage.getItem(this.CONTEXT_KEY);
      if (contextData) {
        totalSize += contextData.length;
      }

      // 最古の会話を検索
      conversations.forEach(conv => {
        if (conv.timestamp < oldestTimestamp) {
          oldestTimestamp = conv.timestamp;
        }
      });

      return {
        conversationCount: conversations.length,
        faqCount: this.PREDEFINED_FAQ.length + customFAQs.length,
        totalSize,
        oldestConversation: oldestTimestamp === Infinity ? undefined : new Date(oldestTimestamp)
      };
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return { conversationCount: 0, faqCount: 0, totalSize: 0 };
    }
  }

  // メモリをクリア
  static clearMemory(): void {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.MEMORY_PREFIX) || 
            key.startsWith(this.FAQ_PREFIX) || 
            key === this.CONTEXT_KEY) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear memory:', error);
    }
  }

  // レコメンド機能：よく使われるFAQを取得
  static getPopularFAQs(language: 'ja' | 'en', limit: number = 5): FAQEntry[] {
    try {
      const allFAQs = [...this.PREDEFINED_FAQ, ...this.getCustomFAQs()];
      return allFAQs
        .filter(faq => faq.language === language)
        .sort((a, b) => b.useCount - a.useCount)
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get popular FAQs:', error);
      return [];
    }
  }
}