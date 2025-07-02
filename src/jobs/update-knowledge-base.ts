import { CronJob } from 'cron';
import { connpassClient } from '../lib/external-apis/connpass-client';
import { googleCalendarClient } from '../lib/external-apis/google-calendar-client';
import { supabaseAdmin } from '../lib/supabase';
import { knowledgeBaseUtils } from '../lib/knowledge-base-utils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Automated knowledge base updater that syncs external data sources
 */
export class KnowledgeBaseUpdater {
  private job: CronJob;
  private isRunning = false;
  
  constructor() {
    // Run every 6 hours: "0 */6 * * *"
    // For testing, can use every 5 minutes: "*/5 * * * *"
    this.job = new CronJob('0 */6 * * *', async () => {
      await this.runUpdate();
    });
  }
  
  /**
   * Start the cron job
   */
  start() {
    this.job.start();
    console.log('[KnowledgeBaseUpdater] Started - will run every 6 hours');
  }
  
  /**
   * Stop the cron job
   */
  stop() {
    this.job.stop();
    console.log('[KnowledgeBaseUpdater] Stopped');
  }
  
  /**
   * Run update immediately (can be called manually)
   */
  async runUpdate(): Promise<void> {
    if (this.isRunning) {
      console.log('[KnowledgeBaseUpdater] Update already in progress, skipping...');
      return;
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('[KnowledgeBaseUpdater] Starting knowledge base update...');
      
      // Run all updates in parallel
      const results = await Promise.allSettled([
        this.updateFromConnpass(),
        this.updateFromGoogleCalendar(),
        this.updateFromWebsite(),
      ]);
      
      // Log results
      results.forEach((result, index) => {
        const source = ['Connpass', 'Google Calendar', 'Website'][index];
        if (result.status === 'fulfilled') {
          console.log(`[KnowledgeBaseUpdater] ${source} update completed: ${result.value}`);
        } else {
          console.error(`[KnowledgeBaseUpdater] ${source} update failed:`, result.reason);
        }
      });
      
      // Clean up old entries
      await this.cleanupOldEntries();
      
      const duration = Date.now() - startTime;
      console.log(`[KnowledgeBaseUpdater] Update completed in ${duration}ms`);
      
      // Track metrics
      await this.trackUpdateMetrics({
        duration,
        sources: {
          connpass: results[0].status === 'fulfilled',
          googleCalendar: results[1].status === 'fulfilled',
          website: results[2].status === 'fulfilled',
        },
      });
      
    } catch (error) {
      console.error('[KnowledgeBaseUpdater] Update failed:', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Update knowledge base from Connpass events
   */
  private async updateFromConnpass(): Promise<string> {
    try {
      // Search for Engineer Cafe events
      const events = await connpassClient.searchEngineerCafeEvents({
        includeEnded: false,
        count: 50,
      });
      
      let added = 0;
      let updated = 0;
      
      for (const event of events) {
        const knowledgeEntry = {
          title: event.title,
          content: this.formatConnpassEvent(event),
          category: 'events',
          subcategory: 'connpass',
          language: this.detectLanguage(event.title + ' ' + event.description),
          metadata: {
            source: 'connpass',
            event_id: event.event_id,
            event_url: event.event_url,
            start_date: event.started_at,
            end_date: event.ended_at,
            place: event.place,
            updated_at: event.updated_at,
          },
        };
        
        // Check if event already exists
        const { data: existing } = await supabaseAdmin
          .from('knowledge_base')
          .select('id')
          .eq('metadata->>event_id', event.event_id.toString())
          .single();
        
        if (existing) {
          // Update existing entry
          const { error } = await supabaseAdmin
            .from('knowledge_base')
            .update({
              ...knowledgeEntry,
              content_embedding: await knowledgeBaseUtils.generateEmbedding(knowledgeEntry.content),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          
          if (!error) updated++;
        } else {
          // Add new entry
          const { error } = await supabaseAdmin
            .from('knowledge_base')
            .insert({
              id: uuidv4(),
              ...knowledgeEntry,
              content_embedding: await knowledgeBaseUtils.generateEmbedding(knowledgeEntry.content),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          
          if (!error) added++;
        }
      }
      
      return `Added ${added}, updated ${updated} events`;
    } catch (error) {
      console.error('[updateFromConnpass] Error:', error);
      throw error;
    }
  }
  
  /**
   * Update knowledge base from Google Calendar
   */
  private async updateFromGoogleCalendar(): Promise<string> {
    try {
      // Check if OAuth2 credentials are configured
      if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || 
          !process.env.GOOGLE_CALENDAR_CLIENT_SECRET || 
          !process.env.GOOGLE_CALENDAR_REDIRECT_URI) {
        console.warn('[updateFromGoogleCalendar] OAuth2 credentials not configured, skipping');
        return 'Skipped - OAuth2 not configured';
      }
      
      // Authenticate with service account
      await googleCalendarClient.authenticateWithServiceAccount();
      
      // Get upcoming events for the next 30 days
      const events = await googleCalendarClient.getUpcomingEvents(30);
      
      let added = 0;
      let updated = 0;
      
      for (const event of events) {
        const knowledgeEntry = {
          title: event.summary,
          content: this.formatGoogleCalendarEvent(event),
          category: 'events',
          subcategory: 'schedule',
          language: this.detectLanguage(event.summary + ' ' + (event.description || '')),
          metadata: {
            source: 'google_calendar',
            event_id: event.id,
            event_url: event.htmlLink,
            start_date: event.start,
            end_date: event.end,
            location: event.location,
            status: event.status,
            updated_at: event.updated,
          },
        };
        
        // Check if event already exists
        const { data: existing } = await supabaseAdmin
          .from('knowledge_base')
          .select('id')
          .eq('metadata->>event_id', event.id)
          .single();
        
        if (existing) {
          // Update existing entry
          const { error } = await supabaseAdmin
            .from('knowledge_base')
            .update({
              ...knowledgeEntry,
              content_embedding: await knowledgeBaseUtils.generateEmbedding(knowledgeEntry.content),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          
          if (!error) updated++;
        } else {
          // Add new entry
          const { error } = await supabaseAdmin
            .from('knowledge_base')
            .insert({
              id: uuidv4(),
              ...knowledgeEntry,
              content_embedding: await knowledgeBaseUtils.generateEmbedding(knowledgeEntry.content),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          
          if (!error) added++;
        }
      }
      
      return `Added ${added}, updated ${updated} calendar events`;
    } catch (error) {
      console.error('[updateFromGoogleCalendar] Error:', error);
      throw error;
    }
  }
  
  /**
   * Update knowledge base from website scraping
   */
  private async updateFromWebsite(): Promise<string> {
    // For now, return a placeholder
    // In production, this would scrape the Engineer Cafe website
    // using tools like Puppeteer or Playwright
    return 'Website scraping not yet implemented';
  }
  
  /**
   * Format Connpass event for knowledge base
   */
  private formatConnpassEvent(event: any): string {
    const currentJST = this.getCurrentJSTTime();
    const eventStatus = this.getEventStatusForKnowledge({
      start: event.started_at,
      end: event.ended_at
    });
    
    const parts = [
      `イベント名: ${event.title}`,
      eventStatus ? `状態: ${eventStatus}` : '',
      `キャッチコピー: ${event.catch}`,
      `開催日時: ${this.formatDateTime(event.started_at)} - ${this.formatDateTime(event.ended_at)}`,
      `場所: ${event.place}`,
      event.address ? `住所: ${event.address}` : '',
      `定員: ${event.limit || '制限なし'}`,
      `参加者: ${event.accepted}名`,
      event.waiting > 0 ? `キャンセル待ち: ${event.waiting}名` : '',
      `詳細: ${event.description.substring(0, 500)}...`,
      `URL: ${event.event_url}`,
      `情報取得時刻: ${currentJST}`,
    ].filter(Boolean);
    
    return parts.join('\n');
  }
  
  /**
   * Format Google Calendar event for knowledge base
   */
  private formatGoogleCalendarEvent(event: any): string {
    const currentJST = this.getCurrentJSTTime();
    const eventStatus = this.getEventStatusForKnowledge(event);
    
    const parts = [
      `イベント名: ${event.summary}`,
      eventStatus ? `状態: ${eventStatus}` : '',
      `開催日時: ${this.formatDateTime(event.start)} - ${this.formatDateTime(event.end)}`,
      event.location ? `場所: ${event.location}` : '',
      event.description ? `詳細: ${event.description.substring(0, 500)}...` : '',
      `ステータス: ${event.status}`,
      event.htmlLink ? `カレンダーリンク: ${event.htmlLink}` : '',
      `情報取得時刻: ${currentJST}`,
    ].filter(Boolean);
    
    return parts.join('\n');
  }
  
  /**
   * Format datetime string
   */
  private formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  /**
   * Simple language detection
   */
  private detectLanguage(text: string): 'ja' | 'en' {
    // Check for Japanese characters
    const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/.test(text);
    return hasJapanese ? 'ja' : 'en';
  }
  
  /**
   * Clean up old entries
   */
  private async cleanupOldEntries(): Promise<void> {
    // Remove events that ended more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await supabaseAdmin
      .from('knowledge_base')
      .delete()
      .eq('category', 'events')
      .lt('metadata->>end_date', thirtyDaysAgo.toISOString());
  }
  
  /**
   * Track update metrics
   */
  private async trackUpdateMetrics(metrics: {
    duration: number;
    sources: {
      connpass: boolean;
      googleCalendar: boolean;
      website: boolean;
    };
  }): Promise<void> {
    try {
      await supabaseAdmin
        .from('system_metrics')
        .insert({
          metric_type: 'knowledge_base_update',
          value: metrics.duration,
          metadata: metrics.sources,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[trackUpdateMetrics] Error:', error);
    }
  }
  
  /**
   * Get current JST time string
   */
  private getCurrentJSTTime(): string {
    const now = new Date();
    // Convert to JST (UTC+9)
    const jstOffset = 9 * 60; // JST is UTC+9
    const localOffset = now.getTimezoneOffset();
    const jstTime = new Date(now.getTime() + (jstOffset + localOffset) * 60 * 1000);
    
    const year = jstTime.getFullYear();
    const month = jstTime.getMonth() + 1;
    const day = jstTime.getDate();
    const hour = jstTime.getHours();
    const minute = jstTime.getMinutes();
    
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][jstTime.getDay()];
    
    return `${year}年${month}月${day}日(${dayOfWeek}) ${hour}:${minute.toString().padStart(2, '0')} JST`;
  }
  
  /**
   * Get event status for knowledge base
   */
  private getEventStatusForKnowledge(event: any): string | null {
    const now = new Date();
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    // Check if event is happening now
    if (start <= now && now <= end) {
      return '現在開催中';
    }
    
    // Check if event is today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    if (start >= todayStart && start < todayEnd) {
      if (start > now) {
        return '本日開催予定';
      }
    }
    
    // Check if event is tomorrow
    const tomorrowStart = new Date(todayEnd);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    
    if (start >= tomorrowStart && start < tomorrowEnd) {
      return '明日開催予定';
    }
    
    // Check if event is this week
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay())); // End of week (Saturday)
    weekEnd.setHours(23, 59, 59, 999);
    
    if (start <= weekEnd) {
      return '今週開催予定';
    }
    
    return null;
  }
}

// Export singleton instance
export const knowledgeBaseUpdater = new KnowledgeBaseUpdater();