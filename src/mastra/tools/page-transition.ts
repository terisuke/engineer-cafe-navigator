import { z } from 'zod';

export class PageTransitionTool {
  name = 'page-transition';
  description = 'Handle navigation between different pages and modes';

  schema = z.object({
    action: z.enum([
      'navigate',
      'getCurrentPage',
      'getNavigationHistory',
      'canNavigate',
      'setPageData',
      'getPageData'
    ]),
    targetPage: z.enum([
      'welcome',
      'slides',
      'qa',
      'registration',
      'contact',
      'settings',
      'staff'
    ]).optional(),
    transition: z.enum(['fade', 'slide', 'instant']).optional().default('fade'),
    direction: z.enum(['forward', 'backward']).optional().default('forward'),
    pageData: z.any().optional().describe('Data to pass to the target page'),
    saveHistory: z.boolean().optional().default(true).describe('Whether to save this navigation in history'),
  });

  private currentPage: string = 'welcome';
  private navigationHistory: Array<{
    page: string;
    timestamp: Date;
    data?: any;
  }> = [];
  private pageData: Record<string, any> = {};

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const { action } = params;

      switch (action) {
        case 'navigate':
          return await this.navigate(
            params.targetPage!,
            params.transition,
            params.direction,
            params.pageData,
            params.saveHistory
          );
        case 'getCurrentPage':
          return await this.getCurrentPage();
        case 'getNavigationHistory':
          return await this.getNavigationHistory();
        case 'canNavigate':
          return await this.canNavigate(params.targetPage!);
        case 'setPageData':
          return await this.setPageData(params.targetPage!, params.pageData);
        case 'getPageData':
          return await this.getPageData(params.targetPage!);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Page transition error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async navigate(
    targetPage: string,
    transition?: 'fade' | 'slide' | 'instant',
    direction?: 'forward' | 'backward',
    pageData?: any,
    saveHistory?: boolean
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // Validate target page
      const validPages = ['welcome', 'slides', 'qa', 'registration', 'contact', 'settings', 'staff'];
      if (!validPages.includes(targetPage)) {
        return {
          success: false,
          error: `Invalid target page: ${targetPage}. Valid pages: ${validPages.join(', ')}`,
        };
      }

      // Check if navigation is allowed
      const canNavigateResult = await this.canNavigate(targetPage);
      if (!canNavigateResult.result.canNavigate) {
        return {
          success: false,
          error: canNavigateResult.result.reason,
        };
      }

      const previousPage = this.currentPage;
      
      // Save to history if requested
      if (saveHistory) {
        this.navigationHistory.push({
          page: previousPage,
          timestamp: new Date(),
          data: this.pageData[previousPage],
        });

        // Keep only last 20 entries
        if (this.navigationHistory.length > 20) {
          this.navigationHistory.shift();
        }
      }

      // Store page data if provided
      if (pageData) {
        this.pageData[targetPage] = pageData;
      }

      // Update current page
      this.currentPage = targetPage;

      // Get transition message
      const transitionMessage = this.getTransitionMessage(previousPage, targetPage);

      return {
        success: true,
        result: {
          previousPage,
          currentPage: targetPage,
          transition: transition || 'fade',
          direction: direction || 'forward',
          transitionMessage,
          pageData: this.pageData[targetPage],
          canGoBack: this.navigationHistory.length > 0,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async getCurrentPage(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const pageInfo = this.getPageInfo(this.currentPage);

    return {
      success: true,
      result: {
        currentPage: this.currentPage,
        pageInfo,
        pageData: this.pageData[this.currentPage],
        canGoBack: this.navigationHistory.length > 0,
        historyLength: this.navigationHistory.length,
      },
    };
  }

  private async getNavigationHistory(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    return {
      success: true,
      result: {
        history: [...this.navigationHistory],
        currentPage: this.currentPage,
        historyLength: this.navigationHistory.length,
      },
    };
  }

  private async canNavigate(targetPage: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    let canNavigate = true;
    let reason = '';

    // Define navigation rules
    const navigationRules = {
      // From welcome page
      welcome: ['slides', 'qa', 'contact', 'settings'],
      // From slides page
      slides: ['welcome', 'qa', 'registration', 'contact'],
      // From Q&A page
      qa: ['welcome', 'slides', 'staff', 'contact'],
      // From registration page
      registration: ['welcome', 'slides', 'contact'],
      // From contact page
      contact: ['welcome', 'slides', 'qa'],
      // From settings page
      settings: ['welcome'],
      // From staff page
      staff: ['qa', 'welcome'],
    };

    const allowedFromCurrent = navigationRules[this.currentPage as keyof typeof navigationRules] || [];
    
    if (!allowedFromCurrent.includes(targetPage)) {
      canNavigate = false;
      reason = `Cannot navigate from ${this.currentPage} to ${targetPage}`;
    }

    // Special conditions
    if (targetPage === 'staff' && this.currentPage !== 'qa') {
      canNavigate = false;
      reason = 'Staff page can only be accessed from Q&A page';
    }

    if (targetPage === 'registration' && this.currentPage !== 'slides') {
      canNavigate = false;
      reason = 'Registration can only be accessed after viewing slides';
    }

    return {
      success: true,
      result: {
        canNavigate,
        reason,
        currentPage: this.currentPage,
        targetPage,
        allowedPages: allowedFromCurrent,
      },
    };
  }

  private async setPageData(page: string, data: any): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    this.pageData[page] = data;

    return {
      success: true,
      result: {
        page,
        dataSet: true,
      },
    };
  }

  private async getPageData(page: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const data = this.pageData[page];

    return {
      success: true,
      result: {
        page,
        data,
        hasData: data !== undefined,
      },
    };
  }

  private getPageInfo(page: string) {
    const pageInfoMap = {
      welcome: {
        title: 'Welcome',
        titleJa: 'ようこそ',
        description: 'Engineer Cafe introduction and language selection',
        descriptionJa: 'エンジニアカフェのご紹介と言語選択',
        features: ['language-selection', 'welcome-message', 'navigation-menu'],
      },
      slides: {
        title: 'Presentation',
        titleJa: 'プレゼンテーション',
        description: 'Interactive slide presentation about Engineer Cafe',
        descriptionJa: 'エンジニアカフェについてのインタラクティブなスライド',
        features: ['marp-slides', 'voice-narration', 'slide-navigation', 'character-animation'],
      },
      qa: {
        title: 'Questions & Answers',
        titleJa: '質問・回答',
        description: 'Ask questions about Engineer Cafe services',
        descriptionJa: 'エンジニアカフェのサービスについて質問',
        features: ['voice-qa', 'rag-search', 'multi-language', 'staff-escalation'],
      },
      registration: {
        title: 'Registration',
        titleJa: '新規登録',
        description: 'Complete your Engineer Cafe registration',
        descriptionJa: 'エンジニアカフェの新規登録を完了',
        features: ['guided-registration', 'form-filling', 'verification'],
      },
      contact: {
        title: 'Contact Information',
        titleJa: '連絡先情報',
        description: 'Engineer Cafe contact details and location',
        descriptionJa: 'エンジニアカフェの連絡先と場所',
        features: ['contact-details', 'map', 'hours'],
      },
      settings: {
        title: 'Settings',
        titleJa: '設定',
        description: 'Adjust language and accessibility settings',
        descriptionJa: '言語とアクセシビリティの設定',
        features: ['language-switch', 'voice-settings', 'accessibility'],
      },
      staff: {
        title: 'Staff Assistance',
        titleJa: 'スタッフサポート',
        description: 'Connect with Engineer Cafe staff',
        descriptionJa: 'エンジニアカフェスタッフとの連携',
        features: ['staff-notification', 'escalation', 'real-time-chat'],
      },
    };

    return pageInfoMap[page as keyof typeof pageInfoMap] || {
      title: 'Unknown Page',
      titleJa: '不明なページ',
      description: 'Page information not available',
      descriptionJa: 'ページ情報が利用できません',
      features: [],
    };
  }

  private getTransitionMessage(fromPage: string, toPage: string): string {
    const messages = {
      'welcome->slides': {
        en: "Let's begin with our presentation about Engineer Cafe.",
        ja: "エンジニアカフェのプレゼンテーションを始めましょう。",
      },
      'welcome->qa': {
        en: "What would you like to know about Engineer Cafe?",
        ja: "エンジニアカフェについて何をお知りになりたいですか？",
      },
      'slides->qa': {
        en: "Do you have any questions about what we've presented?",
        ja: "ご紹介した内容について何かご質問はございますか？",
      },
      'slides->registration': {
        en: "Great! Let's get you registered at Engineer Cafe.",
        ja: "素晴らしい！エンジニアカフェに登録しましょう。",
      },
      'qa->staff': {
        en: "I'll connect you with our staff for detailed assistance.",
        ja: "詳しいサポートのためスタッフにお繋ぎいたします。",
      },
      'qa->welcome': {
        en: "Returning to the main menu.",
        ja: "メインメニューに戻ります。",
      },
    };

    const key = `${fromPage}->${toPage}`;
    const message = messages[key as keyof typeof messages];
    
    // Return Japanese by default, could be made configurable
    return message?.ja || `Navigating from ${fromPage} to ${toPage}`;
  }

  async goBack(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    if (this.navigationHistory.length === 0) {
      return {
        success: false,
        error: 'No navigation history available',
      };
    }

    const previousEntry = this.navigationHistory.pop()!;
    const currentPage = this.currentPage;
    
    this.currentPage = previousEntry.page;
    
    // Restore page data if available
    if (previousEntry.data) {
      this.pageData[previousEntry.page] = previousEntry.data;
    }

    return {
      success: true,
      result: {
        previousPage: currentPage,
        currentPage: this.currentPage,
        transition: 'slide',
        direction: 'backward',
        restoredData: previousEntry.data,
        canGoBack: this.navigationHistory.length > 0,
      },
    };
  }

  async clearHistory(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    this.navigationHistory = [];
    
    return {
      success: true,
      result: {
        historyCleared: true,
      },
    };
  }

  async getAvailablePages(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const canNavigateResult = await this.canNavigate('welcome');
    const allowedPages = canNavigateResult.result.allowedPages || [];
    
    const pageDetails = allowedPages.map((page: any) => ({
      page,
      info: this.getPageInfo(page),
    }));

    return {
      success: true,
      result: {
        currentPage: this.currentPage,
        availablePages: allowedPages,
        pageDetails,
      },
    };
  }
}
