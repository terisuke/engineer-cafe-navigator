export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
  id?: string;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: WebSocketMessage;
  autoReconnect?: boolean;
  binaryType?: 'blob' | 'arraybuffer';
}

export type WebSocketState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'reconnecting' | 'error';

export interface WebSocketEvent {
  type: 'open' | 'close' | 'error' | 'message' | 'reconnect' | 'heartbeat' | 'state-change';
  data?: any;
  error?: Error;
  state?: WebSocketState;
  message?: WebSocketMessage;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private state: WebSocketState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventListeners: Array<(event: WebSocketEvent) => void> = [];
  private messageQueue: WebSocketMessage[] = [];
  private isDestroyed = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols || [],
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      heartbeatInterval: config.heartbeatInterval || 30000,
      heartbeatMessage: config.heartbeatMessage || { type: 'ping' },
      autoReconnect: config.autoReconnect !== false,
      binaryType: config.binaryType || 'blob',
    };
  }

  // Event management
  addEventListener(listener: (event: WebSocketEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: WebSocketEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emit(event: WebSocketEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in WebSocket event listener:', error);
      }
    });
  }

  // Connection management
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('WebSocketManager is destroyed');
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.setState('connecting');
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        this.ws.binaryType = this.config.binaryType;

        this.ws.onopen = () => {
          this.setState('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.emit({ type: 'open' });
          resolve();
        };

        this.ws.onclose = (event) => {
          this.setState('disconnected');
          this.stopHeartbeat();
          this.emit({ type: 'close', data: { code: event.code, reason: event.reason } });

          if (this.config.autoReconnect && !event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = () => {
          this.setState('error');
          const error = new Error('WebSocket connection error');
          this.emit({ type: 'error', error });
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            let message: WebSocketMessage;
            
            if (typeof event.data === 'string') {
              message = JSON.parse(event.data);
            } else {
              message = { type: 'binary', data: event.data };
            }

            // Handle heartbeat response
            if (message.type === 'pong') {
              this.emit({ type: 'heartbeat', message });
              return;
            }

            this.emit({ type: 'message', message });
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.emit({ type: 'error', error: error as Error });
          }
        };
      } catch (error) {
        this.setState('error');
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.setState('disconnecting');
      this.stopHeartbeat();
      this.clearReconnectTimer();
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  // Message sending
  send(message: WebSocketMessage): void {
    if (this.isDestroyed) {
      throw new Error('WebSocketManager is destroyed');
    }

    // Add timestamp and ID if not present
    const enrichedMessage = {
      ...message,
      timestamp: message.timestamp || Date.now(),
      id: message.id || this.generateMessageId(),
    };

    if (this.state === 'connected' && this.ws) {
      try {
        this.ws.send(JSON.stringify(enrichedMessage));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.queueMessage(enrichedMessage);
      }
    } else {
      this.queueMessage(enrichedMessage);
    }
  }

  sendBinary(data: ArrayBuffer | Blob): void {
    if (this.isDestroyed) {
      throw new Error('WebSocketManager is destroyed');
    }

    if (this.state === 'connected' && this.ws) {
      try {
        this.ws.send(data);
      } catch (error) {
        console.error('Error sending binary WebSocket message:', error);
      }
    }
  }

  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message);
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.state === 'connected') {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  // Heartbeat management
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    if (this.config.heartbeatInterval > 0) {
      this.heartbeatTimer = setInterval(() => {
        if (this.state === 'connected') {
          this.send(this.config.heartbeatMessage);
        }
      }, this.config.heartbeatInterval);
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Reconnection management
  private scheduleReconnect(): void {
    if (this.isDestroyed || !this.config.autoReconnect) return;

    this.reconnectAttempts++;
    this.setState('reconnecting');

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.reconnectTimer = setTimeout(() => {
      this.emit({ type: 'reconnect', data: { attempt: this.reconnectAttempts } });
      this.connect().catch(() => {
        // Reconnection failed, will try again if under max attempts
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // State management
  private setState(newState: WebSocketState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.emit({ type: 'state-change', state: newState, data: { oldState, newState } });
    }
  }

  getState(): WebSocketState {
    return this.state;
  }

  getConfig(): WebSocketConfig {
    return { ...this.config };
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  // Utility methods
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateConfig(newConfig: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  clearMessageQueue(): void {
    this.messageQueue = [];
  }

  // Cleanup
  destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.clearReconnectTimer();
    this.eventListeners = [];
    this.messageQueue = [];
  }
}

// Specialized WebSocket managers for different purposes
export class ReceptionSystemWebSocket extends WebSocketManager {
  constructor(url: string) {
    super({
      url,
      heartbeatMessage: { type: 'reception_ping' },
      heartbeatInterval: 30000,
      autoReconnect: true,
      maxReconnectAttempts: 10,
    });

    // Add reception-specific event handling
    this.addEventListener((event) => {
      if (event.type === 'message' && event.message) {
        this.handleReceptionMessage(event.message);
      }
    });
  }

  // Reception-specific methods
  notifyVisitorArrival(visitorInfo: any): void {
    this.send({
      type: 'visitor_arrival',
      data: visitorInfo,
    });
  }

  requestRoomAvailability(): void {
    this.send({
      type: 'room_availability_request',
    });
  }

  sendStaffNotification(message: string, urgency: 'low' | 'medium' | 'high' = 'medium'): void {
    this.send({
      type: 'staff_notification',
      data: { message, urgency },
    });
  }

  logActivity(activity: string, details: any): void {
    this.send({
      type: 'activity_log',
      data: { activity, details },
    });
  }

  private handleReceptionMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'room_availability_response':
        // Handle room availability data
        break;
      case 'staff_message':
        // Handle staff message
        break;
      case 'system_alert':
        // Handle system alerts
        break;
      default:
        console.log('Unhandled reception message:', message);
    }
  }
}

export class AINavigatorWebSocket extends WebSocketManager {
  constructor(url: string) {
    super({
      url,
      heartbeatMessage: { type: 'navigator_ping' },
      heartbeatInterval: 25000,
      autoReconnect: true,
      maxReconnectAttempts: 5,
    });

    // Add AI navigator-specific event handling
    this.addEventListener((event) => {
      if (event.type === 'message' && event.message) {
        this.handleNavigatorMessage(event.message);
      }
    });
  }

  // AI Navigator-specific methods
  sendConversationUpdate(transcript: string, response: string): void {
    this.send({
      type: 'conversation_update',
      data: { transcript, response },
    });
  }

  requestRemoteAssistance(reason: string): void {
    this.send({
      type: 'remote_assistance_request',
      data: { reason },
    });
  }

  sendSlideProgress(slideNumber: number, totalSlides: number): void {
    this.send({
      type: 'slide_progress',
      data: { slideNumber, totalSlides },
    });
  }

  sendUserFeedback(feedback: any): void {
    this.send({
      type: 'user_feedback',
      data: feedback,
    });
  }

  private handleNavigatorMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'remote_message':
        // Handle remote message from staff
        break;
      case 'system_update':
        // Handle system updates
        break;
      case 'configuration_change':
        // Handle configuration changes
        break;
      default:
        console.log('Unhandled navigator message:', message);
    }
  }
}

// WebSocket connection pool manager
export class WebSocketPool {
  private connections: Map<string, WebSocketManager> = new Map();
  private connectionConfigs: Map<string, WebSocketConfig> = new Map();

  addConnection(name: string, config: WebSocketConfig): WebSocketManager {
    if (this.connections.has(name)) {
      this.removeConnection(name);
    }

    const manager = new WebSocketManager(config);
    this.connections.set(name, manager);
    this.connectionConfigs.set(name, config);

    return manager;
  }

  getConnection(name: string): WebSocketManager | null {
    return this.connections.get(name) || null;
  }

  removeConnection(name: string): void {
    const manager = this.connections.get(name);
    if (manager) {
      manager.destroy();
      this.connections.delete(name);
      this.connectionConfigs.delete(name);
    }
  }

  connectAll(): Promise<void[]> {
    const promises = Array.from(this.connections.values()).map(manager => 
      manager.connect().catch(error => console.error('Connection failed:', error))
    );
    return Promise.all(promises);
  }

  disconnectAll(): void {
    this.connections.forEach(manager => manager.disconnect());
  }

  getConnectionStates(): Record<string, WebSocketState> {
    const states: Record<string, WebSocketState> = {};
    this.connections.forEach((manager, name) => {
      states[name] = manager.getState();
    });
    return states;
  }

  broadcast(message: WebSocketMessage, excludeConnections: string[] = []): void {
    this.connections.forEach((manager, name) => {
      if (!excludeConnections.includes(name) && manager.isConnected()) {
        manager.send(message);
      }
    });
  }

  destroy(): void {
    this.connections.forEach(manager => manager.destroy());
    this.connections.clear();
    this.connectionConfigs.clear();
  }
}

// Utility functions
export class WebSocketUtils {
  static async waitForConnection(
    manager: WebSocketManager, 
    timeout: number = 10000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (manager.isConnected()) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout'));
      }, timeout);

      const handleEvent = (event: WebSocketEvent) => {
        if (event.type === 'open') {
          cleanup();
          resolve();
        } else if (event.type === 'error') {
          cleanup();
          reject(event.error);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        manager.removeEventListener(handleEvent);
      };

      manager.addEventListener(handleEvent);
    });
  }

  static createMessageValidator(schema: any) {
    return (message: WebSocketMessage): boolean => {
      // Simple validation implementation
      // In a real application, you might use a library like Joi or Yup
      try {
        if (!message.type) return false;
        
        // Add more validation logic based on schema
        return true;
      } catch (error) {
        return false;
      }
    };
  }

  static createMessageLogger() {
    return (event: WebSocketEvent) => {
      const timestamp = new Date().toISOString();
      
      switch (event.type) {
        case 'open':
          console.log(`[${timestamp}] WebSocket connected`);
          break;
        case 'close':
          console.log(`[${timestamp}] WebSocket disconnected:`, event.data);
          break;
        case 'error':
          console.error(`[${timestamp}] WebSocket error:`, event.error);
          break;
        case 'message':
          console.log(`[${timestamp}] WebSocket message:`, event.message);
          break;
        case 'reconnect':
          console.log(`[${timestamp}] WebSocket reconnecting (attempt ${event.data?.attempt})`);
          break;
        default:
          console.log(`[${timestamp}] WebSocket event:`, event.type, event);
      }
    };
  }

  static createRetryWrapper(
    manager: WebSocketManager,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    return async (message: WebSocketMessage): Promise<void> => {
      let attempts = 0;
      
      while (attempts < maxRetries) {
        try {
          if (!manager.isConnected()) {
            await WebSocketUtils.waitForConnection(manager);
          }
          
          manager.send(message);
          return;
        } catch (error) {
          attempts++;
          
          if (attempts >= maxRetries) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
        }
      }
    };
  }
}
