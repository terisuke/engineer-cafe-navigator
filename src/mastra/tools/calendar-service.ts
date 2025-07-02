import { z } from 'zod';

interface CalendarEvent {
  summary: string;
  dtstart: Date;
  dtend?: Date;
  description?: string;
  location?: string;
}

export class CalendarServiceTool {
  name = 'calendar-service';
  description = 'Fetch and parse calendar events from iCal format or get current JST time';

  schema = z.object({
    icalUrl: z.string().optional().describe('iCal calendar URL'),
    useProxy: z.boolean().optional().default(true).describe('Use proxy API to avoid CORS'),
    daysAhead: z.number().optional().default(30).describe('Number of days to look ahead'),
    maxEvents: z.number().optional().default(10).describe('Maximum number of events to return'),
    timeOnly: z.boolean().optional().default(false).describe('Get only current JST time without events'),
  });

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    events: string;
    error?: string;
  }> {
    try {
      const { icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL, useProxy, daysAhead, maxEvents, timeOnly } = params;

      // If timeOnly is requested, return only current JST time
      if (timeOnly) {
        const currentJSTTime = this.getCurrentJSTTime();
        return {
          success: true,
          events: `現在時刻: ${currentJSTTime}`,
        };
      }

      if (!icalUrl) {
        return {
          success: false,
          events: '',
          error: 'Calendar URL not configured',
        };
      }

      // Always try to fetch real data first
      console.log('[CalendarService] Fetching calendar from:', icalUrl);
      
      let events;
      try {
        events = await this.fetchCalendarData(icalUrl, useProxy, daysAhead, maxEvents);
      } catch (error) {
        console.error('[CalendarService] Failed to fetch real data, using mock:', error);
        // Fallback to mock data if real fetch fails
        if (this.isDevelopment()) {
          return {
            success: true,
            events: this.getMockCalendarData(),
          };
        }
        throw error;
      }
      
      return {
        success: true,
        events,
      };
    } catch (error) {
      console.error('Calendar service error:', error);
      return {
        success: false,
        events: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchCalendarData(
    icalUrl: string, 
    useProxy: boolean,
    daysAhead: number,
    maxEvents: number
  ): Promise<string> {
    try {
      // Use proxy API in production to avoid CORS issues
      const url = useProxy ? '/api/calendar' : icalUrl;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status}`);
      }
      
      // Handle potential encoding issues
      const arrayBuffer = await response.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      let icalContent = decoder.decode(arrayBuffer);
      
      const events = this.parseICalContent(icalContent);
      
      // Sort events by date and get upcoming events
      const now = new Date();
      const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      
      const upcomingEvents = events
        .filter(event => {
          if (!event.dtstart || isNaN(event.dtstart.getTime())) {
            return false;
          }
          return event.dtstart >= now && event.dtstart <= futureDate;
        })
        .sort((a, b) => a.dtstart.getTime() - b.dtstart.getTime())
        .slice(0, maxEvents);
      
      // Get current JST time for context
      const currentJSTTime = this.getCurrentJSTTime();
      
      if (upcomingEvents.length === 0) {
        return `## Calendar Information:\n現在時刻: ${currentJSTTime}\n\nUpcoming Events:\nNo upcoming events in the next ${daysAhead} days.`;
      }
      
      const formattedEvents = upcomingEvents.map(event => this.formatEventForAI(event, now)).join('\n- ');
      
      return `## Calendar Information:\n現在時刻: ${currentJSTTime}\n\nUpcoming Events:\n- ${formattedEvents}`;
      
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      return "## Calendar Information:\nUnable to fetch calendar data at this time.";
    }
  }

  private parseICalDate(dateStr: string): Date {
    // Handle both YYYYMMDDTHHMMSSZ and YYYYMMDD formats
    if (dateStr.length === 8) {
      // YYYYMMDD format (all-day event)
      const year = parseInt(dateStr.substr(0, 4));
      const month = parseInt(dateStr.substr(4, 2)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substr(6, 2));
      return new Date(year, month, day);
    } else if ((dateStr.length === 15 || dateStr.length === 16) && dateStr.endsWith('Z')) {
      // YYYYMMDDTHHMMSSZ format
      const year = parseInt(dateStr.substr(0, 4));
      const month = parseInt(dateStr.substr(4, 2)) - 1;
      const day = parseInt(dateStr.substr(6, 2));
      const hour = parseInt(dateStr.substr(9, 2));
      const minute = parseInt(dateStr.substr(11, 2));
      const second = parseInt(dateStr.substr(13, 2));
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    // Fallback to default parsing
    return new Date(dateStr);
  }

  private parseICalContent(icalContent: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const lines = icalContent.split('\n').map(line => line.trim());
    
    let currentEvent: Partial<CalendarEvent> = {};
    let inEvent = false;
    
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {};
      } else if (line === 'END:VEVENT' && inEvent) {
        if (currentEvent.summary && currentEvent.dtstart) {
          events.push(currentEvent as CalendarEvent);
        }
        inEvent = false;
      } else if (inEvent) {
        if (line.startsWith('SUMMARY:')) {
          currentEvent.summary = line.substring(8);
        } else if (line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) {
          const dateValue = line.split(':')[1];
          currentEvent.dtstart = this.parseICalDate(dateValue);
        } else if (line.startsWith('DTEND:') || line.startsWith('DTEND;')) {
          const dateValue = line.split(':')[1];
          currentEvent.dtend = this.parseICalDate(dateValue);
        } else if (line.startsWith('DESCRIPTION:')) {
          currentEvent.description = line.substring(12);
        } else if (line.startsWith('LOCATION:')) {
          currentEvent.location = line.substring(9);
        }
      }
    }
    
    return events;
  }

  private formatEventForAI(event: CalendarEvent, currentTime: Date): string {
    // Format dates in JST
    const startDateJST = this.formatDateInJST(event.dtstart);
    const startTimeJST = this.formatTimeInJST(event.dtstart);
    
    // Calculate event status
    const eventStatus = this.getEventStatus(event, currentTime);
    
    let eventStr = `**${event.summary}**`;
    
    // Add status indicator
    if (eventStatus) {
      eventStr += ` [${eventStatus}]`;
    }
    
    // Add date and time
    eventStr += `: ${startDateJST}`;
    
    // Only add time if it's not an all-day event
    if (event.dtstart.getHours() !== 0 || event.dtstart.getMinutes() !== 0) {
      eventStr += ` ${startTimeJST}`;
      
      // Add end time if available
      if (event.dtend) {
        const endTimeJST = this.formatTimeInJST(event.dtend);
        eventStr += `〜${endTimeJST}`;
      }
    }
    
    if (event.location) {
      eventStr += ` (場所: ${event.location})`;
    }
    
    if (event.description) {
      eventStr += ` - ${event.description}`;
    }
    
    return eventStr;
  }

  private getCurrentJSTTime(): string {
    const now = new Date();
    
    // Use proper timezone conversion to JST
    const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    
    const year = jstTime.getFullYear();
    const month = jstTime.getMonth() + 1;
    const day = jstTime.getDate();
    const hour = jstTime.getHours();
    const minute = jstTime.getMinutes();
    
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][jstTime.getDay()];
    
    return `${year}年${month}月${day}日(${dayOfWeek}) ${hour}:${minute.toString().padStart(2, '0')} JST`;
  }
  
  private formatDateInJST(date: Date): string {
    // Convert to JST
    const jstOffset = 9 * 60;
    const localOffset = date.getTimezoneOffset();
    const jstDate = new Date(date.getTime() + (jstOffset + localOffset) * 60 * 1000);
    
    const year = jstDate.getFullYear();
    const month = jstDate.getMonth() + 1;
    const day = jstDate.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][jstDate.getDay()];
    
    return `${year}年${month}月${day}日(${dayOfWeek})`;
  }
  
  private formatTimeInJST(date: Date): string {
    // Convert to JST
    const jstOffset = 9 * 60;
    const localOffset = date.getTimezoneOffset();
    const jstDate = new Date(date.getTime() + (jstOffset + localOffset) * 60 * 1000);
    
    const hour = jstDate.getHours();
    const minute = jstDate.getMinutes();
    
    return `${hour}:${minute.toString().padStart(2, '0')}`;
  }
  
  private getEventStatus(event: CalendarEvent, currentTime: Date): string | null {
    const now = currentTime.getTime();
    const start = event.dtstart.getTime();
    const end = event.dtend ? event.dtend.getTime() : start + (2 * 60 * 60 * 1000); // Default 2 hours if no end time
    
    // Check if event is happening now
    if (start <= now && now <= end) {
      return '現在開催中';
    }
    
    // Check if event is today
    const todayStart = new Date(currentTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    if (start >= todayStart.getTime() && start < todayEnd.getTime()) {
      if (start > now) {
        return '本日開催予定';
      }
    }
    
    // Check if event is tomorrow
    const tomorrowStart = new Date(todayEnd);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    
    if (start >= tomorrowStart.getTime() && start < tomorrowEnd.getTime()) {
      return '明日開催予定';
    }
    
    // Check if event is this week
    const weekEnd = new Date(currentTime);
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay())); // End of week (Saturday)
    weekEnd.setHours(23, 59, 59, 999);
    
    if (start <= weekEnd.getTime()) {
      return '今週開催予定';
    }
    
    return null;
  }

  private getMockCalendarData(): string {
    const currentJSTTime = this.getCurrentJSTTime();
    return `## Calendar Information:
現在時刻: ${currentJSTTime}

Upcoming Events (Development Mock Data):
- **エンジニアカフェ技術勉強会** [明日開催予定]: 2025年6月15日(土) 19:00〜21:00 (場所: エンジニアカフェ) - LT大会とネットワーキング
- **AIワークショップ** [今週開催予定]: 2025年6月18日(火) 14:00〜17:00 (場所: エンジニアカフェ) - 最新のAI技術を学ぶハンズオン
- **福岡IT交流会**: 2025年6月20日(木) 18:30〜20:30 (場所: エンジニアカフェ) - 地域エンジニアとの交流
- **オープンデータ活用セミナー**: 2025年6月22日(土) 13:00〜15:00 (場所: エンジニアカフェ) - 福岡市のオープンデータ活用方法
- **スタートアップピッチイベント**: 2025年6月25日(火) 17:00〜19:00 (場所: エンジニアカフェ) - 福岡発スタートアップの発表会

*Note: This is mock data for development. In production, real calendar events will be displayed.`;
  }
}