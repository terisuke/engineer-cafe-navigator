import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get iCal URL from environment variables
    const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
    
    if (!icalUrl) {
      return NextResponse.json(
        { error: 'Calendar URL not configured' },
        { status: 500 }
      );
    }

    // Fetch the iCal data from Google Calendar
    const response = await fetch(icalUrl, {
      headers: {
        'Accept': 'text/calendar',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch calendar data' },
        { status: response.status }
      );
    }

    // Get the response as text (iCal format)
    const icalData = await response.text();

    // Return the iCal data with proper headers
    return new NextResponse(icalData, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}