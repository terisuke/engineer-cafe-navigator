import { z } from 'zod';
import WebSocket from 'ws';

export class ExternalApiTool {
  name = 'external-api';
  description = 'Interface with external systems and APIs';

  private websocket: WebSocket | null = null;
  private config: any;

  schema = z.object({
    action: z.enum([
      'sendWebSocketMessage',
      'callReceptionApi',
      'notifyStaff',
      'getEventInfo',
      'checkRoomAvailability',
      'logVisitorActivity',
      'sendRemoteMessage'
    ]),
    data: z.any().optional().describe('Data to send with the action'),
    endpoint: z.string().optional().describe('Specific API endpoint'),
    message: z.string().optional().describe('Message content'),
    recipient: z.string().optional().describe('Message recipient'),
    urgency: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  });

  constructor(config: any) {
    this.config = config;
    // Only initialize WebSocket if explicitly configured
    if (config?.websocketUrl && config.websocketUrl !== '') {
      this.initializeWebSocket();
    }
  }

  private async initializeWebSocket(): Promise<void> {
    if (!this.config.websocketUrl) {
      console.warn('WebSocket URL not configured');
      return;
    }

    try {
      this.websocket = new WebSocket(this.config.websocketUrl);

      this.websocket.on('open', () => {
        console.log('WebSocket connected to external system');
      });

      this.websocket.on('message', (data) => {
        this.handleIncomingMessage(data);
      });

      this.websocket.on('close', () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        setTimeout(() => this.initializeWebSocket(), 5000);
      });

      this.websocket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private handleIncomingMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received external message:', message);

      // Handle different message types
      switch (message.type) {
        case 'staff_message':
          this.handleStaffMessage(message);
          break;
        case 'room_update':
          this.handleRoomUpdate(message);
          break;
        case 'visitor_notification':
          this.handleVisitorNotification(message);
          break;
        case 'system_alert':
          this.handleSystemAlert(message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse incoming message:', error);
    }
  }

  private handleStaffMessage(message: any): void {
    // TODO: Forward staff message to the AI agent or user interface
    console.log('Staff message received:', message.content);
  }

  private handleRoomUpdate(message: any): void {
    // TODO: Update room availability information
    console.log('Room update received:', message);
  }

  private handleVisitorNotification(message: any): void {
    // TODO: Handle visitor-related notifications
    console.log('Visitor notification:', message);
  }

  private handleSystemAlert(message: any): void {
    // TODO: Handle system alerts and warnings
    console.log('System alert:', message);
  }

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const { action } = params;

      switch (action) {
        case 'sendWebSocketMessage':
          return await this.sendWebSocketMessage(params.data);
        case 'callReceptionApi':
          return await this.callReceptionApi(params.endpoint, params.data);
        case 'notifyStaff':
          return await this.notifyStaff(params.message!, params.urgency);
        case 'getEventInfo':
          return await this.getEventInfo();
        case 'checkRoomAvailability':
          return await this.checkRoomAvailability();
        case 'logVisitorActivity':
          return await this.logVisitorActivity(params.data);
        case 'sendRemoteMessage':
          return await this.sendRemoteMessage(params.recipient!, params.message!);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('External API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async sendWebSocketMessage(data: any): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return {
        success: false,
        error: 'WebSocket not connected',
      };
    }

    try {
      const message = {
        type: 'ai_agent_message',
        timestamp: new Date().toISOString(),
        data,
      };

      this.websocket.send(JSON.stringify(message));

      return {
        success: true,
        result: { messageSent: true },
      };
    } catch (error) {
      throw error;
    }
  }

  private async callReceptionApi(endpoint?: string, data?: any): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    if (!this.config.receptionApiUrl) {
      return {
        success: false,
        error: 'Reception API URL not configured',
      };
    }

