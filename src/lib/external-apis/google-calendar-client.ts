import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { withRetry } from '../retry-utils';

/**
 * Google Calendar API client for fetching Engineer Cafe schedule
 */
export class GoogleCalendarClient {
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar;
  
  constructor() {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    
    // For build time, allow missing credentials
    if (!clientId || !clientSecret || !redirectUri) {
      console.warn('Google Calendar OAuth2 credentials are not configured. OAuth2 features will be disabled.');
      // Create a dummy client to prevent build errors
      this.oauth2Client = new OAuth2Client();
      this.calendar = google.calendar({ version: 'v3' });
      return;
    }
    
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate OAuth2 URL for user authentication
   */
  generateAuthUrl(): string {
    if (!this.isOAuth2Configured()) {
      throw new Error('Google Calendar OAuth2 is not configured');
    }
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  /**
   * Check if OAuth2 is configured
   */
  private isOAuth2Configured(): boolean {
    return !!process.env.GOOGLE_CALENDAR_CLIENT_ID && 
           !!process.env.GOOGLE_CALENDAR_CLIENT_SECRET && 
           !!process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{ 
    access_token: string; 
    refresh_token?: string;
  }> {
    if (!this.isOAuth2Configured()) {
      throw new Error('Google Calendar OAuth2 is not configured');
    }
    
    const { tokens } = await this.oauth2Client.getToken(code);
    if (!tokens.access_token) {
      throw new Error('No access_token returned from Google OAuth2.');
    }
    this.oauth2Client.setCredentials(tokens);
    
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
    };
  }

  /**
   * Set credentials for API calls
   */
  setCredentials(tokens: { access_token: string; refresh_token?: string }) {
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * Use service account for server-side authentication
   */
  async authenticateWithServiceAccount(): Promise<void> {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'config/service-account-key.json',
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const authClient = await auth.getClient();
    this.calendar = google.calendar({ version: 'v3', auth: authClient as OAuth2Client });
  }

  /**
   * List events from a calendar
   */
  async listEvents(calendarId: string, options: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    orderBy?: 'startTime' | 'updated';
    singleEvents?: boolean;
    q?: string; // Free text search
  } = {}): Promise<GoogleCalendarEvent[]> {
    if (!this.isOAuth2Configured()) {
      console.warn('Google Calendar OAuth2 not configured, returning empty events');
      return [];
    }
    return withRetry(
      async () => {
        const response = await this.calendar.events.list({
          calendarId,
          timeMin: options.timeMin?.toISOString(),
          timeMax: options.timeMax?.toISOString(),
          maxResults: options.maxResults || 250,
          orderBy: options.orderBy || 'startTime',
          singleEvents: options.singleEvents !== false,
          q: options.q,
        });

        if (!response.data.items) {
          return [];
        }

        return response.data.items.map(this.transformEvent);
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
      }
    );
  }

  /**
   * Get events for today from Engineer Cafe calendar
   */
  async getTodayEvents(): Promise<GoogleCalendarEvent[]> {
    if (!this.isOAuth2Configured()) {
      console.warn('Google Calendar OAuth2 not configured, returning empty events');
      return [];
    }
    
    const calendarId = process.env.ENGINEER_CAFE_CALENDAR_ID;
    if (!calendarId) {
      throw new Error('ENGINEER_CAFE_CALENDAR_ID not configured');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.listEvents(calendarId, {
      timeMin: today,
      timeMax: tomorrow,
      singleEvents: true,
      orderBy: 'startTime',
    });
  }

  /**
   * Get upcoming events for the next N days
   */
  async getUpcomingEvents(days: number = 7): Promise<GoogleCalendarEvent[]> {
    const calendarId = process.env.ENGINEER_CAFE_CALENDAR_ID;
    if (!calendarId) {
      throw new Error('ENGINEER_CAFE_CALENDAR_ID not configured');
    }

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return this.listEvents(calendarId, {
      timeMin: now,
      timeMax: future,
      singleEvents: true,
      orderBy: 'startTime',
    });
  }

  /**
   * Search for specific events
   */
  async searchEvents(query: string, options: {
    daysAhead?: number;
    maxResults?: number;
  } = {}): Promise<GoogleCalendarEvent[]> {
    const calendarId = process.env.ENGINEER_CAFE_CALENDAR_ID;
    if (!calendarId) {
      throw new Error('ENGINEER_CAFE_CALENDAR_ID not configured');
    }

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + (options.daysAhead || 30));

    return this.listEvents(calendarId, {
      q: query,
      timeMin: now,
      timeMax: future,
      maxResults: options.maxResults || 50,
      singleEvents: true,
      orderBy: 'startTime',
    });
  }

  /**
   * Get calendar metadata
   */
  async getCalendarInfo(calendarId?: string): Promise<CalendarInfo> {
    const id = calendarId || process.env.ENGINEER_CAFE_CALENDAR_ID;
    if (!id) {
      throw new Error('Calendar ID not provided');
    }

    const response = await this.calendar.calendars.get({
      calendarId: id,
    });

    return {
      id: response.data.id!,
      summary: response.data.summary!,
      description: response.data.description || undefined,
      timeZone: response.data.timeZone || 'Asia/Tokyo',
    };
  }

  /**
   * Transform Google Calendar event to our format
   */
  private transformEvent(event: calendar_v3.Schema$Event): GoogleCalendarEvent {
    return {
      id: event.id!,
      summary: event.summary || 'Untitled Event',
      description: event.description || undefined,
      location: event.location || undefined,
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      status: event.status as 'confirmed' | 'tentative' | 'cancelled' || 'confirmed',
      htmlLink: event.htmlLink || undefined,
      created: event.created || undefined,
      updated: event.updated || undefined,
      creator: event.creator ? {
        email: event.creator.email || undefined,
        displayName: event.creator.displayName || undefined,
      } : undefined,
      organizer: event.organizer ? {
        email: event.organizer.email || undefined,
        displayName: event.organizer.displayName || undefined,
      } : undefined,
      attendees: event.attendees?.map((a: any) => ({
        email: a.email!,
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus as any || 'needsAction',
      })) || [],
      recurrence: event.recurrence || undefined,
    };
  }
}

// Type definitions
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  created?: string;
  updated?: string;
  creator?: {
    email?: string;
    displayName?: string;
  };
  organizer?: {
    email?: string;
    displayName?: string;
  };
  attendees: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  recurrence?: string[];
}

export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  timeZone: string;
}

// Singleton instance
export const googleCalendarClient = new GoogleCalendarClient();