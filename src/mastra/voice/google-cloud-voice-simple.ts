import { VoiceSettings } from '../types/config';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { withRetry, Retry } from '@/lib/retry-utils';

/**
 * Simplified Google Cloud Voice Service that works with Next.js
 * Uses direct REST API calls instead of google-auth-library
 */
export class GoogleCloudVoiceServiceSimple {
  private config: any;
  private currentSettings: VoiceSettings;
  private serviceAccountKey: any;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: any) {
    this.config = config;
    this.currentSettings = {
      language: 'ja',
      speaker: 'ja-JP-Wavenet-B',
      speed: 1.5,
      pitch: 0.5,
      volumeGainDb: 2.0,
    };
    
    // Load service account key
    const keyFilePath = path.resolve(process.cwd(), config.credentials);
    const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
    this.serviceAccountKey = JSON.parse(keyFileContent);
    console.log('Service account loaded:', this.serviceAccountKey.client_email);
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Create JWT manually
      const jwt = this.createJWT();
      
      // Exchange JWT for access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 50 minutes from now
      this.tokenExpiry = Date.now() + 50 * 60 * 1000;
      
      console.log('Access token obtained successfully');
      return this.accessToken!;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  private createJWT(): string {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serviceAccountKey.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, // 1 hour
      iat: now,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(this.serviceAccountKey.private_key, 'base64url');
    
    return `${signatureInput}.${signature}`;
  }

  @Retry({
    maxAttempts: 3,
    initialDelay: 500,
    onRetry: (attempt, error) => {
      console.warn(`STT retry attempt ${attempt}:`, error.message);
    },
  })
  async speechToText(audioBuffer: ArrayBuffer): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS',
            languageCode: this.currentSettings.language === 'ja' ? 'ja-JP' : 'en-US',
            enableAutomaticPunctuation: true,
            model: 'latest_short',
          },
          audio: {
            content: Buffer.from(audioBuffer).toString('base64'),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Speech-to-Text API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      return result.results?.[0]?.alternatives?.[0]?.transcript || '';
    } catch (error) {
      console.error('Speech-to-Text error:', error);
      throw error;
    }
  }

  @Retry({
    maxAttempts: 3,
    initialDelay: 500,
    onRetry: (attempt, error) => {
      console.warn(`TTS retry attempt ${attempt}:`, error.message);
    },
  })
  async textToSpeech(text: string, settings?: Partial<VoiceSettings>): Promise<ArrayBuffer> {
    const currentSettings = { ...this.currentSettings, ...settings };
    
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: currentSettings.language === 'ja' ? 'ja-JP' : 'en-GB',
            name: currentSettings.speaker,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: currentSettings.speed,
            pitch: currentSettings.pitch,
            volumeGainDb: currentSettings.volumeGainDb,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Text-to-Speech API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      const audioContent = result.audioContent;
      
      if (!audioContent) {
        throw new Error('No audio content received');
      }

      return Buffer.from(audioContent, 'base64').buffer;
    } catch (error) {
      console.error('Text-to-Speech error:', error);
      throw error;
    }
  }

  updateSettings(settings: Partial<VoiceSettings>) {
    this.currentSettings = { ...this.currentSettings, ...settings };
  }

  getSettings(): VoiceSettings {
    return { ...this.currentSettings };
  }

  setLanguage(language: 'ja' | 'en') {
    this.currentSettings.language = language;
    if (language === 'ja') {
      this.currentSettings.speaker = 'ja-JP-Wavenet-B';
      this.currentSettings.speed = 1.1;
      this.currentSettings.pitch = 0.2;
      this.currentSettings.volumeGainDb = 2.0;
    } else {
      this.currentSettings.speaker = 'en-GB-Standard-F';
      this.currentSettings.speed = 1.05;
      this.currentSettings.pitch = 0.3;
      this.currentSettings.volumeGainDb = 2.5;
    }
  }

  setSpeakerByEmotion(emotion: 'neutral' | 'friendly' | 'explaining') {
    if (this.currentSettings.language === 'ja') {
      // Always use Wavenet-B for Japanese but adjust tone with speed and pitch
      this.currentSettings.speaker = 'ja-JP-Wavenet-B';
      switch (emotion) {
        case 'neutral':
          this.currentSettings.speed = 1.1;
          this.currentSettings.pitch = 0.2;
          this.currentSettings.volumeGainDb = 2.0;
          break;
        case 'friendly':
          this.currentSettings.speed = 1.15;
          this.currentSettings.pitch = 0.4;
          this.currentSettings.volumeGainDb = 2.5;
          break;
        case 'explaining':
          this.currentSettings.speed = 1.05;
          this.currentSettings.pitch = 0.1;
          this.currentSettings.volumeGainDb = 1.8;
          break;
      }
    } else {
      // Always use GB-Standard-F for English but adjust tone with speed and pitch
      this.currentSettings.speaker = 'en-GB-Standard-F';
      switch (emotion) {
        case 'neutral':
          this.currentSettings.speed = 1.05;
          this.currentSettings.pitch = 0.3;
          this.currentSettings.volumeGainDb = 2.5;
          break;
        case 'friendly':
          this.currentSettings.speed = 1.1;
          this.currentSettings.pitch = 0.5;
          this.currentSettings.volumeGainDb = 3.0;
          break;
        case 'explaining':
          this.currentSettings.speed = 1.0;
          this.currentSettings.pitch = 0.2;
          this.currentSettings.volumeGainDb = 2.2;
          break;
      }
    }
  }

  // Stub for streaming - not implemented in simple version
  async *streamingSpeechToText(audioStream: ReadableStream<Uint8Array>): AsyncIterable<string> {
    throw new Error('Streaming not supported in simple implementation');
  }
}