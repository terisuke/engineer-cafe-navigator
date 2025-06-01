# External Data Fetcher Tool

The External Data Fetcher Tool provides real-time data integration capabilities for the Engineer Cafe Navigator system. It fetches and normalizes data from multiple external sources including Connpass events, Google Calendar, and the Engineer Cafe website.

## Features

### 1. Event Data Fetching
- **Connpass Events**: Fetches engineering events from the Connpass API
- **Google Calendar Events**: Retrieves scheduled activities and workshops
- **Event Search**: Unified search across all event sources
- **Event Filtering**: Filter by date range, event type, and keywords

### 2. Facility Status
- Real-time facility availability
- Resource availability (meeting rooms, workstations, equipment)
- Current occupancy levels
- Operating hours

### 3. Announcements
- Latest facility announcements
- Priority-based messaging
- Multi-language support (Japanese/English)

### 4. Caching System
- Intelligent caching to reduce API calls
- Configurable TTL for different data types
- Cache cleanup and management

## Usage

### Basic Implementation

```typescript
import { ExternalDataFetcherTool } from '@/mastra/tools/external-data-fetcher';

// Initialize the tool
const fetcher = new ExternalDataFetcherTool({
  websocketUrl: process.env.WEBSOCKET_URL,
  receptionApiUrl: process.env.RECEPTION_API_URL,
});

// Fetch Connpass events
const events = await fetcher.execute({
  action: 'fetchConnpassEvents',
  language: 'ja',
  limit: 10,
  eventType: 'workshop',
});

// Get facility status
const status = await fetcher.execute({
  action: 'getFacilityStatus',
  language: 'en',
});
```

### Available Actions

#### 1. fetchConnpassEvents
Fetches events from Connpass API.

```typescript
{
  action: 'fetchConnpassEvents',
  language: 'ja' | 'en',
  limit?: number,              // Default: 10
  searchQuery?: string,        // Optional search term
  dateRange?: {
    start?: string,           // ISO date format
    end?: string,             // ISO date format
  },
  eventType?: 'workshop' | 'seminar' | 'meetup' | 'hackathon' | 'all',
}
```

#### 2. fetchGoogleCalendarEvents
Retrieves calendar events (currently returns mock data).

```typescript
{
  action: 'fetchGoogleCalendarEvents',
  language: 'ja' | 'en',
  limit?: number,
  dateRange?: {
    start?: string,
    end?: string,
  },
  eventType?: string,
}
```

#### 3. getFacilityStatus
Gets current facility status and resource availability.

```typescript
{
  action: 'getFacilityStatus',
  language: 'ja' | 'en',
}
```

#### 4. searchEvents
Searches across all event sources.

```typescript
{
  action: 'searchEvents',
  language: 'ja' | 'en',
  searchQuery?: string,
  limit?: number,
}
```

#### 5. getLatestAnnouncements
Retrieves the latest facility announcements.

```typescript
{
  action: 'getLatestAnnouncements',
  language: 'ja' | 'en',
}
```

#### 6. fetchWebsiteContent
Fetches static content about Engineer Cafe.

```typescript
{
  action: 'fetchWebsiteContent',
  language: 'ja' | 'en',
}
```

## Data Formats

### EventData
```typescript
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
```

### FacilityStatus
```typescript
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
```

## Caching Configuration

The tool implements different cache durations for different data types:

- **Events**: 15 minutes
- **Calendar**: 5 minutes  
- **Website Content**: 30 minutes
- **Facility Status**: 5 minutes

Cache can be managed using:

```typescript
// Get cache information
const cacheInfo = await fetcher.getCacheInfo();

// Clear all cache
await fetcher.clearCache();
```

## Error Handling

The tool uses the retry utility from `lib/retry-utils.ts` for resilient API calls:

- Automatic retry with exponential backoff
- Network error handling
- API rate limit management

## Integration with AI Agents

The External Data Fetcher Tool can be used by AI agents to provide real-time information:

```typescript
// In an AI agent
const eventData = await this._tools.get('externalDataFetcher').execute({
  action: 'searchEvents',
  searchQuery: userQuery,
  language: currentLanguage,
});

// Use the data to generate responses
const response = `I found ${eventData.data.length} upcoming events...`;
```

## Testing

Run the test script to verify functionality:

```bash
pnpm tsx scripts/test-external-data-fetcher.ts
```

## Future Enhancements

1. **Google Calendar Integration**: Implement actual Google Calendar API integration
2. **Website Scraping**: Add real website content scraping capabilities
3. **Event Registration**: Allow users to register for events through the tool
4. **Push Notifications**: Real-time event updates and announcements
5. **Advanced Filtering**: More sophisticated event filtering and recommendation