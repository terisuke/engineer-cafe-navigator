import { z } from 'zod';
import { withRetry } from '../../lib/retry-utils';

// Cache configuration
const CACHE_DURATION = {
  EVENTS: 15 * 60 * 1000,        // 15 minutes for event data
  CALENDAR: 5 * 60 * 1000,       // 5 minutes for calendar data
  WEBSITE: 30 * 60 * 1000,       // 30 minutes for website content
  FACILITY: 5 * 60 * 1000,       // 5 minutes for facility status
};

interface CachedData {
  data: any;
  timestamp: number;
  ttl: number;
}

interface EventData {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  startTime: Date;
  endTime: Date;
  location: string;
  locationEn?: string;
  organizer: string;
  capacity?: number;
  currentAttendees?: number;
  eventType: string;
  tags: string[];
  url?: string;
}

interface FacilityStatus {
  isOpen: boolean;
  openingTime: string;
  closingTime: string;
  currentOccupancy: number;
  maxOccupancy: number;
  availableResources: {
    meetingRooms: number;
    workstations: number;
    _3dPrinters: number;
    laserCutters: number;
  };
  announcements: Array<{
    id: string;
    message: string;
    messageEn?: string;
    priority: 'low' | 'medium' | 'high';
    createdAt: Date;
  }>;
}

export class ExternalDataFetcherTool {
  name = 'external-data-fetcher';
  description = 'Fetch real-time data from external sources (Connpass, Google Calendar, Engineer Cafe website)';

  private cache = new Map<string, CachedData>();
  private config: any;

  schema = z.object({
    action: z.enum([
      'fetchConnpassEvents',
      'fetchGoogleCalendarEvents',
      'fetchWebsiteContent',
      'getFacilityStatus',
      'getLatestAnnouncements',
      'searchEvents'
    ]),
    language: z.enum(['ja', 'en']).optional().default('ja'),
    searchQuery: z.string().optional().describe('Search query for events'),
    dateRange: z.object({
      start: z.string().optional().describe('Start date in ISO format'),
      end: z.string().optional().describe('End date in ISO format')
    }).optional(),
    eventType: z.enum(['workshop', 'seminar', 'meetup', 'hackathon', 'all']).optional().default('all'),
    limit: z.number().optional().default(10).describe('Maximum number of results'),
  });