    try {
      const url = endpoint 
        ? `${this.config.receptionApiUrl}/${endpoint}`
        : this.config.receptionApiUrl;

      const response = await fetch(url, {
        method: data ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication headers if needed
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        result,
      };
    } catch (error) {
      throw error;
    }
  }

  private async notifyStaff(message: string, urgency?: 'low' | 'medium' | 'high'): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const notification = {
        type: 'staff_notification',
        message,
        urgency: urgency || 'medium',
        timestamp: new Date().toISOString(),
        source: 'ai_navigator',
      };

      // Send via WebSocket if available
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(notification));
      }

      // Also send via Reception API if available
      if (this.config.receptionApiUrl) {
        await this.callReceptionApi('notifications', notification);
      }

      return {
        success: true,
        result: { notificationSent: true },
      };
    } catch (error) {
      throw error;
    }
  }

  private async getEventInfo(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // Get current and upcoming events from the reception system
      const result = await this.callReceptionApi('events');

      if (!result.success) {
        return result;
      }

      // Format event information for the AI agent
      const events = result.result?.events || [];
      const currentEvents = events.filter((event: any) => {
        const now = new Date();
        const startTime = new Date(event.startTime);
        const endTime = new Date(event.endTime);
        return now >= startTime && now <= endTime;
      });

      const upcomingEvents = events.filter((event: any) => {
        const now = new Date();
        const startTime = new Date(event.startTime);
        return startTime > now;
      }).slice(0, 5); // Next 5 events

      return {
        success: true,
        result: {
          currentEvents,
          upcomingEvents,
          totalEvents: events.length,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async checkRoomAvailability(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // Check meeting room availability
      const result = await this.callReceptionApi('rooms/availability');

      if (!result.success) {
        return result;
      }

      const rooms = result.result?.rooms || [];
      const availableRooms = rooms.filter((room: any) => room.available);
      const occupiedRooms = rooms.filter((room: any) => !room.available);

      return {
        success: true,
        result: {
          availableRooms,
          occupiedRooms,
          totalRooms: rooms.length,
          availabilityRate: rooms.length > 0 ? (availableRooms.length / rooms.length * 100) : 0,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async logVisitorActivity(data: any): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const logEntry = {
        type: 'visitor_activity',
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId || 'unknown',
        activity: data.activity,
        details: data.details || {},
        source: 'ai_navigator',
      };

      // Log to reception system
      if (this.config.receptionApiUrl) {
        await this.callReceptionApi('logs/visitor', logEntry);
      }

      // Send via WebSocket for real-time monitoring
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(logEntry));
      }

      return {
        success: true,
        result: { logged: true },
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendRemoteMessage(recipient: string, message: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const remoteMessage = {
        type: 'remote_message',
        recipient,
        message,
        timestamp: new Date().toISOString(),
        sender: 'ai_navigator',
      };

      // Send via WebSocket
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(remoteMessage));
      } else {
        throw new Error('WebSocket not available for remote messaging');
      }

      return {
        success: true,
        result: { messageSent: true },
      };
    } catch (error) {
      throw error;
    }
  }

  async getConnectionStatus(): Promise<{
    websocket: 'connected' | 'disconnected' | 'not_configured';
    receptionApi: 'available' | 'unavailable' | 'not_configured';
  }> {
    const websocketStatus = this.config.websocketUrl
      ? (this.websocket && this.websocket.readyState === WebSocket.OPEN ? 'connected' : 'disconnected')
      : 'not_configured';

    let receptionApiStatus: 'available' | 'unavailable' | 'not_configured' = 'not_configured';
    
    if (this.config.receptionApiUrl) {
      try {
        const response = await fetch(`${this.config.receptionApiUrl}/health`, { 
          method: 'GET',
        });
        receptionApiStatus = response.ok ? 'available' : 'unavailable';
      } catch (error) {
        receptionApiStatus = 'unavailable';
      }
    }

    return {
      websocket: websocketStatus,
      receptionApi: receptionApiStatus,
    };
  }

  async closeConnections(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}
