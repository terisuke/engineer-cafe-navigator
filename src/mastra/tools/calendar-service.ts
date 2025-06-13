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
  description = 'Fetch and parse calendar events from iCal format';

  schema = z.object({
    icalUrl: z.string().optional().describe('iCal calendar URL'),
    useProxy: z.boolean().optional().default(true).describe('Use proxy API to avoid CORS'),
    daysAhead: z.number().optional().default(30).describe('Number of days to look ahead'),
    maxEvents: z.number().optional().default(10).describe('Maximum number of events to return'),
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
      const { icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL, useProxy, daysAhead, maxEvents } = params;

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
      
      if (upcomingEvents.length === 0) {
        return `## Upcoming Calendar Events:\nNo upcoming events in the next ${daysAhead} days.`;
      }
      
      const formattedEvents = upcomingEvents.map(this.formatEventForAI).join('\n- ');
      
      return `## Upcoming Calendar Events:\n- ${formattedEvents}`;
      
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

  private formatEventForAI(event: CalendarEvent): string {
    const startDate = event.dtstart.toLocaleDateString();
    const startTime = event.dtstart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let eventStr = `**${event.summary}**: ${startDate}`;
    
    // Only add time if it's not an all-day event
    if (event.dtstart.getHours() !== 0 || event.dtstart.getMinutes() !== 0) {
      eventStr += ` at ${startTime}`;
    }
    
    if (event.location) {
      eventStr += ` (Location: ${event.location})`;
    }
    
    if (event.description) {
      eventStr += ` - ${event.description}`;
    }
    
    return eventStr;
  }

  private getMockCalendarData(): string {
    return `## Upcoming Calendar Events (Development Mock Data):
- **エンジニアカフェ技術勉強会**: 2025年6月15日 at 19:00 - LT大会とネットワーキング
- **AIワークショップ**: 2025年6月18日 at 14:00 - 最新のAI技術を学ぶハンズオン
- **福岡IT交流会**: 2025年6月20日 at 18:30 - 地域エンジニアとの交流
- **オープンデータ活用セミナー**: 2025年6月22日 at 13:00 - 福岡市のオープンデータ活用方法
- **スタートアップピッチイベント**: 2025年6月25日 at 17:00 - 福岡発スタートアップの発表会

*Note: This is mock data for development. In production, real calendar events will be displayed.`;
  }
}