  constructor(config: any) {
    this.config = config;
  }

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    cached?: boolean;
  }> {
    try {
      const { action, language } = params;

      switch (action) {
        case 'fetchConnpassEvents':
          return await this.fetchConnpassEvents(params);
        case 'fetchGoogleCalendarEvents':
          return await this.fetchGoogleCalendarEvents(params);
        case 'fetchWebsiteContent':
          return await this.fetchWebsiteContent(language);
        case 'getFacilityStatus':
          return await this.getFacilityStatus(language);
        case 'getLatestAnnouncements':
          return await this.getLatestAnnouncements(language);
        case 'searchEvents':
          return await this.searchEvents(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('External data fetcher error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getCacheKey(action: string, params?: any): string {
    return `${action}_${JSON.stringify(params || {})}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, cached] of entries) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private async fetchConnpassEvents(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    data?: EventData[];
    error?: string;
    cached?: boolean;
  }> {
    const cacheKey = this.getCacheKey('connpass', params);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }

    try {
      // Connpass API parameters
      const searchParams = new URLSearchParams({
        keyword: 'エンジニアカフェ OR Engineer Cafe OR 熊本',
        count: String(params.limit || 10),
        order: '2', // Order by start date
      });

      if (params.searchQuery) {
        searchParams.set('keyword', params.searchQuery);
      }

      const response = await withRetry(
        async () => {
          const res = await fetch(`https://connpass.com/api/v1/event/?${searchParams}`, {
            headers: {
              'User-Agent': 'Engineer-Cafe-Navigator/1.0',
            },
          });
          if (!res.ok) throw new Error(`Connpass API error: ${res.status}`);
          return res.json();
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
        }
      );

      const events: EventData[] = response.events.map((event: any) => ({
        id: `connpass_${event.event_id}`,
        title: event.title,
        titleEn: this.translateTitle(event.title, params.language),
        description: event.description || event.catch || '',
        descriptionEn: params.language === 'en' ? this.translateDescription(event.description || event.catch || '') : undefined,
        startTime: new Date(event.started_at),
        endTime: new Date(event.ended_at),
        location: event.place || event.address || 'オンライン',
        locationEn: this.translateLocation(event.place || event.address || 'オンライン'),
        organizer: event.owner_display_name || event.owner_nickname,
        capacity: event.limit,
        currentAttendees: event.accepted,
        eventType: this.detectEventType(event.title, event.description),
        tags: event.hash_tag ? event.hash_tag.split(/\s+/) : [],
        url: event.event_url,
      }));

      // Filter by date range if provided
      let filteredEvents = events;
      if (params.dateRange) {
        const startDate = params.dateRange.start ? new Date(params.dateRange.start) : new Date();
        const endDate = params.dateRange.end ? new Date(params.dateRange.end) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        
        filteredEvents = events.filter(event => 
          event.startTime >= startDate && event.startTime <= endDate
        );
      }

      // Filter by event type if not 'all'
      if (params.eventType && params.eventType !== 'all') {
        filteredEvents = filteredEvents.filter(event => event.eventType === params.eventType);
      }

      this.setCache(cacheKey, filteredEvents, CACHE_DURATION.EVENTS);

      return {
        success: true,
        data: filteredEvents,
        cached: false,
      };
    } catch (error) {
      console.error('Failed to fetch Connpass events:', error);
      throw error;
    }
  }

  private async fetchGoogleCalendarEvents(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    data?: EventData[];
    error?: string;
    cached?: boolean;
  }> {
    const cacheKey = this.getCacheKey('calendar', params);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }

    try {
      // For now, return mock data as Google Calendar API requires authentication
      // In production, this would use the Google Calendar API with proper credentials
      const mockEvents: EventData[] = [
        {
          id: 'gcal_1',
          title: '3Dプリンター講習会',
          titleEn: '3D Printer Workshop',
          description: '初心者向け3Dプリンターの使い方講習会です。',
          descriptionEn: 'Beginner-friendly workshop on how to use 3D printers.',
          startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          location: 'エンジニアカフェ 3Dプリンタールーム',
          locationEn: 'Engineer Cafe 3D Printer Room',
          organizer: 'エンジニアカフェスタッフ',
          capacity: 10,
          currentAttendees: 7,
          eventType: 'workshop',
          tags: ['3Dプリンター', '講習会', '初心者歓迎'],
        },
        {
          id: 'gcal_2',
          title: 'AI/機械学習勉強会',
          titleEn: 'AI/Machine Learning Study Group',
          description: 'PyTorchを使った機械学習の基礎を学びます。',
          descriptionEn: 'Learn the basics of machine learning using PyTorch.',
          startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
          location: 'エンジニアカフェ セミナールーム',
          locationEn: 'Engineer Cafe Seminar Room',
          organizer: '熊本AI研究会',
          capacity: 30,
          currentAttendees: 22,
          eventType: 'seminar',
          tags: ['AI', '機械学習', 'PyTorch'],
        },
      ];

      // Apply filters
      let filteredEvents = mockEvents;
      if (params.dateRange) {
        const startDate = params.dateRange.start ? new Date(params.dateRange.start) : new Date();
        const endDate = params.dateRange.end ? new Date(params.dateRange.end) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        
        filteredEvents = mockEvents.filter(event => 
          event.startTime >= startDate && event.startTime <= endDate
        );
      }

      if (params.eventType && params.eventType !== 'all') {
        filteredEvents = filteredEvents.filter(event => event.eventType === params.eventType);
      }

      this.setCache(cacheKey, filteredEvents, CACHE_DURATION.CALENDAR);

      return {
        success: true,
        data: filteredEvents.slice(0, params.limit),
        cached: false,
      };
    } catch (error) {
      console.error('Failed to fetch Google Calendar events:', error);
      throw error;
    }
  }

  private async fetchWebsiteContent(language: 'ja' | 'en'): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    cached?: boolean;
  }> {
    const cacheKey = this.getCacheKey('website', { language });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }

    try {
      // For now, return structured content about Engineer Cafe
      // In production, this would scrape the actual website
      const content = {
        about: language === 'ja' 
          ? 'エンジニアカフェは、エンジニアやクリエイターが集まり、交流し、新しいアイデアを生み出す場所です。'
          : 'Engineer Cafe is a place where engineers and creators gather, interact, and generate new ideas.',
        facilities: language === 'ja' ? [
          { name: 'コワーキングスペース', description: '快適な作業環境で集中して開発ができます。' },
          { name: '3Dプリンター', description: '最新の3Dプリンターでプロトタイプを作成できます。' },
          { name: 'レーザーカッター', description: '精密な加工が可能なレーザーカッターを利用できます。' },
          { name: 'セミナールーム', description: '勉強会やワークショップに最適な空間です。' },
        ] : [
          { name: 'Coworking Space', description: 'Focus on development in a comfortable work environment.' },
          { name: '3D Printers', description: 'Create prototypes with our latest 3D printers.' },
          { name: 'Laser Cutters', description: 'Use precision laser cutters for detailed work.' },
          { name: 'Seminar Room', description: 'Perfect space for study groups and workshops.' },
        ],
        openingHours: {
          weekdays: '10:00 - 22:00',
          weekends: '10:00 - 20:00',
          holidays: language === 'ja' ? '休館日あり' : 'Closed on some holidays',
        },
        contact: {
          email: 'info@engineer-cafe.jp',
          phone: '096-xxx-xxxx',
          address: language === 'ja' 
            ? '熊本県熊本市中央区xxx'
            : 'Chuo-ku, Kumamoto City, Kumamoto Prefecture',
        },
      };

      this.setCache(cacheKey, content, CACHE_DURATION.WEBSITE);

      return {
        success: true,
        data: content,
        cached: false,
      };
    } catch (error) {
      console.error('Failed to fetch website content:', error);
      throw error;
    }
  }

  private async getFacilityStatus(language: 'ja' | 'en'): Promise<{
    success: boolean;
    data?: FacilityStatus;
    error?: string;
    cached?: boolean;
  }> {
    const cacheKey = this.getCacheKey('facility', { language });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }

    try {
      // Mock facility status - in production, this would connect to the actual facility management system
      const now = new Date();
      const hour = now.getHours();
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      
      const openingTime = '10:00';
      const closingTime = isWeekend ? '20:00' : '22:00';
      const isOpen = hour >= 10 && hour < (isWeekend ? 20 : 22);

      const status: FacilityStatus = {
        isOpen,
        openingTime,
        closingTime,
        currentOccupancy: Math.floor(Math.random() * 50) + 20,
        maxOccupancy: 100,
        availableResources: {
          meetingRooms: Math.floor(Math.random() * 3) + 1,
          workstations: Math.floor(Math.random() * 20) + 5,
          _3dPrinters: Math.floor(Math.random() * 2) + 1,
          laserCutters: Math.floor(Math.random() * 2),
        },
        announcements: [
          {
            id: 'ann_1',
            message: language === 'ja' 
              ? '本日18時より、AI勉強会を開催します。' 
              : 'AI study group will be held at 6 PM today.',
            messageEn: 'AI study group will be held at 6 PM today.',
            priority: 'medium',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
        ],
      };

      this.setCache(cacheKey, status, CACHE_DURATION.FACILITY);

      return {
        success: true,
        data: status,
        cached: false,
      };
    } catch (error) {
      console.error('Failed to get facility status:', error);
      throw error;
    }
  }

  private async getLatestAnnouncements(language: 'ja' | 'en'): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
    cached?: boolean;
  }> {
    // 例: 外部HTMLから取得する場合
    // const html = await fetch('https://engineer-cafe.jp/announcements').then(res => res.text());
    // const $ = cheerio.load(html);
    // const announcements = $('.announcement').map((i, el) => ({
    //   id: $(el).attr('data-id'),
    //   message: $(el).find('.message').text(),
    //   createdAt: $(el).find('.date').text(),
    //   priority: $(el).find('.priority').text() as 'low' | 'medium' | 'high',
    // })).get();
    // return { success: true, data: announcements };

    // 既存のFacilityStatusから取得する場合
    const facilityStatus = await this.getFacilityStatus(language);
    if (!facilityStatus.success || !facilityStatus.data) {
      return {
        success: false,
        error: 'Failed to fetch announcements',
      };
    }
    // ここでHTMLが入っている場合はcheerioでパースして構造化データにする
    // 例: facilityStatus.data.announcementsHtml
    // if (facilityStatus.data.announcementsHtml) {
    //   const $ = cheerio.load(facilityStatus.data.announcementsHtml);
    //   const announcements = $('.announcement').map((i, el) => ({
    //     id: $(el).attr('data-id'),
    //     message: $(el).find('.message').text(),
    //     createdAt: $(el).find('.date').text(),
    //     priority: $(el).find('.priority').text() as 'low' | 'medium' | 'high',
    //   })).get();
    //   return { success: true, data: announcements, cached: facilityStatus.cached };
    // }
    // 既存の構造化データをそのまま返す
    return {
      success: true,
      data: facilityStatus.data.announcements,
      cached: facilityStatus.cached,
    };
  }

  private async searchEvents(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    data?: EventData[];
    error?: string;
    cached?: boolean;
  }> {
    try {
      // Combine results from multiple sources
      const [connpassResult, calendarResult] = await Promise.all([
        this.fetchConnpassEvents(params),
        this.fetchGoogleCalendarEvents(params),
      ]);

      const allEvents: EventData[] = [];
      
      if (connpassResult.success && connpassResult.data) {
        allEvents.push(...connpassResult.data);
      }
      
      if (calendarResult.success && calendarResult.data) {
        allEvents.push(...calendarResult.data);
      }

      // Sort by start time
      allEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      // Apply search query if provided
      let filteredEvents = allEvents;
      if (params.searchQuery) {
        const query = params.searchQuery.toLowerCase();
        filteredEvents = allEvents.filter(event => 
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          event.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }

      return {
        success: true,
        data: filteredEvents.slice(0, params.limit),
        cached: false,
      };
    } catch (error) {
      console.error('Failed to search events:', error);
      throw error;
    }
  }

  private detectEventType(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.includes('ワークショップ') || text.includes('workshop') || text.includes('講習')) {
      return 'workshop';
    } else if (text.includes('セミナー') || text.includes('seminar') || text.includes('講演')) {
      return 'seminar';
    } else if (text.includes('もくもく') || text.includes('meetup') || text.includes('交流')) {
      return 'meetup';
    } else if (text.includes('ハッカソン') || text.includes('hackathon')) {
      return 'hackathon';
    }
    
    return 'meetup'; // Default
  }

  private translateTitle(title: string, targetLang: 'ja' | 'en'): string | undefined {
    if (targetLang === 'ja') return undefined;
    
    // Simple translation mapping for common terms
    const translations: Record<string, string> = {
      'エンジニアカフェ': 'Engineer Cafe',
      '勉強会': 'Study Group',
      'もくもく会': 'Silent Work Session',
      'ハンズオン': 'Hands-on',
      '初心者': 'Beginner',
      '入門': 'Introduction',
    };

    let translated = title;
    for (const [ja, en] of Object.entries(translations)) {
      translated = translated.replace(ja, en);
    }

    return translated !== title ? translated : undefined;
  }

  private translateDescription(description: string): string {
    // In production, this would use a proper translation service
    // For now, return a simple notice
    return 'Please refer to the Japanese description for details.';
  }

  private translateLocation(location: string): string {
    const translations: Record<string, string> = {
      'エンジニアカフェ': 'Engineer Cafe',
      'オンライン': 'Online',
      'セミナールーム': 'Seminar Room',
      '会議室': 'Meeting Room',
      'コワーキングスペース': 'Coworking Space',
    };

    let translated = location;
    for (const [ja, en] of Object.entries(translations)) {
      translated = translated.replace(ja, en);
    }

    return translated;
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
  }

  async getCacheInfo(): Promise<{
    size: number;
    entries: Array<{ key: string; age: number }>;
  }> {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, cached]) => ({
      key,
      age: Math.floor((now - cached.timestamp) / 1000), // Age in seconds
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}