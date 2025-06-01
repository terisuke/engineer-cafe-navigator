import { withRetry } from '../retry-utils';

/**
 * Connpass API client for fetching real event data
 * API Documentation: https://connpass.com/about/api/
 */
export class ConnpassClient {
  private readonly baseUrl = 'https://connpass.com/api/v1/event/';
  private lastRequestTime: number = 0;
  private readonly minRequestInterval = 6000; // 10 requests per minute = 1 request per 6 seconds

  /**
   * Enforce rate limiting: max 10 requests per minute
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Search events on Connpass
   */
  async searchEvents(params: {
    keyword?: string;
    keyword_or?: string[];
    ym?: string; // Format: YYYYMM
    ymd?: string; // Format: YYYYMMDD
    nickname?: string;
    owner_nickname?: string;
    series_id?: number;
    start?: number;
    order?: 1 | 2 | 3; // 1: updated_at, 2: event start date, 3: created_at
    count?: number; // Max 100
  } = {}): Promise<ConnpassEventResponse> {
    await this.enforceRateLimit();

    const queryParams = new URLSearchParams();
    
    // Add parameters
    if (params.keyword) queryParams.append('keyword', params.keyword);
    if (params.keyword_or) queryParams.append('keyword_or', params.keyword_or.join(','));
    if (params.ym) queryParams.append('ym', params.ym);
    if (params.ymd) queryParams.append('ymd', params.ymd);
    if (params.nickname) queryParams.append('nickname', params.nickname);
    if (params.owner_nickname) queryParams.append('owner_nickname', params.owner_nickname);
    if (params.series_id) queryParams.append('series_id', params.series_id.toString());
    if (params.start !== undefined) queryParams.append('start', params.start.toString());
    if (params.order) queryParams.append('order', params.order.toString());
    if (params.count) queryParams.append('count', Math.min(params.count, 100).toString());

    const url = `${this.baseUrl}?${queryParams.toString()}`;

    return withRetry(
      async () => {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EngineerCafeNavigator/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`Connpass API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        retryCondition: (error: any) => {
          // Retry on network errors or 5xx errors
          return error.message.includes('fetch') || error.message.includes('5');
        }
      }
    );
  }

  /**
   * Get events by series ID (e.g., Engineer Cafe events)
   */
  async getEventsBySeries(seriesId: number, options: {
    count?: number;
    includeEnded?: boolean;
  } = {}): Promise<ConnpassEvent[]> {
    const response = await this.searchEvents({
      series_id: seriesId,
      count: options.count || 20,
      order: 2, // Order by event start date
    });

    let events = response.events;

    // Filter out ended events if requested
    if (!options.includeEnded) {
      const now = new Date();
      events = events.filter(event => new Date(event.ended_at) > now);
    }

    return events;
  }

  /**
   * Search for Engineer Cafe related events
   */
  async searchEngineerCafeEvents(options: {
    includeEnded?: boolean;
    count?: number;
  } = {}): Promise<ConnpassEvent[]> {
    const keywords = ['エンジニアカフェ', 'Engineer Cafe', 'engineer-cafe'];
    
    const response = await this.searchEvents({
      keyword_or: keywords,
      count: options.count || 30,
      order: 2,
    });

    let events = response.events;

    if (!options.includeEnded) {
      const now = new Date();
      events = events.filter(event => new Date(event.ended_at) > now);
    }

    return events;
  }

  /**
   * Get events for a specific date
   */
  async getEventsByDate(date: Date): Promise<ConnpassEvent[]> {
    const ymd = this.formatDateToYMD(date);
    
    const response = await this.searchEvents({
      ymd,
      order: 2,
      count: 100,
    });

    return response.events;
  }

  /**
   * Format date to YYYYMMDD format
   */
  private formatDateToYMD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }
}

// Type definitions for Connpass API
export interface ConnpassEventResponse {
  results_returned: number;
  results_available: number;
  results_start: number;
  events: ConnpassEvent[];
}

export interface ConnpassEvent {
  event_id: number;
  title: string;
  catch: string;
  description: string;
  event_url: string;
  hash_tag: string;
  started_at: string; // ISO 8601 format
  ended_at: string; // ISO 8601 format
  limit: number | null;
  event_type: string;
  series: {
    id: number;
    title: string;
    url: string;
  } | null;
  address: string;
  place: string;
  lat: number | null;
  lon: number | null;
  owner_id: number;
  owner_nickname: string;
  owner_display_name: string;
  accepted: number;
  waiting: number;
  updated_at: string; // ISO 8601 format
}

// Singleton instance
export const connpassClient = new ConnpassClient();